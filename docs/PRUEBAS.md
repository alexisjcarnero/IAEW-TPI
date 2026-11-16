# Estrategia y ejecución de pruebas

## 1. Tests automatizados locales

```bash
npm ci
npm test
```

Incluyen reglas y pruebas HTTP locales que conviene verificar sin Docker ni Auth0:

- secuencia N1 → N2 → N3;
- estados que permiten/prohíben escalar;
- responsable activo y de nivel correcto;
- escalamiento inmediato de prioridad crítica;
- ventana de riesgo SLA para prioridad baja;
- SLA inválido y límite N3;
- validación estricta de bodies y UUID;
- rechazo de PATCH vacío;
- comparación de API keys en tiempo constante.
- firma HMAC válida y rechazo de body/secreto/firma alterados.
- exigencia conjunta de `write:tickets` y `assign:tickets` para escalar.
- transacciones simuladas de escalamiento y cierre, incluido conflicto de versión;
- declaración de colas RabbitMQ y secuencia de backoff exponencial;
- confirmación del broker antes del ACK al reintentar;
- respuestas HTTP de la API y del receptor de webhook.

## 2. Smoke tests con Docker, sin Auth0

Con `docker compose up --build -d` en ejecución:

```bash
node scripts/smoke-webhook.js
node scripts/smoke-business.js
```

El primero comprueba el receptor real (firma inválida, firma válida, duplicado y efecto observable). El segundo crea datos de prueba en PostgreSQL y recorre escalamiento y cierre: cada transacción registra un evento en el outbox, que pasa por RabbitMQ → worker → webhook → notificación `ENVIADA`. Comprueba que el ticket termina `CERRADO` y que el receptor registra ambos eventos. Los registros creados quedan en la base local para inspección. **No prueban el JWT ni la API REST**: para eso se ejecuta la colección Postman.

## 3. Validación de artefactos

```bash
npm run validate:artifacts
DATABASE_URL="postgresql://iaew:iaew-local@localhost:5432/iaew_mesa_ayuda?schema=public" npx prisma validate
```

El primer comando parsea OpenAPI YAML, colección/ambiente Postman y dashboard JSON, y comprueba la estructura del JMX. El segundo valida relaciones y tipos Prisma.

## 4. Colección Postman E2E

Archivos:

- `tests/postman/Mesa-de-ayuda.postman_collection.json`
- `tests/postman/Local.postman_environment.json`

Preparación:

1. Levantar `docker compose up --build -d`.
2. Configurar el ambiente con credenciales M2M **locales**.
3. Comprobar que la aplicación M2M posee los cuatro scopes.
4. Ejecutar toda la colección en orden.

La colección verifica:

1. health;
2. obtención del JWT con `client_credentials`;
3. creación de usuario;
4. creación de agentes N1/N2;
5. creación y asignación de ticket crítico;
6. transacción de escalamiento;
7. notificación persistida por el consumidor;
8. resolución/cierre;
9. recepción del webhook;
10. endpoint con API key.

Para Newman, sin almacenar secretos en archivos versionados:

```bash
npx newman run tests/postman/Mesa-de-ayuda.postman_collection.json \
  -e tests/postman/Local.postman_environment.json \
  --env-var "clientId=$AUTH0_CLIENT_ID" \
  --env-var "clientSecret=$AUTH0_CLIENT_SECRET"
```

## 5. Prueba de carga JMeter

Plan: `tests/load/mesa-ayuda.jmx`.

- 20 threads.
- ramp-up de 10 segundos.
- 30 iteraciones por thread.
- 600 requests autenticados a `GET /api/v1/tickets?limit=50`.
- keep-alive habilitado.
- assertion HTTP 200.

Windows PowerShell:

```powershell
$env:ACCESS_TOKEN = "JWT_REAL_NO_VERSIONAR"
./scripts/run-load-test.ps1
```

El script genera JTL y HTML en una carpeta `docs/evidencias/carga/run-AAAAMMDD-HHMMSS/` nueva por corrida; no sobrescribe mediciones anteriores. Si JMeter no está en `PATH`, pasar `-JMeterExecutable "C:\ruta\a\jmeter.bat"`. Las carpetas de corrida se ignoran en Git porque pueden ser voluminosas; deben copiarse al ZIP de evidencia si la cátedra las exige dentro del entregable.
El plan obtiene el JWT de la variable de entorno del proceso; el token no se pasa como argumento visible en la línea de comandos.

En Windows también puede usarse `node scripts/run-load-with-auth0.js "C:\ruta\a\jmeter.bat"`: lee las credenciales solo del `.env` local ignorado por Git, obtiene un JWT nuevo y lo pasa a JMeter como variable de entorno del proceso, sin imprimirlo.

## 6. Qué registrar como evidencia real

- Runner de Postman/Newman sin fallos.
- Reporte JMeter con requests, throughput, p95 y error rate.
- Grafana durante la carga con p95, throughput y 5xx.
- RabbitMQ mostrando `mesa-ayuda.notificaciones` y la DLQ.
- Logs API/worker/receptor unidos por el mismo correlation ID.
- Auth0: API, algoritmo RS256, permissions y aplicación M2M autorizada, ocultando secretos.

Nunca editar el reporte para “mejorar” resultados. Si no se cumple el umbral, conservar la evidencia, explicar el cuello de botella y repetir tras corregirlo.
