# C4 — Nivel 3: Componentes (contenedor API REST)

Zoom dentro del contenedor "API REST".

```mermaid
C4Component
    title Mesa de ayuda — Componentes de la API REST

    Container_Boundary(api, "API REST (Express)") {
        Component(routerTickets, "Router de Tickets", "Express Router", "GET/POST/PATCH tickets, asignación, escalamiento, cierre, comentarios")
        Component(routerAgentes, "Router de Agentes", "Express Router", "CRUD de agentes")
        Component(routerUsuarios, "Router de Usuarios", "Express Router", "CRUD de usuarios; ejemplo con x-api-key")
        Component(routerHealth, "Router de Health", "Express Router", "Healthcheck público de DB y broker")

        Component(authMw, "Middleware Auth0", "express-oauth2-jwt-bearer", "Valida JWT (issuer, audience, firma, expiración) y scopes requeridos")
        Component(apiKeyMw, "Middleware API Key", "Custom", "Valida header x-api-key para endpoints internos")
        Component(correlationMw, "Middleware Correlation ID", "Custom", "Genera/propaga x-correlation-id para trazabilidad")
        Component(errorMw, "Error Handler", "Custom", "Traduce errores a application/problem+json")

        Component(escalationSvc, "EscalationService", "Módulo de dominio (Entrega 2)", "Valida prioridad/estado/responsable/SLA antes de escalar un ticket")
        Component(eventPublisher, "EventPublisher", "amqplib wrapper", "Publica eventos de dominio en el exchange de RabbitMQ")
        Component(webhookNotifier, "WebhookNotifier", "Custom (fetch + HMAC)", "Firma y envía el webhook saliente al canal externo")
        Component(prismaClient, "Prisma Client", "ORM", "Acceso tipado a PostgreSQL")
        Component(logger, "Logger", "pino / pino-http", "Logs JSON estructurados por request")
    }

    Rel(routerTickets, authMw, "usa")
    Rel(routerAgentes, authMw, "usa")
    Rel(routerUsuarios, authMw, "usa")
    Rel(routerUsuarios, apiKeyMw, "usa (endpoint interno)")

    Rel(routerTickets, escalationSvc, "delega reglas de escalamiento")
    Rel(escalationSvc, eventPublisher, "publica ticket.escalado")
    Rel(escalationSvc, webhookNotifier, "notifica canal externo")
    Rel(routerTickets, prismaClient, "lee/escribe tickets")
    Rel(routerAgentes, prismaClient, "lee/escribe agentes")
    Rel(routerUsuarios, prismaClient, "lee/escribe usuarios")

    Rel(correlationMw, logger, "enriquece contexto de logs")
    Rel(errorMw, logger, "registra errores")
```

## Componentes

| Componente | Estado en Entrega 1 |
|---|---|
| Routers (tickets, agentes, usuarios, health) | Implementados; la mayoría de las operaciones responden `501` como esqueleto, salvo `GET /health` y `GET /api/v1/tickets`. |
| Middleware Auth0 (`src/middleware/auth0.js`) | Implementado y reutilizado del proyecto de la materia. |
| Middleware API Key (`src/middleware/apiKey.js`) | Implementado. |
| Correlation ID / Error Handler | Implementados. |
| EscalationService | Diseñado (ver ADR y OpenAPI); implementación funcional en la Entrega 2. |
| EventPublisher (`src/messaging/rabbit.js`) | Implementado: conecta y declara el exchange; falta la lógica de publicación real del escalamiento. |
| WebhookNotifier (`src/messaging/webhookNotifier.js`) | Implementado el envío firmado; falta invocarlo desde el flujo de escalamiento. |
