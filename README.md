# Mesa de ayuda — TPI IAEW 2026 — Avance hacia la entrega final

API REST y flujo de integración para recibir, asignar, escalar y cerrar tickets de soporte con SLA. La solución incorpora PostgreSQL, OAuth 2.0/JWT con scopes, RabbitMQ, un consumidor idempotente, webhook HMAC, logs JSON, métricas Prometheus y dashboard Grafana.

- **Asignatura:** Integración de Aplicaciones en Entornos Web, UTN FRC.
- **Dominio:** 4 — Mesa de ayuda.
- **Repositorio:** <https://github.com/alexisjcarnero/IAEW-TPI>
- **Enunciado oficial:** <https://utn-frc-iaew.github.io/iaew-2026-ecommerce-api/tpi/>
- **Guía para estudiar y defender:** [`docs/GUIA-DEFENSA-TECNICA.md`](docs/GUIA-DEFENSA-TECNICA.md).
- **Estado requisito por requisito:** [`docs/CHECKLIST-ENTREGA-FINAL.md`](docs/CHECKLIST-ENTREGA-FINAL.md).

## Integrantes

- Alexis Carnero — alexisjcarnero@gmail.com
- Esmeralda Marín — esmemarinm03@gmail.com
- María Florencia Cornier Scocco — florcornier@gmail.com

## Alcance implementado

- CRUD completo de **tickets** y **agentes**; también se implementó el CRUD de usuarios como entidad adicional.
- Flujo multi-paso de escalamiento que valida estado, prioridad/riesgo SLA, responsable activo, nivel y agente destino.
- Transacción PostgreSQL serializable con control optimista por `version`: historial, cambio del ticket y evento outbox se confirman o revierten juntos.
- OAuth 2.0 `client_credentials` y JWT RS256 mediante Auth0; validación de firma, `issuer`, `audience`, expiración y scopes.
- Endpoint comparativo protegido por `x-api-key`.
- Flujo asíncrono API → outbox → RabbitMQ → worker → notificación persistida → webhook firmado.
- Webhook HMAC-SHA256 verificado con comparación de tiempo constante.
- Dockerfile por proceso propio y Docker Compose para API, worker, webhook receiver, PostgreSQL, RabbitMQ, Prometheus y Grafana.
- Migraciones y seed idempotente.
- OpenAPI 3.1, colección Postman, tests unitarios y plan JMeter.
- Logs JSON correlacionables y dashboard con p95, throughput, tasa de errores y métricas de negocio.

## Arquitectura en un vistazo

```text
Cliente/Postman ──JWT──> API Express ──Prisma──> PostgreSQL
                            │                 ├── tickets/escalamientos
                            │                 └── eventos_outbox
                            └──AMQP──> RabbitMQ ──> Worker ──HMAC──> Webhook receiver
                                                   │
                                                   └──Prisma──> notificaciones

API + Worker + Webhook receiver ──/metrics──> Prometheus ──> Grafana
Auth0 ──OIDC discovery/JWKS──> API (validación local del JWT)
```

Documentación completa:

- [C4 Contexto](docs/c4/01-context.md)
- [C4 Contenedores](docs/c4/02-container.md)
- [C4 Componentes](docs/c4/03-component.md)
- [Modelo de datos](docs/modelo-datos.md)
- [ADRs](docs/adr/)
- [Contrato OpenAPI 3.1](docs/api/openapi.yaml)

## Requisitos previos

- Docker Engine/Desktop con Docker Compose v2.
- Una cuenta Auth0 gratuita con permiso para crear una API y una aplicación Machine to Machine.
- Postman 11 o Newman para la prueba funcional.
- JMeter 5.6.3 y Java 17+ para regenerar el reporte de carga.
- Node.js 20+ solo para desarrollo o para ejecutar los tests unitarios fuera de Docker.

## Configuración segura

Copiar el archivo de ejemplo y reemplazar los valores `colocar-*`:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

Variables principales:

| Variable | Uso |
|---|---|
| `POSTGRES_*`, `DATABASE_URL` | Base y conexión Prisma. La contraseña debe coincidir en ambos lugares. |
| `AUTH0_DOMAIN` | Tenant sin protocolo, por ejemplo `equipo.us.auth0.com`. |
| `AUTH0_AUDIENCE` | Identifier exacto de la API de Auth0. |
| `INTERNAL_API_KEY` | Secreto del ejemplo `x-api-key`; no reemplaza OAuth. |
| `RABBIT_*`, `RABBIT_URL`, `RABBIT_EXCHANGE` | Broker, credenciales y exchange topic. |
| `WEBHOOK_URL`, `WEBHOOK_SECRET` | Receptor y secreto compartido para HMAC-SHA256. |
| `GRAFANA_ADMIN_*` | Acceso local al dashboard. |

No se versionan `.env`, tokens, secretos de cliente ni credenciales reales. Los valores por defecto de Compose son exclusivamente locales y deben cambiarse antes de un despliegue compartido.

## Configurar Auth0

1. En **Applications → APIs → Create API**, crear `Mesa de ayuda API`.
2. Usar como **Identifier** el mismo valor de `AUTH0_AUDIENCE`, por ejemplo `https://iaew-mesa-ayuda-api`.
3. Seleccionar algoritmo de firma **RS256**.
4. En **Permissions**, crear:

   - `read:tickets`: consultar tickets, usuarios y efectos asíncronos.
   - `write:tickets`: crear/editar tickets, usuarios y comentarios.
   - `assign:tickets`: administrar agentes, asignar y escalar.
   - `close:tickets`: cerrar tickets resueltos.

5. En **Applications → Create Application**, crear una aplicación **Machine to Machine**.
6. Autorizarla para la API anterior y otorgarle los cuatro permisos para ejecutar la colección completa.
7. Copiar el Domain y audience al `.env`. El `client_id` y `client_secret` se cargan solamente en el ambiente local de Postman; no van al repositorio.

Obtener un token:

```bash
curl --request POST "https://$AUTH0_DOMAIN/oauth/token" \
  --header "content-type: application/json" \
  --data "{\"client_id\":\"$CLIENT_ID\",\"client_secret\":\"$CLIENT_SECRET\",\"audience\":\"$AUTH0_AUDIENCE\",\"grant_type\":\"client_credentials\"}"
```

La API usa `express-oauth2-jwt-bearer`: obtiene la clave pública desde el JWKS del issuer y valida criptográficamente firma RS256, issuer, audience y `exp`; luego exige todos los scopes declarados en cada operación. Sin token responde `401`; con JWT válido pero scope insuficiente, `403`.

## Arranque reproducible

```bash
docker compose config
docker compose up --build -d
docker compose ps
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{"status":"ok","db":"up","broker":"up"}
```

El contenedor API ejecuta automáticamente `prisma migrate deploy` y el seed idempotente antes de iniciar. No hace falta preparar la base manualmente.

Servicios locales:

| Servicio | URL/puerto | Propósito |
|---|---|---|
| API | <http://localhost:3000> | REST, health y métricas. |
| Webhook receiver | <http://localhost:4000> | Canal externo simulado. |
| RabbitMQ Management | <http://localhost:15672> | Colas, exchange y DLQ. |
| Prometheus | <http://localhost:9090> | Consulta de métricas. |
| Grafana | <http://localhost:3001> | Dashboard provisionado en carpeta `IAEW`. |
| PostgreSQL | `localhost:5432` | Persistencia. |

Para detener sin borrar datos:

```bash
docker compose down
```

`docker compose down -v` borra todos los volúmenes locales y solo debe usarse si se quiere reiniciar la evidencia desde cero.

## Datos iniciales

El seed crea o reutiliza:

- cuatro políticas SLA (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`);
- un solicitante de demostración;
- agentes N1, N2 y N3;
- un ticket de ejemplo.

Puede repetirse sin duplicar las entidades identificadas por prioridad/email:

```bash
docker compose exec api npx prisma db seed
```

## Endpoints principales

| Método | Ruta | Seguridad | Función |
|---|---|---|---|
| GET | `/health` | Pública | Estado de DB y broker. |
| GET/POST | `/api/v1/tickets` | `read:tickets` / `write:tickets` | Listar y crear. |
| GET/PATCH/DELETE | `/api/v1/tickets/{id}` | `read:tickets` / `write:tickets` | Detalle, actualización y eliminación condicionada. |
| POST | `/api/v1/tickets/{id}/asignacion` | `assign:tickets` | Asignar agente del nivel actual. |
| POST | `/api/v1/tickets/{id}/escalamientos` | `write:tickets` + `assign:tickets` | Transacción multi-paso y evento outbox. |
| POST | `/api/v1/tickets/{id}/cierre` | `close:tickets` | Cerrar un ticket resuelto. |
| GET/POST | `/api/v1/tickets/{id}/comentarios` | read/write | Historial de seguimiento. |
| GET | `/api/v1/tickets/{id}/notificaciones` | `read:tickets` | Efecto observable del consumidor. |
| CRUD | `/api/v1/agentes` | `assign:tickets` | Segundo CRUD obligatorio. |
| GET/POST/PATCH | `/api/v1/usuarios` | read/write | CRUD adicional. |
| DELETE | `/api/v1/usuarios/{id}` | `x-api-key` | Ejemplo alternativo de autenticación. |
| GET | `/internal/sla-policies` | `x-api-key` | Consulta servicio-a-servicio. |

El comportamiento, ejemplos y errores `application/problem+json` están en el [OpenAPI](docs/api/openapi.yaml).

## Flujo multi-paso y asincronía

1. `POST /tickets/{id}/escalamientos` valida ticket, responsable, SLA, nivel siguiente y agente destino.
2. En una transacción serializable crea `Escalamiento`, actualiza `Ticket` y crea `EventoOutbox`.
3. La respuesta HTTP no depende de que RabbitMQ esté disponible: si el broker falla, el evento permanece en outbox.
4. El publicador usa un confirm channel y marca `publicadoEn` solo después del ACK del broker.
5. El worker consume `ticket.escalado`, persiste una `Notificacion` idempotente por `eventoId` y envía el webhook.
6. Tras tres fallos, RabbitMQ mueve el mensaje a `mesa-ayuda.notificaciones.dead`.
7. El resultado se observa en `GET /tickets/{id}/notificaciones`, los logs del worker, RabbitMQ y el receptor.

## Webhook firmado

El worker serializa el evento exactamente una vez para calcular:

```text
hex(HMAC-SHA256(WEBHOOK_SECRET, rawBody))
```

Envía el valor como `X-Signature-256: sha256=<hex>`. El receptor conserva el body crudo, recalcula el HMAC y usa `crypto.timingSafeEqual`; una firma inválida devuelve `401` y no registra el evento. Las últimas recepciones válidas de la demo se consultan en:

```bash
curl http://localhost:4000/webhooks/mesa-ayuda/recepciones
```

## Observabilidad

- API, worker y receptor escriben una línea JSON por evento relevante.
- La API acepta o genera `x-correlation-id`, lo devuelve al cliente y lo propaga en el evento AMQP y el webhook.
- Headers `Authorization` y `x-api-key` se redactan en los logs HTTP.
- Prometheus recolecta `/metrics` cada 5 segundos.
- Grafana carga automáticamente `Mesa de ayuda - API y eventos` con:

  - throughput en requests/segundo;
  - latencia p95 calculada desde el histograma;
  - tasa de respuestas `5xx`;
  - requests por código;
  - tickets creados/escalados y eventos consumidos.

Consultas principales:

```promql
sum(rate(mesa_ayuda_http_requests_total[1m]))
histogram_quantile(0.95, sum(rate(mesa_ayuda_http_request_duration_seconds_bucket[5m])) by (le))
100 * sum(rate(mesa_ayuda_http_requests_total{status_code=~"5.."}[5m])) / clamp_min(sum(rate(mesa_ayuda_http_requests_total[5m])), 0.001)
```

## Pruebas

Validación local sin infraestructura:

```bash
npm ci
npm test
npm run validate:artifacts
npx prisma validate
```

La suite actual cubre reglas de escalamiento, riesgo SLA, niveles, validación de entradas, exigencia conjunta de scopes, comparación segura de API keys y firma/verificación HMAC. El resultado verificado en este árbol es **15/15 tests aprobados** y `npm audit` sin vulnerabilidades conocidas.

Prueba funcional completa:

1. Importar [`tests/postman/Mesa-de-ayuda.postman_collection.json`](tests/postman/Mesa-de-ayuda.postman_collection.json).
2. Importar [`tests/postman/Local.postman_environment.json`](tests/postman/Local.postman_environment.json).
3. Completar `auth0Domain`, `audience`, `clientId`, `clientSecret` e `internalApiKey` solo localmente.
4. Ejecutar la colección en orden. Crea datos únicos, obtiene el JWT y comprueba el efecto asíncrono.

La carga JMeter y el reporte se explican en [`docs/PRUEBAS.md`](docs/PRUEBAS.md). El reporte real debe regenerarse con el tenant del equipo; no se incluyen métricas inventadas.

## Decisiones y limitaciones conocidas

Las decisiones están registradas en [`docs/adr/`](docs/adr/). Las limitaciones asumidas son:

- Auth0 es una dependencia externa: el primer JWT puede requerir acceso a OIDC/JWKS; luego la verificación de cada token es local y cacheada por la biblioteca.
- La API local expone `/metrics` y el receptor expone el historial de demo sin autenticación. En producción deben quedar en una red interna.
- El webhook receiver conserva solo las últimas 100 recepciones en memoria; la evidencia durable es `notificaciones` en PostgreSQL.
- El worker reintenta hasta tres veces y luego usa DLQ, pero no hay una interfaz automática de replay.
- El borrado de entidades con historial se rechaza para conservar auditoría; en agentes se recomienda desactivar con `PATCH`.
- El despliegue cloud y las trazas distribuidas son optativos y no están incluidos.

## Estado de publicación

Este es un **avance de trabajo** en `main`, no la versión final ni una release. Los manifiestos y el contrato API indican `1.0.2` para identificar este estado; todavía no se crea un tag nuevo. Los tags `v1.0.0` y `v1.0.1` permanecen asociados a la primera entrega y no se modifican.

Para identificar el commit exacto de este avance, ejecutar `git rev-parse HEAD`. Antes de entregar el ZIP final, el equipo deberá completar las evidencias pendientes, fijar la versión/tag definitivo de acuerdo con la consigna y registrar el hash del commit de esa release en este README. No se debe presentar este avance como la entrega final.
