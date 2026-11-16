# Evidencia de prueba de carga

El plan versionado está en [`tests/load/mesa-ayuda.jmx`](../../../tests/load/mesa-ayuda.jmx). Ejecuta 20 usuarios virtuales, 10 segundos de ramp-up y 30 iteraciones por usuario: **600 requests autenticados** a `GET /api/v1/tickets`.

La corrida final válida del 16/11/2026 está archivada en [`jmeter-carga-2026-11-16-final.zip`](jmeter-carga-2026-11-16-final.zip): incluye `results.jtl` y el reporte HTML. Sus cifras se explican en [`../reporte-carga.md`](../reporte-carga.md).

Para repetir la prueba con un JWT nuevo, sin mostrar el token, completar el `.env` local ignorado por Git y ejecutar en Windows:

```powershell
node scripts/run-load-with-auth0.js "C:\ruta\a\jmeter.bat"
```

Como alternativa, si ya se dispone de un JWT local:

```powershell
$env:ACCESS_TOKEN = "JWT_REAL_NO_VERSIONAR"
./scripts/run-load-test.ps1
```

Si JMeter no está en `PATH`, pasar `-JMeterExecutable "C:\ruta\a\jmeter.bat"`. Cada ejecución crea una carpeta `run-AAAAMMDD-HHMMSS`, sin borrar corridas anteriores.

Cada corrida nueva crea su propia carpeta `run-AAAAMMDD-HHMMSS`, ignorada por Git para evitar agregar archivos voluminosos. El script falla si no hay 600 muestras o si la tasa de errores alcanza el 1 %. Para incorporar una nueva evidencia al repositorio, revisar antes que el JTL/HTML no contenga credenciales ni tokens.

Luego:

1. Abrir `docs/evidencias/carga/run-AAAAMMDD-HHMMSS/html/index.html` de la corrida correspondiente.
2. Comparar los valores con [`../reporte-carga.md`](../reporte-carga.md) y actualizarlo si se elige una nueva corrida final.
3. Capturar el dashboard Grafana durante la misma ejecución.
4. No versionar el JWT ni credenciales.
