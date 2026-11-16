# Reporte de prueba de carga — 16/11/2026

Corrida real realizada a las 14:44 ART en el entorno local Windows con Docker Desktop, API 1.1.0 en Compose y JWT emitido por Auth0 mediante `client_credentials`. Los datos provienen de `results.jtl` y `html/statistics.json`, incluidos en [`carga/jmeter-carga-2026-11-16-final.zip`](carga/jmeter-carga-2026-11-16-final.zip). El ZIP se revisó antes de incluirlo: no contiene Client ID, Client Secret ni JWT. Esta corrida también verificó el script `run-load-test.ps1` corregido.

## Escenario

- Herramienta: Apache JMeter 5.6.3.
- Endpoint: `GET /api/v1/tickets?limit=50` con JWT real.
- Usuarios virtuales: 20.
- Ramp-up: 10 segundos.
- Iteraciones: 30 por usuario.
- Total esperado: 600 requests.

## Resultados medidos

| Métrica | Resultado real |
|---|---:|
| Requests ejecutados | 600 |
| Throughput JMeter | 61,69 req/s |
| Latencia media | 14,76 ms |
| Latencia p90 | 18 ms |
| Latencia p95 | 20 ms |
| Latencia p99 | 26 ms |
| Latencia máxima | 85 ms |
| Tasa de errores | 0 % (0/600) |

Las 600 muestras respondieron HTTP `200`; no hubo `5xx`. JMeter aplica 20 usuarios virtuales, ramp-up de 10 segundos y 30 iteraciones por usuario. Estas cifras describen **esta máquina y este escenario**, no una promesa de rendimiento en producción.

## Criterio de aceptación del equipo

- Error rate menor al 1 %.
- p95 menor a 500 ms en el equipo de demo local.
- Sin respuestas `5xx`.
- Sin crecimiento sostenido de mensajes pendientes en `mesa-ayuda.notificaciones`.

Todos los criterios se cumplieron en esta corrida. Al finalizar, RabbitMQ mostraba cero mensajes pendientes en la cola principal, las tres colas de reintento y la DLQ; la cola principal tenía un consumidor.

## Observabilidad correlacionada

Prometheus/Grafana registró la misma ventana de carga: el throughput máximo calculado con `rate(...[1m])` fue 11,02 req/s, el p95 del histograma `rate(...[5m])` varió entre 4,92 y 23,87 ms, y la tasa de respuestas `5xx` fue 0 %. El throughput de Grafana no debe confundirse con los 61,69 req/s de JMeter: la consulta promedia la ráfaga en una ventana móvil. Tampoco son idénticos los p95 de JMeter (muestras individuales) y Grafana (aproximación desde buckets y ventana temporal).

La API emitió logs JSON de solicitudes de carga con `correlationId` como `jmeter-1-1`, `statusCode: 200` y `responseTime: 18`. El campo `authorization` apareció como `[Redacted]`, por lo que el JWT no se expuso en el log.

## Archivos de evidencia

- [`carga/jmeter-carga-2026-11-16-final.zip`](carga/jmeter-carga-2026-11-16-final.zip): JTL de 600 muestras y reporte HTML completo de JMeter.
- [`verificacion-2026-11-15.md`](verificacion-2026-11-15.md): demás pruebas y comprobaciones locales.
- Capturas de Grafana y del reporte JMeter: ver el [índice de evidencias](README.md).
