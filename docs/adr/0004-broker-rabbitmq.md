# ADR 0004 — Asincronía con RabbitMQ

- **Estado:** Aceptada e implementada
- **Fecha:** 2026-09-24; actualizada 2026-11-12

## Contexto

La consigna exige productor → broker → consumidor con efecto visible. En Mesa de ayuda, el escalamiento debe responder sin esperar la notificación externa y no debe perderse si el canal está temporalmente caído.

## Decisión

Usar RabbitMQ con un exchange topic durable `mesa-ayuda.eventos` y routing keys `ticket.escalado` y `ticket.cerrado`. La API declara exchange, cola, bindings, colas de reintento y DLQ antes de habilitar su confirm channel para publicar; así no pierde un evento si arranca antes que el worker. El worker declara la misma topología de forma idempotente, consume desde `mesa-ayuda.notificaciones`, usa ACK manual y `prefetch(5)`.

Si falla una dependencia transitoria (red, timeout, base de datos, HTTP `408`, `429` o `5xx`), el worker envía el evento a una cola durable de espera de **2, 4 u 8 segundos**, según el header `x-retry-count`. Cada cola aplica un TTL fijo y devuelve el mensaje vencido a la cola principal mediante dead-lettering. Hay un intento inicial y hasta tres reintentos; si también falla el cuarto, se hace NACK sin requeue hacia `mesa-ayuda.notificaciones.dead`. Los eventos malformados y las respuestas HTTP no recuperables se envían directamente a la DLQ.

El reintento se publica mediante un confirm channel. **Solo después de recibir la confirmación del broker se hace ACK del mensaje original.** Si la publicación diferida no se confirma, el worker sale sin ACK y el contenedor se reinicia; RabbitMQ reentrega el original. Se conserva el `messageId`/`event.id`, el `correlationId` y el tipo. La tabla `notificaciones` registra los intentos de envío; el header AMQP limita los reintentos incluso si PostgreSQL no está disponible.

La semántica es **at-least-once**; el worker deduplica mediante `notificaciones.evento_id UNIQUE`.

## Alternativas consideradas

- Kafka: excelente para streams de alto volumen, pero operativo y conceptual excesivo para este caso.
- SQS/EventBridge: apropiado en AWS, pero introduce credenciales/costos y dificulta la ejecución local exigida.
- Llamar al webhook desde la API: simple, pero acopla latencia/disponibilidad externa a la transacción HTTP.
- `nack(..., requeue=true)` inmediato: durante una caída puede crear un bucle de redeliveries sin tiempo de recuperación.
- `setTimeout` dentro del worker: retendría una entrega sin ACK y perdería el temporizador si el proceso termina.

## Consecuencias

- El broker y su panel son reproducibles con Docker.
- Una reentrega no duplica una notificación completada.
- La DLQ evita reintentos infinitos y vuelve observable el fallo.
- Las tres colas de espera permiten ver en RabbitMQ qué eventos están diferidos y no bloquean un slot `prefetch` durante la espera.
- Los cambios en TTL/argumentos de una cola ya creada requieren recrearla o migrarla; por eso los intervalos son fijos y versionados en `shared/rabbitTopology.js`.
- RabbitMQ no ofrece exactly-once; se logra efecto idempotente en la aplicación.
