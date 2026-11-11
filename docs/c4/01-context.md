# C4 — Nivel 1: Contexto

El sistema centraliza tickets de soporte, asignaciones y escalaciones con control de SLA. Auth0 es el proveedor de identidad y el canal externo recibe notificaciones firmadas.

```mermaid
flowchart LR
    solicitante["Persona: Solicitante\nReporta y consulta incidentes"]
    soporte["Persona: Agente / Supervisor\nAsigna, atiende, escala y cierra"]
    sistema["Sistema: Mesa de ayuda\nAPI, reglas SLA, eventos y auditoría"]
    auth0["Sistema externo: Auth0\nOAuth 2.0, JWT RS256 y JWKS"]
    canal["Sistema externo: Canal de notificación\nWebhook HMAC; simulado localmente"]

    solicitante -->|"HTTPS/JSON"| sistema
    soporte -->|"HTTPS/JSON + Bearer JWT"| sistema
    soporte -->|"client_credentials"| auth0
    sistema -->|"OIDC discovery/JWKS"| auth0
    sistema -->|"Evento firmado"| canal
```

## Responsabilidades y límites

| Elemento | Responsabilidad | Fuera de alcance |
|---|---|---|
| Mesa de ayuda | Persistir y proteger recursos; aplicar SLA; publicar/consumir eventos; notificar. | Interfaz gráfica de usuario final. |
| Auth0 | Emitir JWT para el cliente M2M y publicar claves de firma. | Administración de usuarios del dominio. |
| Canal externo | Aceptar únicamente payloads cuya firma HMAC sea válida. | Integración real con Slack/Teams; se usa un receptor reproducible. |
| Solicitante | Origina y consulta tickets. | Login interactivo; la consigna usa M2M. |
| Agente/Supervisor | Ejecuta operaciones sensibles según scopes. | Asignación automática avanzada por carga. |

La frontera de confianza principal es la API: no confía en claims sin validar el JWT ni en webhooks sin secreto compartido.
