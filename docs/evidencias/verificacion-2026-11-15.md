# Verificación técnica local — 15/11/2026, ampliada el 16/11

Este registro distingue pruebas ejecutadas de tareas de presentación pendientes. Se realizó en Windows con Docker Desktop 4.87.0 (motor 29.7.2), Node.js 24.19, Auth0 del equipo y la configuración local de Compose. No contiene credenciales ni tokens.

## Resultados ejecutados

| Verificación | Resultado observado |
|---|---|
| `npm test` | 26/26 aprobados: reglas, transacciones simuladas, HTTP local, HMAC, topología, backoff y métricas de dominio. |
| `npm run validate:artifacts` | OpenAPI, Compose, observabilidad, Postman, Grafana y JMeter válidos estructuralmente; incluye compilación de scripts Postman. |
| `npm audit --audit-level=moderate` | 0 vulnerabilidades conocidas al momento de la corrida. |
| `npx prisma validate` | Esquema válido. |
| `docker compose config --quiet` | Configuración válida. |
| `docker compose up --build -d` | Compilaron API, worker y receptor; arrancaron los siete servicios. |
| `npx prisma migrate status` contra PostgreSQL local | Dos migraciones presentes; esquema de la base al día. |
| Salud API | `GET /health` → `200`, `status=ok`, DB y broker `up`. |
| Salud de integraciones | Webhook, worker, Prometheus y Grafana respondieron `200` en sus endpoints de salud. |
| Seguridad negativa | `GET /api/v1/tickets` sin JWT → `401`; endpoint interno sin API key → `401`. |
| API key local de ejemplo | Consulta de políticas SLA → `200`, cuatro políticas sembradas. No se probó una credencial de producción. |
| Prometheus | Objetivos API, worker y webhook `up`; consultas de throughput, p95 y errores devuelven series. |
| Grafana | Dashboard provisionado: `Mesa de ayuda - API y eventos` (`uid=mesa-ayuda-iaew`). |
| RabbitMQ | Cola principal, DLQ y colas de reintento durables; TTL de 2.000, 4.000 y 8.000 ms. Después del smoke test: cola principal con un consumidor y cero mensajes pendientes. |
| `node scripts/smoke-webhook.js` | Firma inválida `401`, válida `202`, duplicado `200`, recepción visible. |
| `node scripts/smoke-business.js` | Ticket escalado y luego cerrado en PostgreSQL; dos eventos de outbox publicados; dos notificaciones `ENVIADA`; ambos webhooks `202` y recepción visible. Estado final `CERRADO`. |
| Auth0 JWKS público | El Domain del tenant respondió `200` en `/.well-known/jwks.json`; API local recreada con `AUTH0_DOMAIN` y `AUTH0_AUDIENCE` en `.env` ignorado por Git. |
| Auth0/JWT real | `client_credentials` emitió JWT; API respondió `200` con token válido, `401` sin token y `401` con firma alterada. El cliente M2M actual tiene los cuatro scopes; un `403` real con scopes insuficientes requiere otro cliente limitado y no es requisito literal de la consigna. |
| Postman/Newman 6.2.3 | Colección completa: 20 requests, 20 assertions, cero fallos. Ver [`newman-2026-11-15.md`](newman-2026-11-15.md). |
| Apache JMeter 5.6.3 | ZIP oficial descargado, SHA-512 verificado; corrida final autenticada del 16/11 con el script corregido: 600 requests, cero errores, 61,69 req/s y p95 20 ms. Ver [`reporte-carga.md`](reporte-carga.md). |
| Logs y cola tras carga | JSON con `correlationId=jmeter-1-1`, `authorization=[Redacted]`; RabbitMQ principal/reintentos/DLQ sin mensajes pendientes. |

El smoke de negocio utiliza los servicios reales, pero llama a la capa de servicio directamente. Por eso demuestra transacción, outbox, broker, consumidor y webhook, **no** demuestra REST ni JWT. Esa parte sí quedó cubierta por la corrida Newman posterior. La suite de 26 pruebas tampoco sustituye una corrida punta a punta.

El 16/11 se agregaron y verificaron tres indicadores de dominio. `/metrics` respondió con tickets activos, tickets vencidos y tiempo medio hasta cierre; Grafana provisionó ocho paneles. El tiempo hasta cierre es una aproximación explícita al tiempo de resolución, porque el modelo no conserva la marca de `RESUELTO`.

## Pendiente para presentación y entrega

1. Capturar Grafana, RabbitMQ y configuración de scopes de Auth0 sin mostrar secretos, si se desean evidencias visuales adicionales.
2. Opcional: crear un segundo cliente M2M de solo lectura para demostrar `403` con un JWT auténtico de scope insuficiente. La autorización ya está cubierta por código y tests unitarios, pero esta prueba negativa en vivo reforzaría la defensa.
3. Ensayar y registrar la demo de siete minutos; cerrar README con el nuevo tag, SHA y ZIP. El tag histórico `v1.0.0` no se moverá, por decisión del equipo.

Los servicios locales permanecen levantados para continuar las pruebas. Los valores por defecto de Compose son sólo para desarrollo local y deben reemplazarse antes de exponer el entorno en una red compartida.
