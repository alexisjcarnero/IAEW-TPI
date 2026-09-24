# ADR 0004 — Asincronía: RabbitMQ como broker de eventos

- **Estado:** Aceptada
- **Fecha:** 2026-09-24

## Contexto

La consigna exige un flujo productor -> broker -> consumidor visible en la demo. En Mesa de ayuda, el caso natural es: al escalar un ticket, la API publica un evento `ticket.escalado`, y un worker separado lo consume para calcular vencimientos de SLA o disparar notificaciones diferidas, sin bloquear la respuesta HTTP del escalamiento.

## Decisión

Usar **RabbitMQ** (imagen `rabbitmq:4.2-management`) con un exchange **topic** (`mesa-ayuda.eventos`), publicado desde la API vía `amqplib` (`src/messaging/rabbit.js`). Routing keys por tipo de evento, por ejemplo `ticket.escalado`, `ticket.cerrado`.

## Alternativas consideradas

- **Kafka**: mejor para alto throughput y streams, pero mayor complejidad operativa (Zookeeper/KRaft) injustificada para el volumen de este TPI.
- **SQS/EventBridge (AWS)**: requiere cuenta/credenciales de nube; se prefiere un broker local reproducible con Docker Compose para la Entrega 1, sin dependencia de servicios externos. Podría evaluarse como bono de despliegue en la Entrega 2.

## Consecuencias

- El exchange se declara al conectar (`assertExchange`, durable) para que el compose sea reproducible desde cero.
- Falta implementar (Entrega 2) el worker consumidor y la publicación real del evento desde el endpoint de escalamiento (hoy el endpoint es un stub `501`).
- RabbitMQ expone su panel de management en `:15672` para observar colas/mensajes durante la demo.
