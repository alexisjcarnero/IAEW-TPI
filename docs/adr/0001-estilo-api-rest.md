# ADR 0001 — Estilo de API: REST (no gRPC) con convenciones consistentes

- **Estado:** Aceptada
- **Fecha:** 2026-09-24

## Contexto

La consigna permite REST o gRPC. El dominio es Mesa de ayuda: consumido por front-ends web, Postman/JMeter para pruebas de carga, y potencialmente por el mismo canal externo. Se necesita un contrato fácil de documentar en OpenAPI 3.1, fácil de probar con herramientas estándar (Postman, curl) y que combine bien con validación de scopes por endpoint.

## Decisión

Usar **REST sobre HTTP/JSON** como estilo principal de API, versionado en el path (`/api/v1`), con:

- Recursos en plural y en español, consistente con el dominio (`/tickets`, `/agentes`, `/usuarios`).
- Acciones de negocio que no son CRUD puro modeladas como sub-recursos: `POST /tickets/{id}/asignacion`, `POST /tickets/{id}/escalamientos`, `POST /tickets/{id}/cierre`.
- Errores en formato `application/problem+json` (RFC 9457) con `type`, `title`, `status`.
- Autenticación vía `Authorization: Bearer <JWT>` (OAuth 2.0/Auth0) y, para un endpoint interno de ejemplo, `x-api-key`.

La integración adicional elegida (webhook saliente firmado) es HTTP simple, coherente con el resto de la API.

## Alternativas consideradas

- **gRPC**: mejor rendimiento y contratos fuertemente tipados (`.proto`), pero exige generar stubs, complica las pruebas con Postman/JMeter pedidas por la cátedra y no aporta un beneficio claro para el volumen de este TPI.
- **REST con acciones como verbos en el body** (`POST /tickets` con `{"accion": "escalar"}`): más simple de enrutar, pero peor semántica HTTP y peor mapeo a scopes por operación.

## Consecuencias

- Se puede documentar con OpenAPI 3.1 estándar y probar con una colección Postman convencional.
- Cada operación sensible (asignar, escalar, cerrar) tiene su propio endpoint, lo que permite asignar un scope distinto a cada una (`assign:tickets`, `write:tickets`, `close:tickets`).
- Si en la Entrega 2 se agrega gRPC como integración adicional (opción permitida por la consigna), convivirá como un contenedor aparte sin afectar el contrato REST.
