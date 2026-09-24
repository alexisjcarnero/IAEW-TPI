# C4 — Nivel 2: Contenedores

Zoom dentro del sistema Mesa de ayuda: los procesos/servicios que lo componen y cómo se despliegan (ver `docker-compose.yml`).

```mermaid
C4Container
    title Mesa de ayuda — Diagrama de Contenedores

    Person(solicitante, "Solicitante")
    Person(agente, "Agente / Supervisor")
    System_Ext(auth0, "Auth0")
    System_Ext(canalExterno, "Canal externo")

    System_Boundary(mesaAyuda, "Sistema Mesa de ayuda") {
        Container(api, "API REST", "Node.js 20 / Express", "Expone /api/v1/tickets, /agentes, /usuarios. Valida JWT y scopes, aplica reglas de negocio y SLA")
        Container(worker, "Worker de SLA / notificaciones", "Node.js (Entrega 2)", "Consume eventos de RabbitMQ (ticket.escalado) y calcula vencimientos / dispara recordatorios")
        ContainerDb(db, "Base de datos", "PostgreSQL 16", "Persiste usuarios, agentes, tickets, comentarios, escalamientos y políticas de SLA")
        Container(broker, "Broker de mensajería", "RabbitMQ 4.x", "Exchange topic 'mesa-ayuda.eventos' para desacoplar la API del procesamiento asíncrono")
        Container(webhookReceiver, "Webhook receiver", "Node.js / Express (placeholder)", "Simula el canal externo; verifica la firma HMAC del webhook entrante")
    }

    Rel(solicitante, api, "HTTPS/JSON")
    Rel(agente, api, "HTTPS/JSON + Bearer JWT")
    Rel(api, auth0, "Valida JWT (JWKS)")
    Rel(api, db, "Lee/escribe vía Prisma Client", "SQL/TCP 5432")
    Rel(api, broker, "Publica eventos de dominio", "AMQP 5672")
    Rel(worker, broker, "Consume eventos", "AMQP 5672")
    Rel(api, webhookReceiver, "POST webhook firmado", "HTTP + HMAC-SHA256")
    Rel(webhookReceiver, canalExterno, "Reenvía notificación (fuera de alcance de la Entrega 1)")
```

## Contenedores

| Contenedor | Tecnología | Responsabilidad |
|---|---|---|
| API REST | Node.js / Express | Expone el contrato OpenAPI, valida seguridad (Auth0/JWT + `x-api-key`), orquesta reglas de negocio. |
| Base de datos | PostgreSQL 16 + Prisma | Persistencia relacional de tickets, usuarios, agentes, comentarios, escalamientos y SLA. |
| Broker | RabbitMQ 4.x | Desacopla la emisión del evento `ticket.escalado` de su procesamiento asíncrono. |
| Worker de SLA/notificaciones | Node.js (a implementar en la Entrega 2) | Consumidor del exchange; calcula vencimientos y dispara notificaciones. |
| Webhook receiver | Node.js / Express | Placeholder del canal externo; valida la firma HMAC del webhook saliente de la API. |

Todos los contenedores corren en contenedores Docker separados y se orquestan con `docker-compose.yml` en la raíz del repositorio.
