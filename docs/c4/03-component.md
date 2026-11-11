# C4 — Nivel 3: Componentes

## Contenedor API

```mermaid
flowchart TB
    routes["Routers Express\nTickets, agentes, usuarios, interno"]
    auth["Middleware Auth0\nJWT + scopes"]
    apikey["Middleware API key\ncomparación timing-safe"]
    validation["Zod\nvalidación/normalización"]
    service["TicketService\nreglas y transacciones"]
    rules["EscalationRules\nfunciones de dominio testeables"]
    prisma["Prisma Client"]
    outbox["OutboxPublisher\npolling + confirm channel"]
    rabbit["Rabbit adapter\nreconexión y publisher confirms"]
    obs["Pino + correlation ID + métricas"]
    errors["ErrorHandler\nRFC 9457"]

    routes --> auth
    routes --> apikey
    routes --> validation
    routes --> service
    service --> rules
    service --> prisma
    outbox --> prisma
    outbox --> rabbit
    routes --> obs
    routes --> errors
```

| Componente | Archivo principal | Motivo de separación |
|---|---|---|
| Routers | `src/routes/*.js` | Traduce HTTP a casos de uso; no contiene las reglas complejas. |
| Validación | `src/validation/schemas.js` | Rechaza campos desconocidos y limita tamaños antes de tocar datos. |
| Seguridad | `src/middleware/auth0.js`, `apiKey.js` | Centraliza autenticación y autorización. |
| Servicio de tickets | `src/services/ticketService.js` | Coordina persistencia y transacciones. |
| Reglas de escalamiento | `src/services/escalationRules.js` | Lógica pura con tests unitarios, independiente de Express/Prisma. |
| Outbox publisher | `src/messaging/outboxPublisher.js` | Separa confirmación de negocio de disponibilidad del broker. |
| Rabbit adapter | `src/messaging/rabbit.js` | Administra conexión, exchange y confirm channel. |
| Observabilidad | `metrics.js`, `correlationId.js`, Pino | Mide y correlaciona sin contaminar reglas de dominio. |
| Errores | `AppError.js`, `errorHandler.js` | Uniforma códigos y `application/problem+json`. |

## Contenedor worker

```mermaid
flowchart LR
    consumer["Consumer AMQP\nmanual ack/nack"]
    idem["Control idempotente\neventoId UNIQUE"]
    db[("Notificacion")]
    signer["Webhook signer\nHMAC-SHA256"]
    dlq["DLQ\ntras 3 intentos"]
    metrics["Métricas y logs JSON"]

    consumer --> idem --> db
    db --> signer
    signer -->|"2xx: ACK"| consumer
    signer -->|"fallo: retry"| consumer
    consumer -->|"3 fallos: NACK sin requeue"| dlq
    consumer --> metrics
```

El worker es deliberadamente **at-least-once**: RabbitMQ puede reentregar. La restricción única `notificaciones.evento_id` hace que una reentrega ya completada se reconozca y se confirme sin duplicar el webhook.
