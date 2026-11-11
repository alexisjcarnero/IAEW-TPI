# ADR 0004 — Asincronía con RabbitMQ

- **Estado:** Aceptada e implementada
- **Fecha:** 2026-09-24; actualizada 2026-11-10

## Contexto

La consigna exige productor → broker → consumidor con efecto visible. En Mesa de ayuda, el escalamiento debe responder sin esperar la notificación externa y no debe perderse si el canal está temporalmente caído.

## Decisión

Usar RabbitMQ con un exchange topic durable `mesa-ayuda.eventos` y routing keys `ticket.escalado` y `ticket.cerrado`. La API declara exchange, cola, bindings y DLQ antes de habilitar su confirm channel para publicar; así no pierde un evento si arranca antes que el worker. El worker declara la misma topología de forma idempotente, consume desde `mesa-ayuda.notificaciones`, usa ACK manual, `prefetch(5)` y una dead-letter queue `mesa-ayuda.notificaciones.dead` tras tres intentos fallidos.

La semántica es **at-least-once**; el worker deduplica mediante `notificaciones.evento_id UNIQUE`.

## Alternativas consideradas

- Kafka: excelente para streams de alto volumen, pero operativo y conceptual excesivo para este caso.
- SQS/EventBridge: apropiado en AWS, pero introduce credenciales/costos y dificulta la ejecución local exigida.
- Llamar al webhook desde la API: simple, pero acopla latencia/disponibilidad externa a la transacción HTTP.

## Consecuencias

- El broker y su panel son reproducibles con Docker.
- Una reentrega no duplica una notificación completada.
- La DLQ evita reintentos infinitos y vuelve observable el fallo.
- RabbitMQ no ofrece exactly-once; se logra efecto idempotente en la aplicación.
