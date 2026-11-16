# Capturas para la defensa presencial

Estas capturas **todavía no forman parte del repositorio**. El intento de automatizar el navegador falló por indisponibilidad del controlador de ventanas; no se sustituyeron por imágenes fabricadas. Si el equipo puede tomarlas antes de descargar el ZIP final, adjuntar los PNG al repositorio y crear un nuevo tag/ZIP para que sí queden incluidos.

1. `grafana-carga.png`: abrir <http://localhost:3001>, dashboard **Mesa de ayuda - API y eventos**, mostrar p95, throughput y tasa 5xx con el intervalo del 16/11 14:44–14:45 ART. Si ese intervalo ya no aparece, lanzar otra carga y capturar durante la ejecución. No mostrar el formulario de login ni la contraseña.
2. `rabbitmq-flujo.png`: abrir <http://localhost:15672>, pestaña **Queues and Streams**. Deben verse la cola principal, las tres `.retry.*` y la `.dead`, con un consumidor en la principal. No mostrar credenciales ni la pestaña de usuarios.
3. `auth0-api-scopes.png`: en Auth0, abrir **Applications → APIs → Mesa de ayuda API → Permissions**. Deben verse `read:tickets`, `write:tickets`, `assign:tickets` y `close:tickets`. Recortar la barra del navegador si muestra información de cuenta; nunca capturar **Credentials**, Client Secret o un JWT.
4. `postman-run.png` (opcional): ejecutar la colección completa y mostrar 20 requests/20 assertions sin fallos, ocultando las variables privadas.
5. `jmeter-reporte.png` (opcional): abrir `docs/evidencias/carga/run-20261116-144421/html/index.html` en esta máquina; el HTML versionado está en el ZIP de carga. Mostrar 600 muestras, error rate 0 % y p95 20 ms.

Antes de subir cada PNG, revisar el archivo completo —incluidos bordes, barra del navegador y notificaciones— para descartar tokens, Client Secret, API key, contraseñas y datos personales. Las capturas deben corresponder al entorno real; los valores medidos y verificables ya constan en [reporte-carga.md](reporte-carga.md) y [observabilidad-2026-11-16.md](observabilidad-2026-11-16.md).
