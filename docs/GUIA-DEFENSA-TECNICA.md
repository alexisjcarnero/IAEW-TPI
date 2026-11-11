# Guía de estudio y defensa técnica

Esta guía explica qué problema resuelve el proyecto, cómo se conectan sus partes, por qué se eligió cada mecanismo y qué compromisos quedan. Conviene estudiarla siguiendo el recorrido de una solicitud real y no memorizando archivos aislados.

## 1. La explicación de 30 segundos

“Construimos una mesa de ayuda con una API REST protegida por OAuth 2.0/JWT. Los tickets se almacenan en PostgreSQL y el escalamiento valida reglas de estado, responsable, nivel, prioridad y SLA dentro de una transacción. Esa misma transacción guarda un evento en una outbox. La API lo publica en RabbitMQ; un worker idempotente lo consume, registra una notificación y envía un webhook HMAC. Todo se ejecuta con Docker Compose, se observa mediante logs JSON, Prometheus/Grafana y se prueba con Node, Postman y JMeter.”

Esa frase nombra los seis ejes evaluados: funcionalidad, arquitectura, API/seguridad, asincronía/integración, observabilidad/pruebas y reproducibilidad.

## 2. Qué problema de negocio se modeló

Un solicitante reporta un incidente. Un agente N1 lo recibe; si el caso es crítico, excede la capacidad del nivel o entra en riesgo de SLA, un supervisor lo escala a N2 y luego, como máximo, N3. El sistema debe conservar quién lo atendió, cuándo se escaló y por qué, y avisar a un canal externo sin hacer depender la operación principal de ese canal.

Las entidades centrales son:

- `Usuario`: solicitante o supervisor.
- `Agente`: responsable N1/N2/N3, activo o inactivo.
- `Ticket`: agregado que concentra estado, prioridad, nivel, SLA y responsable.
- `SlaPolicy`: tiempos configurables por prioridad.
- `Escalamiento`: historial inmutable de cambio de nivel.
- `Comentario`: seguimiento y resolución.
- `EventoOutbox`: evento pendiente/confirmado hacia RabbitMQ.
- `Notificacion`: efecto persistido por el consumidor.

“Agregado” significa que `Ticket` es la raíz sobre la cual se preservan invariantes. No se cambia nivel creando filas sueltas: el servicio coordina ticket, escalamiento y evento en una unidad atómica.

## 3. Recorrido de punta a punta

Tomemos `POST /api/v1/tickets/{id}/escalamientos`.

### 3.1 Entrada HTTP

En `src/routes/tickets.js` se compone la cadena de middleware:

1. `requireScopes('write:tickets', 'assign:tickets')` valida JWT y exige **ambos** scopes.
2. `validate(idParams, 'params')` comprueba que el ID sea UUID.
3. `validate(escalamientoCreate)` exige motivo, limita longitud y rechaza campos desconocidos.
4. El handler llama a `ticketService.escalate`.

El router se limita a semántica HTTP: seguridad, validación, códigos y cuerpo. Las reglas no se duplican allí.

### 3.2 Reglas de dominio

`src/services/escalationRules.js` es deliberadamente independiente de Express y Prisma. Valida:

- estado `ASIGNADO`, `EN_PROGRESO` o `ESCALADO`;
- agente asignado existente y activo;
- nivel del agente igual a `nivelActual`;
- existencia del siguiente nivel (N1→N2, N2→N3; nunca N3→N4);
- SLA con minutos positivos y vencimiento calculado;
- prioridad `ALTA/CRITICA` o entrada en ventana de riesgo para `MEDIA/BAJA`.

La ventana se calcula así:

```text
atRiskAt = venceSlaAt - minutosPrimeraRespuesta
```

Esta función es pura: recibe ticket/fecha y devuelve el nivel destino o lanza un error de negocio. Por eso se prueba rápido sin base de datos.

### 3.3 Transacción

`src/services/ticketService.js` usa `$transaction(..., { isolationLevel: 'Serializable' })`:

1. lee ticket, agente asignado y SLA;
2. ejecuta las reglas anteriores;
3. busca o valida un agente activo del nivel siguiente;
4. inserta `Escalamiento`;
5. actualiza `Ticket` y aumenta `version`;
6. inserta `EventoOutbox` con correlation ID y payload;
7. confirma todo junto.

Además del aislamiento serializable se usa control optimista:

```text
UPDATE ticket
WHERE id = ? AND version = versionLeida
SET ..., version = version + 1
```

Si otra solicitud cambió el ticket, `updateMany` actualiza cero filas y se devuelve `409`. La transacción revierte también el historial que acababa de insertar.

¿Por qué ambos mecanismos? `Serializable` protege la unidad de trabajo a nivel DB; `version` hace explícito el conflicto del agregado y permite responder con un mensaje comprensible.

### 3.4 Outbox y publicación

El problema del “dual write” es importante para la defensa:

- DB primero, broker después: si el proceso cae entre ambos, hay escalamiento sin evento.
- broker primero, DB después: puede notificarse algo que finalmente se revirtió.

La outbox resuelve la atomicidad local: el evento se escribe en PostgreSQL dentro del mismo commit. `src/messaging/outboxPublisher.js` busca filas sin `publicadoEn`, arma el envelope y llama a RabbitMQ.

`src/messaging/rabbit.js` usa confirm channel. Solo después de `waitForConfirms()` se marca el evento como publicado. Si RabbitMQ está caído, el ticket sigue correctamente escalado y el evento permanece pendiente para el próximo polling.

Existe todavía una ventana de duplicado: RabbitMQ puede confirmar y el proceso puede caer antes de marcar `publicadoEn`. Eso es inevitable sin transacción distribuida; se resuelve haciendo idempotente al consumidor.

### 3.5 Broker y consumidor

RabbitMQ contiene:

- exchange topic `mesa-ayuda.eventos`;
- cola durable `mesa-ayuda.notificaciones`;
- bindings para `ticket.escalado` y `ticket.cerrado`;
- dead-letter exchange/queue;
- ACK manual y `prefetch(5)`.

El worker (`worker/index.js`) procesa con semántica at-least-once:

1. parsea y valida campos mínimos del envelope;
2. busca `Notificacion` por `eventoId`;
3. si ya está `ENVIADA`, hace ACK sin repetir efecto;
4. si es nueva, crea `PENDIENTE`;
5. incrementa intentos y envía webhook;
6. en `2xx`, marca `ENVIADA` y ACK;
7. ante fallo, reencola mientras haya menos de tres intentos;
8. al tercer fallo, NACK sin requeue y RabbitMQ la mueve a DLQ.

La restricción única sobre `eventoId` es la base técnica de la idempotencia.

### 3.6 Webhook

El worker calcula:

```text
signature = hex(HMAC-SHA256(WEBHOOK_SECRET, rawBody))
```

y envía:

```text
X-Signature-256: sha256=<signature>
X-Event-Id: <uuid>
X-Correlation-Id: <id>
```

El receptor usa el **body crudo**. No puede verificar sobre `JSON.stringify(req.body)` porque el parseo/reserialización podría cambiar espacios u orden de propiedades. Compara los bytes con `timingSafeEqual` para no revelar progresivamente qué parte del HMAC coincide.

HMAC da autenticidad e integridad, no confidencialidad. En producción también se necesita HTTPS. Como mejora contra replay se agregaría tolerancia temporal y un nonce persistido.

### 3.7 Efecto observable

La consigna no se satisface diciendo “el mensaje llegó”. Se ve en cuatro lugares:

- `GET /api/v1/tickets/{id}/notificaciones` devuelve la fila creada por el worker;
- `GET :4000/webhooks/mesa-ayuda/recepciones` muestra el evento aceptado;
- RabbitMQ muestra publish/deliver/ack y la cola;
- logs del worker muestran `eventId`, `type`, `correlationId` y status del webhook.

## 4. Seguridad en profundidad

### 4.1 OAuth 2.0 no es lo mismo que JWT

OAuth 2.0 es el protocolo de autorización. En este proyecto se usa el grant `client_credentials`: una aplicación M2M se autentica ante Auth0 y obtiene un access token para una audience.

JWT es el formato autocontenido del access token. La API actúa como Resource Server.

El proyecto no implementa login humano. Eso es correcto para esta consigna, pero no debería describirse `client_credentials` como “el agente inicia sesión”: quien obtiene el token es un cliente de software.

### 4.2 Qué valida la API

`express-oauth2-jwt-bearer` con `issuerBaseURL`, `audience` y `RS256` valida:

- **firma**: la clave pública proviene del JWKS de Auth0;
- **issuer** (`iss`): evita aceptar tokens de otro tenant;
- **audience** (`aud`): evita usar en esta API un token emitido para otra;
- **expiración** (`exp`): un token vencido no sirve;
- estructura y algoritmo esperados.

Luego `requiredScopes([...])` comprueba el claim `scope`.

### 4.3 Matriz de permisos

| Scope | Operaciones |
|---|---|
| `read:tickets` | GET tickets/usuarios/comentarios/notificaciones. |
| `write:tickets` | crear/editar tickets y usuarios; comentarios. |
| `assign:tickets` | CRUD agentes, asignación y escalamiento. |
| `close:tickets` | cierre de tickets resueltos. |

Escalar requiere `write:tickets` **y** `assign:tickets`. Un JWT válido sin uno de ellos recibe `403`.

### 4.4 API key

`x-api-key` aparece porque la consigna lo pide como comparación. Se usa en endpoints internos y se compara con `timingSafeEqual`. Sus límites:

- no transporta identidad ni scopes;
- suele ser de larga duración;
- requiere rotación y almacenamiento seguro;
- si se filtra, el servidor no distingue quién la usó.

Por eso no reemplaza OAuth/JWT.

### 4.5 Otras defensas implementadas

- body máximo de 100 KB;
- validación estricta: tipos, UUID, email, enum, longitud y campos extra;
- secretos y tokens redactados de logs;
- errores uniformes sin stack trace al cliente;
- correlation ID limitado a caracteres/longitud seguros;
- secretos solo por variables de entorno.

## 5. Diseño REST y semántica HTTP

Los CRUD usan recursos plurales. Acciones con reglas propias son subrecursos:

- `/tickets/{id}/asignacion`
- `/tickets/{id}/escalamientos`
- `/tickets/{id}/cierre`

Se usa `POST` porque crean una transición/historial y no son idempotentes por naturaleza. Los códigos principales son:

- `200`: lectura/actualización/acción completada;
- `201`: recurso o escalamiento creado;
- `204`: borrado sin body;
- `400`: forma/validación inválida;
- `401`: credencial ausente o inválida;
- `403`: identidad válida sin permiso;
- `404`: recurso inexistente;
- `409`: conflicto con estado o invariante;
- `503`: health degradado.

Los errores siguen `application/problem+json` (RFC 9457) con `type`, `title`, `status`, detalle/campos y `correlationId`.

El borrado se restringe cuando hay historial. Esto no “rompe” CRUD: el endpoint DELETE existe, pero aplica reglas de integridad/auditoría. Para agentes en uso se prefiere desactivar.

## 6. Persistencia, migraciones y seed

Prisma cumple tres funciones:

- modelo tipado y relaciones;
- cliente de acceso;
- migraciones reproducibles.

La API ejecuta `prisma migrate deploy`, que aplica migraciones ya versionadas; no genera nuevas migraciones en producción. Después ejecuta el seed idempotente.

El seed usa `upsert` para claves naturalmente únicas (email/prioridad). Poder ejecutarlo varias veces sin duplicar hace que el entorno sea reproducible.

Decisiones importantes:

- PostgreSQL encaja por relaciones, FKs y transacciones.
- El SLA referencia una política para no repetir parámetros en cada ticket.
- Escalar no reinicia `venceSlaAt`; hacerlo podría ocultar un incumplimiento.
- `actualizadoEn` usa `@updatedAt` de Prisma.

## 7. Observabilidad

### 7.1 Logs

Pino genera JSON estructurado, mejor que texto libre porque una plataforma puede filtrar por campos. Un correlation ID se genera/acepta en la API, se devuelve en el header y viaja dentro del evento y webhook.

Una investigación típica busca el mismo ID en:

1. log de request API;
2. publicación outbox;
3. consumo worker;
4. log del webhook receiver.

### 7.2 Métricas

La API registra:

- contador por método, plantilla de ruta y status;
- histograma de duración por esas etiquetas;
- tickets creados/escalados;
- errores de negocio.

Se etiqueta `/tickets/:id`, no el UUID concreto. Poner IDs produciría alta cardinalidad: una serie temporal por ticket, con memoria creciente.

### 7.3 Por qué un histograma para p95

El promedio no muestra cola: 95 requests de 10 ms y 5 de 5 s pueden dar un promedio que oculta la experiencia lenta. p95 responde “el 95 % terminó por debajo de este valor”. Prometheus aproxima el percentil desde buckets:

```promql
histogram_quantile(
  0.95,
  sum(rate(mesa_ayuda_http_request_duration_seconds_bucket[5m])) by (le)
)
```

Throughput es tasa de requests; error rate es proporción de `5xx`. Los `4xx` se grafican por código pero no se cuentan como falla del servidor en el panel principal.

## 8. Estrategia de pruebas

La pirámide del proyecto tiene tres niveles:

1. **Unitarios**: reglas puras, validación, scopes y HMAC; rápidos, deterministas, 15 tests.
2. **E2E Postman**: infraestructura real, Auth0, CRUD, transacción, broker, worker, webhook y API key.
3. **Carga JMeter**: 600 requests autenticados; mide p95, throughput y errores.

`npm run validate:artifacts` comprueba que archivos de entrega se puedan parsear. No sustituye un linter semántico completo de OpenAPI, pero detecta roturas estructurales básicas.

El reporte de carga está deliberadamente sin números hasta ejecutar con el tenant real. En una defensa es preferible decir “esta evidencia se generó así” y mostrarla, no presentar resultados fabricados.

## 9. Reproducibilidad con Docker

Cada proceso propio tiene Dockerfile:

- raíz: API;
- `worker/Dockerfile`: consumidor;
- `webhook-receiver/Dockerfile`: canal simulado.

PostgreSQL, RabbitMQ, Prometheus y Grafana usan imágenes oficiales con tags. Compose declara healthchecks y dependencias para no iniciar la API antes de DB/broker.

Los lockfiles permiten `npm ci`; a diferencia de `npm install`, instala exactamente el árbol resuelto. Los volúmenes preservan DB, broker y métricas entre reinicios.

## 10. Mapa del repositorio

```text
src/
  app.js                    composición HTTP
  server.js                 inicio y apagado ordenado
  routes/                   contrato HTTP
  validation/schemas.js     validación Zod
  services/                 reglas/casos de uso
  messaging/                RabbitMQ y outbox
  middleware/               auth, API key, métricas, errores, correlación
prisma/
  schema.prisma             modelo
  migrations/               evolución reproducible
  seed.js                   datos iniciales
worker/                     consumidor y Dockerfile propios
webhook-receiver/           integración externa simulada
observability/              Prometheus y provisioning Grafana
tests/postman/              colección + ambiente sin secretos
tests/load/                 plan JMeter
test/unit/                  tests Node
docs/                       OpenAPI, C4, ADRs, pruebas y evidencias
```

## 11. Guion recomendado de demo — 7 minutos

### 0:00–0:40 — Arquitectura y salud

- Mostrar C4 Contenedores durante una frase.
- `docker compose ps` y `GET /health`.
- Señalar API, DB, RabbitMQ, worker, webhook y observabilidad.

### 0:40–1:30 — Seguridad

- Mostrar Auth0 API/audience/RS256/scopes, ocultando secretos.
- Ejecutar request sin token (`401`) y luego con token (`200`).
- Si hay tiempo, token válido sin scope (`403`).
- Mostrar `x-api-key` en `/internal/sla-policies` como comparación.

### 1:30–3:30 — Flujo de negocio

- Ejecutar la colección desde crear usuario/agentes/ticket.
- Asignar N1.
- Escalar ticket crítico a N2.
- Mostrar respuesta con ticket, escalamiento y event ID.
- Explicar en una frase la transacción y outbox.

### 3:30–4:50 — Asincronía e integración

- Abrir RabbitMQ: cola y consumer.
- Consultar `/notificaciones`: estado `ENVIADA` y mismo event ID.
- Consultar recepciones del webhook o mostrar log con firma válida.
- Seguir el mismo correlation ID en API/worker/receptor.

### 4:50–6:00 — Observabilidad

- Abrir dashboard Grafana.
- Señalar p95, throughput y error rate.
- Disparar algunas requests o mostrar la ejecución JMeter reflejada.

### 6:00–7:00 — Pruebas y cierre

- Mostrar runner Postman verde, `npm test` y reporte JMeter.
- Nombrar decisiones: PostgreSQL, RabbitMQ, outbox, HMAC.
- Cerrar con dos limitaciones reales y una mejora.

No conviene explicar cada endpoint; la demo debe contar una historia completa.

## 12. Preguntas probables y respuestas breves

### “¿Por qué RabbitMQ y no Kafka?”

El caso necesita colas de trabajo, ACK/retry/DLQ y bajo volumen, no un log distribuido de streaming. RabbitMQ reduce complejidad y tiene management UI útil para la demo.

### “¿La transacción incluye RabbitMQ?”

No. Es una transacción PostgreSQL. La consistencia con RabbitMQ se logra con outbox y consumidor idempotente; no se usa transacción distribuida.

### “¿Puede duplicarse un mensaje?”

Sí, la entrega es at-least-once. `eventoId UNIQUE` y la verificación de estado evitan repetir el efecto ya completado.

### “¿Qué pasa si RabbitMQ está caído?”

El negocio confirma y el evento queda con `publicadoEn = null`. El publisher lo reintenta cuando vuelve la conexión. Health queda degradado.

### “¿Qué pasa si el webhook está caído?”

El worker registra el intento, reencola hasta tres veces y finalmente envía a DLQ. El ticket no se revierte porque la notificación es eventual.

### “¿Por qué no resetear el SLA al escalar?”

Porque el compromiso de resolución corresponde al incidente original. Resetearlo permitiría ocultar demoras mediante escalaciones.

### “¿Cuál es la diferencia entre 401 y 403?”

401: no hay credencial válida. 403: el JWT es válido pero no concede el scope requerido.

### “¿Por qué validar audience además de firma?”

Una firma válida solo prueba que Auth0 emitió el token. Audience prueba que lo emitió para esta API.

### “¿Por qué API key no alcanza?”

No expresa identidad, expiración ni permisos granulares. Es un secreto compartido útil en un caso interno acotado, no el esquema principal.

### “¿Cómo se calcula p95?”

Desde el histograma de duración con `histogram_quantile(0.95, ...)`, agregado por bucket. No se promedian percentiles.

### “¿Por qué Zod si Prisma ya tipa?”

Prisma protege la interacción del código con la DB; no valida que un JSON externo tenga forma, longitud y campos permitidos antes de llegar al servicio.

### “¿Por qué el webhook firma el raw body?”

El HMAC opera sobre bytes. Parsear y volver a serializar puede producir bytes distintos aunque el JSON represente lo mismo.

### “¿Cómo evitaron filtrar secretos?”

`.env` ignorado, ejemplos sin credenciales, ambiente Postman placeholder y redacción de `Authorization`/`x-api-key` en logs. Los secretos reales se cargan solo localmente.

## 13. Limitaciones que conviene reconocer

- Auth0/JWKS requiere conectividad externa y configuración previa.
- No hay replay UI para la DLQ.
- La tabla outbox necesita limpieza periódica en una operación prolongada.
- Historial del webhook receiver es en memoria; la notificación durable está en PostgreSQL.
- `/metrics` y el historial de recepciones son públicos dentro del Compose local.
- No hay tracing OpenTelemetry ni despliegue cloud porque son bonos optativos.
- Falta ejecutar y adjuntar evidencia real de Postman/JMeter/Grafana con credenciales del equipo.

Reconocer una limitación junto con su mitigación demuestra control técnico; ocultarla suele generar preguntas más difíciles.

## 14. Checklist del día anterior

- [ ] `.env` real funciona y no está trackeado.
- [ ] Los cuatro scopes están asignados al cliente M2M.
- [ ] `docker compose up --build -d` arranca desde cero.
- [ ] Health devuelve `ok`.
- [ ] Colección Postman completa en verde.
- [ ] Reporte JMeter real adjunto.
- [ ] Dashboard muestra tráfico de esa prueba.
- [ ] Se puede enseñar un correlation ID de extremo a extremo.
- [ ] Se probó una firma inválida (`401`).
- [ ] Se conoce usuario/clave local de RabbitMQ y Grafana.
- [ ] README tiene tag y SHA finales.
- [ ] ZIP se descargó desde la release correcta y no contiene `.env`.
- [ ] Las tres integrantes ensayaron respuestas, no solo la persona que programa.

## 15. Reparto sugerido para estudiar

- Persona A: REST, CRUD, Prisma, transacción y reglas SLA.
- Persona B: Auth0, OAuth/JWT, scopes, API key y HMAC.
- Persona C: RabbitMQ, outbox, worker/idempotencia, observabilidad y pruebas.

Luego roten: cualquiera debe poder explicar el recorrido completo en dos minutos, porque las preguntas de la defensa no necesariamente respetan el reparto de la demo.
