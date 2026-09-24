# C4 — Nivel 1: Contexto

Vista de más alto nivel: quién usa el sistema de Mesa de ayuda y con qué sistemas externos interactúa.

```mermaid
C4Context
    title Mesa de ayuda — Diagrama de Contexto

    Person(solicitante, "Solicitante", "Usuario final que reporta un problema y crea tickets")
    Person(agente, "Agente / Supervisor", "Atiende, asigna y escala tickets según su nivel (N1/N2/N3)")

    System(mesaAyuda, "Sistema Mesa de ayuda", "API REST que gestiona tickets, usuarios y agentes; aplica reglas de SLA y escalamiento")

    System_Ext(auth0, "Auth0", "Proveedor de identidad OAuth 2.0 / OIDC. Emite y valida access tokens JWT con scopes")
    System_Ext(canalExterno, "Canal externo (Slack/Teams simulado)", "Recibe notificaciones de escalamiento/cierre vía webhook firmado")

    Rel(solicitante, mesaAyuda, "Crea y consulta sus tickets", "HTTPS/JSON")
    Rel(agente, mesaAyuda, "Asigna, escala y cierra tickets", "HTTPS/JSON + Bearer JWT")
    Rel(mesaAyuda, auth0, "Valida access tokens (issuer, audience, firma, expiración)", "OIDC discovery + JWKS")
    Rel(agente, auth0, "Obtiene access token (client_credentials)", "OAuth 2.0")
    Rel(mesaAyuda, canalExterno, "Notifica eventos sensibles", "Webhook HTTP + firma HMAC-SHA256")
```

## Actores y sistemas

| Elemento | Descripción |
|---|---|
| Solicitante | Persona que reporta un problema y da seguimiento a su ticket. |
| Agente / Supervisor | Atiende tickets asignados; puede escalar de N1 a N2/N3 según SLA y prioridad. |
| Sistema Mesa de ayuda | El sistema que este TPI construye: API REST + persistencia + asincronía + seguridad. |
| Auth0 | Identity Provider externo: emite tokens `client_credentials` y expone JWKS para validar firmas. |
| Canal externo | Simulado con un servicio `webhook-receiver` en el `docker-compose`; representa Slack/Teams/email en un escenario real. |
