# ADR 0003 — Seguridad: OAuth 2.0 + JWT vía Auth0, con scopes por acción

- **Estado:** Aceptada
- **Fecha:** 2026-09-24

## Contexto

La consigna exige OAuth 2.0 + JWT con scopes/roles, un flujo `client_credentials` (Machine to Machine), validación de issuer/audience/expiración/firma, y además un ejemplo de endpoint protegido con `x-api-key`. El proyecto de clase (`Semana 5/iaew-2026-ecommerce-api`) ya resuelve esto con `express-oauth2-jwt-bearer` contra Auth0.

## Decisión

Reutilizar **Auth0** como Identity Provider y **`express-oauth2-jwt-bearer`** para validar el JWT en la API (`src/middleware/auth0.js`), definiendo los scopes del dominio Mesa de ayuda:

- `read:tickets`
- `write:tickets`
- `assign:tickets`
- `close:tickets`

Cada endpoint sensible requiere el/los scope(s) correspondiente(s) (ver `src/routes/tickets.js`). Se agrega además un endpoint interno (`GET /internal/sla-policies`) protegido con `x-api-key` (`src/middleware/apiKey.js`), como pide la consigna.

## Alternativas consideradas

- **Roles en vez de scopes**: más simple pero menos granular; la consigna pide explícitamente scopes por acción, que mapean mejor a operaciones REST individuales.
- **Implementar un authorization server propio**: fuera de alcance; Auth0 (SaaS gratuito para desarrollo) resuelve emisión/verificación/JWKS sin mantener infraestructura propia.

## Consecuencias

- Todas las rutas de negocio quedan protegidas desde el esqueleto (aunque respondan `501`), documentando ya el modelo de autorización.
- El README debe documentar paso a paso cómo crear la API en Auth0, el cliente M2M, asignar los scopes, y obtener un token con `client_credentials`.
- Falta (Entrega 2): mapear los scopes a validaciones de negocio más finas si se requiere (por ejemplo, un agente N1 no puede cerrar tickets críticos).
