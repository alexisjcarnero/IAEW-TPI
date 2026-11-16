# Evidencias de la entrega

Esta carpeta distingue artefactos reproducibles de capturas que requieren el entorno real del equipo.

## Versionado

- `reporte-carga.md`: mediciones reales de 600 requests y criterio de aceptación.
- `carga/jmeter-carga-2026-11-16-final.zip`: JTL y HTML de la corrida final válida, sin secretos.
- `carga/README.md`: procedimiento exacto para repetir JTL/HTML.
- `newman-2026-11-15.md`: resumen verificable de 20 requests y 20 aserciones con Auth0 real.
- `verificacion-2026-11-15.md`: resultados observados de tests, Compose y smoke tests reales; separa explícitamente lo pendiente.
- `observabilidad-2026-11-16.md`: resultados leídos de Prometheus, RabbitMQ, health y métricas de dominio durante la corrida final.
- `CAPTURAS-PENDIENTES.md`: pantallas precisas para fotografiar sin secretos; no se presentan como capturas ya tomadas.

## Capturas adicionales pendientes

- `postman-run.png`: captura opcional; el reporte resumido Newman ya está archivado.
- `grafana-carga.png` con p95, throughput y error rate visibles.
- `rabbitmq-flujo.png` con cola, consumers y mensajes.
- `auth0-api-scopes.png` sin client secret ni token.
- reporte HTML/JTL de JMeter: ya incluido en el ZIP de evidencia final.
- El tag, commit SHA y fecha se documentarán en el README y en `release.txt` al publicar.

Las capturas deben corresponder a una ejecución real. No se incluyen placeholders gráficos que puedan confundirse con evidencia.
