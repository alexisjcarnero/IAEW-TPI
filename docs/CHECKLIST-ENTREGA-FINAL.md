# Checklist de entrega final

Estado al 10/11/2026. “Implementado” significa presente y validado estáticamente/unitariamente en el repositorio; “requiere ejecución” depende del entorno Docker/Auth0 real del equipo.

| Exigencia | Estado | Evidencia/archivo |
|---|---|---|
| API REST operativa | Implementado | `src/`, `docs/api/openapi.yaml` |
| CRUD de dos entidades | Implementado | Tickets y agentes; usuarios adicional. |
| Transacción multi-paso | Implementado | `ticketService.escalate`, reglas SLA, serializable + version. |
| OAuth 2.0/JWT | Implementado; requiere tenant | `middleware/auth0.js`, README, Postman. |
| Firma, issuer, audience, exp | Implementado por biblioteca | Configuración explícita RS256/issuer/audience. |
| Autorización por scopes | Implementado | read/write/assign/close; escalamiento exige dos. |
| API key | Implementado | SLA interno y DELETE usuario. |
| Productor → broker → consumidor | Implementado | Outbox, RabbitMQ, worker. |
| Efecto observable | Implementado | `Notificacion` + endpoint + logs. |
| Integración adicional | Implementado | Webhook HMAC + receptor y tests. |
| Docker por servicio | Implementado | API, worker y receiver con Dockerfile. |
| Docker Compose | Estructura validada; requiere ejecución | Siete servicios y healthchecks. |
| Migraciones/seed | Implementado | Dos migraciones + seed idempotente automático. |
| README raíz | Implementado; falta release final | `README.md`. |
| OpenAPI 3.1 | Implementado y validado | 23 operaciones/operationIds. |
| C4 Context/Container/Component | Implementado | `docs/c4/`. |
| ADRs | Implementado | Siete ADRs + template. |
| Logs JSON y correlation ID | Implementado | API/worker/receiver. |
| Dashboard p95/throughput/error rate | Provisionado; requiere captura real | `observability/`. |
| Postman con ambiente | Implementado; requiere corrida real | `tests/postman/`. |
| Prueba de carga | Plan y script implementados; requiere corrida real | `tests/load/`, `scripts/run-load-test.ps1`. |
| Reporte de carga | Plantilla honesta; faltan números | `docs/evidencias/reporte-carga.md`. |
| Evidencias Auth0/Rabbit/Grafana | Requiere ejecución/capturas | `docs/evidencias/README.md`. |
| Tag y commit final | Pendiente | Este avance se publica sin tag ni release; `v1.0.0` y `v1.0.1` no se modifican. |
| ZIP de release | Pendiente al cierre | Descargar después del commit/tag final. |

## Verificaciones ya ejecutadas

- `npm test`: 15/15.
- `npm audit`: 0 vulnerabilidades conocidas.
- `npx prisma validate`: esquema válido.
- `npm run validate:artifacts`: OpenAPI/Compose/observabilidad/Postman/Grafana/JMeter parseables.
- Redocly CLI: contrato OpenAPI válido; se agregaron operationIds y descripciones después de la primera pasada.
- Tags de imágenes Prometheus, Grafana y RabbitMQ: respondieron HTTP 200 en Docker Hub.
- `node --check`: fuentes JavaScript sin errores sintácticos.

## Acciones humanas imprescindibles

1. Definir la versión y estrategia de tag de la entrega final con la cátedra/equipo.
2. Crear/configurar tenant Auth0 y completar `.env` local.
3. Ejecutar Compose en una máquina con Docker.
4. Correr Postman y JMeter; completar reporte con valores reales.
5. Tomar capturas sin secretos.
6. Ensayar el guion de siete minutos.
7. Commit final, SHA en README, tag, release y ZIP.
