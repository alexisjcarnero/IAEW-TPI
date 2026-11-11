# Evidencia de prueba de carga

El plan versionado está en [`tests/load/mesa-ayuda.jmx`](../../../tests/load/mesa-ayuda.jmx). Ejecuta 20 usuarios virtuales, 10 segundos de ramp-up y 30 iteraciones por usuario: **600 requests autenticados** a `GET /api/v1/tickets`.

Los resultados reales no se versionan hasta ejecutar el entorno con el tenant Auth0 del equipo. Para generarlos:

```powershell
$env:ACCESS_TOKEN = "JWT_REAL_NO_VERSIONAR"
./scripts/run-load-test.ps1
```

Luego:

1. Abrir `docs/evidencias/carga/html/index.html`.
2. Completar [`../reporte-carga.md`](../reporte-carga.md) con los valores reales.
3. Capturar el dashboard Grafana durante la misma ejecución.
4. No versionar el JWT ni credenciales.
