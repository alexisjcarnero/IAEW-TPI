# Checklist de entrega final

Estado al 16/11/2026. La implementación se verificó con Docker, Auth0, Newman y JMeter en el entorno local; las capturas de apoyo y el cierre de la release se distinguen aparte.

| Exigencia | Estado | Evidencia/archivo |
|---|---|---|
| API REST operativa | Implementado | `src/`, `docs/api/openapi.yaml` |
| CRUD de dos entidades | Implementado | Tickets y agentes; usuarios adicional. |
| Transacción multi-paso | Implementado | `ticketService.escalate`, reglas SLA, serializable + version. |
| OAuth 2.0/JWT | Implementado y ejecutado con Auth0 real | `middleware/auth0.js`, README, Newman. |
| Firma, issuer, audience, exp | Implementado por biblioteca | Configuración explícita RS256/issuer/audience. |
| Autorización por scopes | Implementado | read/write/assign/close; escalamiento exige dos. |
| API key | Implementado | SLA interno y DELETE usuario. |
| Productor → broker → consumidor | Implementado | Outbox, RabbitMQ, worker. |
| Efecto observable | Implementado | `Notificacion` + endpoint + logs. |
| Integración adicional | Implementado | Webhook HMAC + receptor y tests. |
| Docker por servicio | Implementado | API, worker y receiver con Dockerfile. |
| Docker Compose | Ejecutado en Docker Desktop | Siete servicios levantados; ver `docs/evidencias/verificacion-2026-11-15.md`. |
| Migraciones/seed | Ejecutados en PostgreSQL local | Dos migraciones al día + cuatro políticas SLA sembradas. |
| README raíz | Implementado; falta release final | `README.md`. |
| OpenAPI 3.1 | Implementado y validado | 23 operaciones/operationIds. |
| C4 Context/Container/Component | Implementado | `docs/c4/`. |
| ADRs | Implementado | Siete ADRs + template. |
| Logs JSON y correlation ID | Implementado | API/worker/receiver. |
| Dashboard p95/throughput/error rate | Provisionado y consultas verificadas durante carga; falta captura visual | `observability/`, `docs/evidencias/reporte-carga.md`. |
| Postman con ambiente | Ejecutado: 20 requests y 20 assertions sin fallos | `tests/postman/`, `docs/evidencias/newman-2026-11-15.md`. |
| Prueba de carga | Ejecutada con JWT real: 600 requests, 0 errores | `tests/load/`, `scripts/run-load-with-auth0.js`. |
| Reporte de carga | Completo con p90/p95/p99 y JTL/HTML en ZIP | `docs/evidencias/reporte-carga.md`, `docs/evidencias/carga/jmeter-carga-2026-11-16-final.zip`. |
| Evidencias Auth0/Rabbit/Grafana | Verificadas por pruebas/logs/métricas; capturas visuales recomendables | `docs/evidencias/README.md`, `docs/evidencias/verificacion-2026-11-15.md`. |
| Tag y commit final | Pendiente | Se conservarán `v1.0.0` y `v1.0.1` históricos; nuevo tag para esta entrega. |
| ZIP de release | Pendiente al cierre | Descargar después del commit/tag final. |

## Verificaciones ya ejecutadas

- `npm test`: 26/26 (unitarios y de integración HTTP local, sin servicios externos).
- `npm audit`: 0 vulnerabilidades conocidas.
- `npx prisma validate`: esquema válido.
- `npm run validate:artifacts`: OpenAPI/Compose/observabilidad/Postman/Grafana/JMeter parseables.
- Redocly CLI: contrato OpenAPI válido; se agregaron operationIds y descripciones después de la primera pasada.
- Tags de imágenes Prometheus, Grafana y RabbitMQ: respondieron HTTP 200 en Docker Hub.
- `node --check`: fuentes JavaScript sin errores sintácticos.

## Acciones humanas imprescindibles

1. Tomar capturas de apoyo sin secretos y ensayar el guion de siete minutos.
2. Commit final, SHA en README, nuevo tag/release y ZIP; no mover los tags históricos.
