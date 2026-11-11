# ADR 0007 — Métricas Prometheus y dashboard Grafana

- **Estado:** Aceptada
- **Fecha:** 2026-11-10

## Contexto

La consigna exige logs JSON y un dashboard con latencia p95, throughput y tasa de errores. Calcular p95 correctamente requiere una distribución, no un promedio.

## Decisión

Instrumentar la API con contador de requests e histograma de duración; el worker y receptor exponen contadores propios. Prometheus scrapea cada 5 segundos y Grafana se provisiona desde archivos versionados.

Las etiquetas HTTP usan plantillas de ruta (`/tickets/:id`) en vez de IDs reales para evitar cardinalidad no acotada.

## Alternativas consideradas

- Solo logs: sirven para diagnóstico, pero dificultan percentiles y series temporales.
- StatsD: liviano, pero requiere agregador adicional y no mejora la demo local.
- OpenTelemetry completo: aporta trazas distribuidas como bono, pero no es obligatorio y aumenta componentes.

## Consecuencias

- p95 se calcula con `histogram_quantile` sobre buckets.
- Prometheus/Grafana agregan consumo local y dos servicios al Compose.
- `/metrics` debe quedar en red interna en un despliegue real.
