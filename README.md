# Mesa de ayuda — TPI IAEW 2026 (Entrega 1)

API REST para un sistema de mesa de ayuda: creación, asignación, escalamiento y cierre de tickets, con seguridad OAuth 2.0/JWT, asincronía vía RabbitMQ e integración por webhook firmado.

## Integrantes

- Alexis Carnero (alexisjcarnero@gmail.com)
- _Completar con el resto del equipo_

## Dominio elegido y alcance

**Dominio 4 — Mesa de ayuda.** Registrado con la cátedra según lo pedido en la consigna del TPI.

**Problema:** un equipo de soporte recibe tickets de usuarios, los asigna a agentes por nivel (N1/N2/N3), y necesita escalarlos cuando el SLA está en riesgo o el nivel actual no puede resolverlos, con trazabilidad de cada paso y notificación a un canal externo.

**Alcance de esta entrega (Entrega 1 — diseño y esqueleto):**

- Diagramas C4 (Contexto, Contenedor, Componente).
- ADRs de las decisiones clave: estilo de API, base de datos, seguridad, broker e integración adicional.
- Contrato OpenAPI 3.1 completo, con ejemplos de request/response.
- Modelo de datos PostgreSQL (Prisma) con migración inicial y seed.
- Esqueleto ejecutable: API Express real + PostgreSQL + RabbitMQ + un receptor de webhook, orquestados con Docker Compose. Las operaciones de negocio (crear/asignar/escalar/cerrar ticket) están enrutadas, protegidas por scope y devuelven `501 Not Implemented`, salvo `GET /health` y `GET /api/v1/tickets`, que ya funcionan de punta a punta contra la base de datos.

La implementación funcional completa (CRUD real, flujo de escalamiento con reglas de SLA, publicación de eventos, notificación por webhook, observabilidad y pruebas de carga) se entrega en la **Entrega 2** (16/11/2026).

## Arquitectura en un vistazo

- [Contexto (C4 Nivel 1)](docs/c4/01-context.md)
- [Contenedores (C4 Nivel 2)](docs/c4/02-container.md)
- [Componentes (C4 Nivel 3)](docs/c4/03-component.md)
- [ADRs](docs/adr/)
- [Modelo de datos](docs/modelo-datos.md)
- [Contrato OpenAPI 3.1](docs/api/openapi.yaml)

## Requisitos previos

- [Docker](https://www.docker.com/) y Docker Compose (`docker compose version`).
- Node.js 20+ y npm, solo si se quiere correr la API fuera de Docker.
- Una cuenta de [Auth0](https://auth0.com/) (nivel gratuito) para la seguridad OAuth 2.0/JWT.

## Variables de entorno

Copiar `.env.example` a `.env` y completar los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `PORT` | Puerto donde escucha la API (default `3000`). |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Credenciales del contenedor de PostgreSQL. |
| `DATABASE_URL` | Connection string usado por Prisma (debe coincidir con las anteriores). |
| `AUTH0_DOMAIN` | Dominio del tenant de Auth0 (ej. `tu-tenant.us.auth0.com`). |
| `AUTH0_AUDIENCE` | Identifier de la API creada en Auth0. |
| `INTERNAL_API_KEY` | Clave para el endpoint interno protegido con `x-api-key`. |
| `RABBIT_USER`, `RABBIT_PASS`, `RABBIT_URL`, `RABBIT_EXCHANGE` | Credenciales y conexión a RabbitMQ. |
| `WEBHOOK_URL`, `WEBHOOK_SECRET` | Destino y secreto compartido para el webhook firmado (integración adicional). |

**No se suben secretos reales al repositorio.** El `.env` está en `.gitignore`; solo se versiona `.env.example`.

## Configuración de Auth0 (OAuth 2.0 + JWT)

1. Crear una cuenta/tenant en Auth0.
2. **Applications → APIs → Create API**: nombre `Mesa de ayuda API`, identifier (audience), por ejemplo `https://iaew-mesa-ayuda-api`. Habilitar RBAC y "Add Permissions in the Access Token".
3. En la API creada, ir a **Permissions** y agregar los scopes del dominio:
   - `read:tickets` — leer tickets.
   - `write:tickets` — crear/editar tickets y comentarios.
   - `assign:tickets` — asignar agentes y administrar agentes.
   - `close:tickets` — cerrar tickets.
4. **Applications → Applications → Create Application**, tipo **Machine to Machine**. Autorizarla contra la API creada en el paso 2 y seleccionar los scopes que necesite (para pruebas, todos).
5. Copiar `Domain` → `AUTH0_DOMAIN`, y el `identifier` de la API → `AUTH0_AUDIENCE`, en el `.env`.

### Obtener un access token (`client_credentials`)

```bash
curl --request POST \
  --url "https://$AUTH0_DOMAIN/oauth/token" \
  --header "content-type: application/json" \
  --data '{
    "client_id": "CLIENT_ID_DE_LA_APP_M2M",
    "client_secret": "CLIENT_SECRET_DE_LA_APP_M2M",
    "audience": "'"$AUTH0_AUDIENCE"'",
    "grant_type": "client_credentials"
  }'
```

La respuesta incluye `access_token` (JWT), `expires_in` y `scope`.

### Probar un endpoint protegido con Bearer token

```bash
curl http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

- Sin header `Authorization`: `401`.
- Token válido pero sin el scope `read:tickets`: `403`.

### Probar el ejemplo con `x-api-key`

```bash
curl http://localhost:3000/internal/sla-policies \
  -H "x-api-key: $INTERNAL_API_KEY"
```

## Cómo levantar todo localmente

```bash
docker compose up --build
```

Esto levanta:

- `api` — la API REST en `http://localhost:3000` (aplica migraciones de Prisma al iniciar).
- `db` — PostgreSQL en `localhost:5432`.
- `rabbitmq` — RabbitMQ, AMQP en `localhost:5672`, panel de administración en `http://localhost:15672` (usuario/clave de `RABBIT_USER`/`RABBIT_PASS`).
- `webhook-receiver` — placeholder del canal externo en `http://localhost:4000`.

Verificar que todo esté arriba:

```bash
curl http://localhost:3000/health
# {"status":"ok","db":"up","broker":"up"}
```

### Ejecución sin Docker (opcional, para desarrollo)

```bash
npm install
npx prisma migrate dev
npm run dev
```

Requiere una instancia de PostgreSQL y RabbitMQ accesibles según las variables de `.env`.

## Cómo cargar datos iniciales

Con los contenedores levantados:

```bash
docker compose exec api npx prisma db seed
```

Crea las políticas de SLA por prioridad, agentes de ejemplo (N1/N2/N3), un usuario solicitante y un ticket de ejemplo. El seed es idempotente (usa `upsert`), se puede correr varias veces sin duplicar datos.

## Cómo ejecutar pruebas

_A completar en la Entrega 2_: colección Postman con variables/ambientes (obtención de token, CRUD, escalamiento) y reporte de prueba de carga (JMeter o Postman/Newman).

## Cómo disparar el flujo asincrónico y dónde ver el efecto

El endpoint `POST /api/v1/tickets/{id}/escalamientos` está diseñado para publicar el evento `ticket.escalado` en el exchange `mesa-ayuda.eventos` de RabbitMQ (ver [`src/messaging/rabbit.js`](src/messaging/rabbit.js) y el [ADR 0004](docs/adr/0004-broker-rabbitmq.md)). En esta entrega el endpoint es un esqueleto (`501`); el flujo completo productor → broker → consumidor (worker de SLA/notificaciones) se implementa en la Entrega 2. Mientras tanto, se puede verificar que la conexión al broker está activa desde `GET /health` (`broker: "up"`) y observar el exchange declarado en el panel de RabbitMQ (`http://localhost:15672`).

## Cómo probar la integración elegida (webhook firmado)

La integración adicional es un **webhook con firma HMAC-SHA256** (ver [ADR 0005](docs/adr/0005-integracion-webhook-firmado.md)). El envío real ocurrirá al escalar/cerrar un ticket (Entrega 2, vía [`src/messaging/webhookNotifier.js`](src/messaging/webhookNotifier.js)). Para probar el receptor de forma aislada en esta entrega:

```bash
BODY='{"event":"ticket.escalado","data":{"ticketId":"demo"},"timestamp":"2026-09-24T00:00:00.000Z"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')

curl -X POST http://localhost:4000/webhooks/mesa-ayuda \
  -H "Content-Type: application/json" \
  -H "X-Signature-256: sha256=$SIG" \
  -d "$BODY"
```

El `webhook-receiver` valida la firma y responde `200` si es correcta, `401` si no coincide. Los eventos recibidos se loguean en JSON (`docker compose logs webhook-receiver`).

## Cómo observar el sistema

- **Logs JSON estructurados**: la API usa `pino`/`pino-http` (`docker compose logs -f api`); cada línea incluye nivel, mensaje, método/ruta y tiempo de respuesta.
- **Correlation ID**: cada request recibe/propaga el header `x-correlation-id` (ver [`src/middleware/correlationId.js`](src/middleware/correlationId.js)), incluido en la respuesta y en los logs de error, para correlacionar API ↔ worker ↔ webhook receiver.
- **Dashboard con p95/throughput/error rate**: _a implementar en la Entrega 2_.

## Endpoints principales

Contrato completo en [`docs/api/openapi.yaml`](docs/api/openapi.yaml) (OpenAPI 3.1). Resumen:

| Método | Ruta | Scope / Auth | Estado |
|---|---|---|---|
| GET | `/health` | público | Implementado |
| GET | `/api/v1/tickets` | `read:tickets` | Implementado (lee de PostgreSQL) |
| POST | `/api/v1/tickets` | `write:tickets` | Esqueleto (`501`) |
| GET/PATCH/DELETE | `/api/v1/tickets/{id}` | `read:tickets` / `write:tickets` | Esqueleto (`501`) |
| POST | `/api/v1/tickets/{id}/asignacion` | `assign:tickets` | Esqueleto (`501`) |
| POST | `/api/v1/tickets/{id}/escalamientos` | `write:tickets`, `assign:tickets` | Esqueleto (`501`) |
| POST | `/api/v1/tickets/{id}/cierre` | `close:tickets` | Esqueleto (`501`) |
| CRUD | `/api/v1/agentes` | `assign:tickets` | Esqueleto (`501`) |
| CRUD | `/api/v1/usuarios` | `read:tickets` / `write:tickets` | Esqueleto (`501`) |
| DELETE | `/api/v1/usuarios/{id}` | `x-api-key` | Esqueleto (`501`) |
| GET | `/internal/sla-policies` | `x-api-key` | Implementado |

Ejemplo de request/response completo en el contrato OpenAPI (operación `POST /tickets/{ticketId}/escalamientos`).

## Decisiones técnicas principales

Ver [`docs/adr/`](docs/adr/):

- [ADR 0001 — Estilo de API: REST](docs/adr/0001-estilo-api-rest.md)
- [ADR 0002 — Base de datos: PostgreSQL](docs/adr/0002-base-datos-postgresql.md)
- [ADR 0003 — Seguridad: OAuth 2.0 + JWT vía Auth0](docs/adr/0003-seguridad-oauth2-jwt-auth0.md)
- [ADR 0004 — Broker: RabbitMQ](docs/adr/0004-broker-rabbitmq.md)
- [ADR 0005 — Integración: Webhook firmado](docs/adr/0005-integracion-webhook-firmado.md)

## Limitaciones conocidas y mejoras futuras

- La mayoría de las operaciones de negocio (CRUD completo de tickets/agentes/usuarios, asignación, escalamiento, cierre, comentarios) son esqueletos que responden `501`; se implementan en la Entrega 2.
- No hay worker consumidor de RabbitMQ todavía; solo se declara el exchange.
- El webhook firmado tiene el receptor y el emisor implementados como módulos, pero no está conectado al flujo de negocio real.
- No hay observabilidad de métricas (p95/throughput/error rate) ni pruebas automatizadas todavía.
- Autenticación de usuarios finales (login interactivo) está fuera de alcance: la consigna pide `client_credentials` (M2M).

## Release y entrega

- **Tag de release:** `v1.0.0`
- **Commit hash de esta entrega:** _completar tras el commit final (ver sección siguiente)_

> Nota: por cómo funciona git, este README no puede contener el hash del commit que lo incluye a sí mismo. El hash de arriba corresponde al último commit de contenido antes de la entrega; el commit inmediatamente posterior solo actualiza esta línea y se referencia en el tag `v1.0.0`.
