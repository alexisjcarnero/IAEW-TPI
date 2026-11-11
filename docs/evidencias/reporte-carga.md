# Reporte de prueba de carga — completar con ejecución real

> Estado al 10/11/2026: plan verificado como XML y listo para ejecución. Este equipo de trabajo no tiene Docker/JMeter ni credenciales Auth0 disponibles, por lo que no se fabrican resultados. Reemplazar este aviso después de ejecutar el procedimiento de `docs/PRUEBAS.md`.

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
| Requests ejecutados | PENDIENTE |
| Throughput | PENDIENTE req/s |
| Latencia media | PENDIENTE ms |
| Latencia p90 | PENDIENTE ms |
| Latencia p95 | PENDIENTE ms |
| Latencia p99 | PENDIENTE ms |
| Tasa de errores | PENDIENTE % |

## Criterio de aceptación del equipo

- Error rate menor al 1 %.
- p95 menor a 500 ms en el equipo de demo local.
- Sin respuestas `5xx`.
- Sin crecimiento sostenido de mensajes pendientes en `mesa-ayuda.notificaciones`.

## Evidencias a adjuntar

- Reporte HTML de JMeter (archivo externo al repositorio o ZIP de evidencias).
- Captura de Grafana con p95, throughput y tasa de errores.
- Extracto de logs JSON con `x-correlation-id` de una solicitud de carga.
