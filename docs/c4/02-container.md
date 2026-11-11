# C4 — Nivel 2: Contenedores

Esta vista coincide con los servicios declarados en `docker-compose.yml`.

```mermaid
flowchart LR
    cliente["Cliente / Postman"]
    auth0["Auth0\nAuthorization Server"]
    canal["Webhook receiver\nNode.js / Express"]

    subgraph sistema["Sistema Mesa de ayuda"]
      api["API REST\nNode.js 20 / Express\nPuerto 3000"]
      db[("PostgreSQL 16\nDatos + outbox + notificaciones")]
      rabbit["RabbitMQ 4.x\nExchange topic + cola + DLQ"]
      worker["Worker\nNode.js 20 / amqplib\nConsumidor idempotente"]
      prometheus["Prometheus\nSeries temporales"]
      grafana["Grafana\nDashboard provisionado"]
    end

    cliente -->|"REST + JWT"| api
    cliente -->|"client_credentials"| auth0
    api -->|"OIDC/JWKS"| auth0
    api -->|"Prisma/SQL"| db
    api -->|"AMQP + publisher confirms"| rabbit
    rabbit -->|"ack/nack, prefetch 5"| worker
    worker -->|"Prisma/SQL"| db
    worker -->|"HTTP + HMAC-SHA256"| canal
    api -->|"/metrics"| prometheus
    worker -->|"/metrics"| prometheus
    canal -->|"/metrics"| prometheus
    prometheus -->|"PromQL"| grafana
```

## Catálogo de contenedores

| Contenedor | Tecnología | Responsabilidad | Persistencia |
|---|---|---|---|
| API | Express, Prisma, Zod, Pino | REST, autenticación/autorización, reglas de aplicación, transacción y outbox. | PostgreSQL. |
| Worker | Node.js, amqplib, Prisma | Consumir eventos, deduplicar, persistir efecto y enviar webhook. | PostgreSQL por `evento_id` único. |
| Webhook receiver | Express, crypto | Verificar HMAC sobre body crudo y simular canal externo. | Últimas 100 recepciones en memoria; logs JSON. |
| PostgreSQL | 16-alpine | Entidades, historial, SLA, outbox y notificaciones. | Volumen Docker. |
| RabbitMQ | 4.2-management | Exchange topic, cola durable y dead-letter queue. | Volumen Docker. |
| Prometheus | 3.x | Scraping y almacenamiento de métricas. | Volumen Docker, retención 7 días. |
| Grafana | 12.x | Dashboard p95/throughput/error rate. | Provisioning versionado y volumen. |

## Protocolos

- HTTP/JSON para API y webhook.
- OAuth 2.0 sobre HTTPS con Auth0.
- AMQP 0-9-1 entre API/worker y RabbitMQ.
- SQL/TCP entre Prisma y PostgreSQL.
- Exposición Prometheus para métricas.
