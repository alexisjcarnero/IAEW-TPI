# Observabilidad verificada — 16/11/2026

Comprobaciones realizadas contra los siete servicios de Docker Compose, en la máquina de demo. Este registro contiene **valores leídos de los servicios**, no imágenes recreadas ni promesas de rendimiento futuro.

## Estado y efecto observable

- `GET http://localhost:3000/health`: `{"status":"ok","db":"up","broker":"up"}`.
- Prometheus `/api/v1/targets`: los jobs `mesa-ayuda-api`, `mesa-ayuda-webhook` y `mesa-ayuda-worker` estaban `up`.
- RabbitMQ `rabbitmqctl list_queues name messages consumers`: cola `mesa-ayuda.notificaciones` con **1 consumidor y 0 mensajes**; reintentos de 2, 4 y 8 segundos y DLQ con **0 mensajes**. La prueba funcional sí confirmó previamente una notificación `ENVIADA` y un webhook recibido.
- El dashboard Grafana provisionado `mesa-ayuda-iaew` tiene ocho paneles: throughput, latencia p95, tasa de errores 5xx, requests por estado, flujo de negocio, tickets activos, tickets vencidos y tiempo medio hasta cierre.

## Misma ventana de la carga final

Ventana consultada: **16/11/2026 14:44:20–14:45:05 ART**, con pasos de 5 segundos. Se usaron las mismas expresiones PromQL que el dashboard:

| Consulta | Observado |
|---|---:|
| `sum(rate(mesa_ayuda_http_requests_total[1m]))` | máximo 11,02 req/s |
| `histogram_quantile(0.95, sum(rate(mesa_ayuda_http_request_duration_seconds_bucket[5m])) by (le))` | entre 4,92 y 23,87 ms |
| tasa `5xx` sobre todas las respuestas, ventana 5 min | 0 % |

La ventana móvil de Prometheus diluye la ráfaga de JMeter; por eso sus 11,02 req/s máximos no son comparables directamente con los 61,69 req/s que calcula JMeter para sus 600 muestras. El p95 de Prometheus también es una aproximación basada en buckets; el p95 del JTL final fue **20 ms**.

En un scrape posterior, `/metrics` devolvió `mesa_ayuda_tickets_active 2`, `mesa_ayuda_tickets_overdue 2` y `mesa_ayuda_ticket_time_to_close_seconds_avg 2.07975`. Estos gauges son instantáneos y variarán al crear/cerrar tickets. El tiempo hasta cierre es una aproximación explícita al tiempo de resolución porque el esquema no guarda `resueltoEn`.

## Capturas visuales

Las mediciones anteriores son reproducibles y el [ZIP de JMeter](carga/jmeter-carga-2026-11-16-final.zip) conserva datos crudos y HTML. Las capturas de pantalla adicionales se describen en [CAPTURAS-PENDIENTES.md](CAPTURAS-PENDIENTES.md); solo se incorporarán archivos tomados de la interfaz real, sin secretos.
