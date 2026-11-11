# Estrategia y ejecución de pruebas

## 1. Tests unitarios

```bash
npm ci
npm test
```

Cubren reglas que conviene verificar sin infraestructura:

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

## 2. Validación de artefactos

```bash
npm run validate:artifacts
DATABASE_URL="postgresql://iaew:iaew-local@localhost:5432/iaew_mesa_ayuda?schema=public" npx prisma validate
```

El primer comando parsea OpenAPI YAML, colección/ambiente Postman y dashboard JSON, y comprueba la estructura del JMX. El segundo valida relaciones y tipos Prisma.

## 3. Colección Postman E2E

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

## 4. Prueba de carga JMeter

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

El script genera JTL y HTML en `docs/evidencias/carga/`. El JTL/HTML se ignoran en Git porque pueden ser voluminosos; deben copiarse al ZIP de evidencia si la cátedra los exige dentro del entregable.

## 5. Qué registrar como evidencia real

- Runner de Postman/Newman sin fallos.
- Reporte JMeter con requests, throughput, p95 y error rate.
- Grafana durante la carga con p95, throughput y 5xx.
- RabbitMQ mostrando `mesa-ayuda.notificaciones` y la DLQ.
- Logs API/worker/receptor unidos por el mismo correlation ID.
- Auth0: API, algoritmo RS256, permissions y aplicación M2M autorizada, ocultando secretos.

Nunca editar el reporte para “mejorar” resultados. Si no se cumple el umbral, conservar la evidencia, explicar el cuello de botella y repetir tras corregirlo.
