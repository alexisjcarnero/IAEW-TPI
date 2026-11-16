# Evidencias de la entrega

Artefactos de las pruebas y capturas reales del entorno local, sin tokens ni credenciales:

- [Postman/Newman](newman-2026-11-15.md): corrida completa con 20 requests y 20 aserciones aprobadas.
- [Reporte de carga](reporte-carga.md) y [JTL + HTML](carga/jmeter-carga-2026-11-16-final.zip): 600 requests autenticados, 0 errores y p95 de 20 ms. [Cómo repetir la prueba](carga/README.md).
- [Auth0: cuatro scopes](capturas/auth0-api-scopes.png).
- [RabbitMQ: cola principal, reintentos y DLQ](capturas/rabbitmq-flujo.png).
- [Grafana: throughput, p95, tasa 5xx y métricas del dominio](capturas/grafana-carga.png).

El [README raíz](../../README.md) explica cómo levantar el sistema y ejecutar los tests. Las capturas muestran el estado observado; el JTL/HTML conserva los datos crudos de carga. Los resultados locales no garantizan el mismo rendimiento en otra máquina.
