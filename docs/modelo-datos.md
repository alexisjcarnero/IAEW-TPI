# Modelo de datos

PostgreSQL 16 con Prisma. Las migraciones versionadas son `0001_init` y `0002_final_delivery`; `prisma migrate deploy` las aplica automáticamente al iniciar la API.

```mermaid
erDiagram
    USUARIO ||--o{ TICKET : solicita
    AGENTE ||--o{ TICKET : atiende
    SLA_POLICY ||--o{ TICKET : rige
    TICKET ||--o{ COMENTARIO : contiene
    TICKET ||--o{ ESCALAMIENTO : registra
    AGENTE ||--o{ ESCALAMIENTO : recibe
    TICKET ||--o{ NOTIFICACION : produce

    USUARIO {
      uuid id PK
      string email UK
      enum rol
    }
    AGENTE {
      uuid id PK
      string email UK
      enum nivel
      boolean activo
    }
    SLA_POLICY {
      uuid id PK
      enum prioridad UK
      int minutos_primera_respuesta
      int minutos_resolucion
    }
    TICKET {
      uuid id PK
      enum prioridad
      enum estado
      enum nivel_actual
      uuid solicitante_id FK
      uuid agente_asignado_id FK
      uuid sla_policy_id FK
      datetime vence_sla_at
      int version
    }
    ESCALAMIENTO {
      uuid id PK
      uuid ticket_id FK
      enum nivel_origen
      enum nivel_destino
      uuid agente_destino_id FK
      string motivo
    }
    COMENTARIO {
      uuid id PK
      uuid ticket_id FK
      string autor
      string texto
    }
    NOTIFICACION {
      uuid id PK
      uuid evento_id UK
      uuid ticket_id FK
      enum estado
      int intentos
      int webhook_status
    }
    EVENTO_OUTBOX {
      uuid id PK
      string tipo
      uuid agregado_id
      json payload
      string correlation_id
      int intentos
      datetime publicado_en
    }
```

`EventoOutbox` no tiene FK al ticket intencionalmente: es un registro de integración que debe poder sobrevivir a cambios del agregado. `Notificacion` sí referencia al ticket porque es el efecto consultable por la API.

## Invariantes relevantes

- Emails de usuario/agente y prioridad SLA son únicos.
- Un ticket siempre referencia solicitante y política SLA existentes.
- `version` implementa comparación optimista durante el escalamiento.
- `evento_id` único vuelve idempotente al consumidor.
- Un agente de destino debe estar activo y pertenecer exactamente al nivel siguiente.
- Un ticket cerrado es inmutable y los recursos con historial no se borran.

## Cálculo de SLA

Al crear un ticket:

```text
venceSlaAt = instanteCreacion + slaPolicy.minutosResolucion
```

Para prioridades `ALTA` y `CRITICA` se permite escalamiento inmediato. Para `MEDIA` y `BAJA` se habilita al entrar en la ventana de riesgo:

```text
atRiskAt = venceSlaAt - slaPolicy.minutosPrimeraRespuesta
```

Escalar no reinicia el vencimiento: reiniciarlo ocultaría un incumplimiento y permitiría “ganar tiempo” mediante sucesivas escalaciones.

## Transacción de escalamiento

Con aislamiento `Serializable`:

1. leer ticket con agente y política;
2. validar invariantes;
3. elegir/verificar agente de nivel siguiente;
4. insertar historial `Escalamiento`;
5. actualizar `Ticket` solo si `version` no cambió;
6. insertar `EventoOutbox` con payload y correlation ID;
7. commit único.

Si cualquier paso falla, PostgreSQL revierte todos. La entrega a RabbitMQ ocurre después y no forma parte de la transacción SQL.

## Seed reproducible

`prisma/seed.js` usa `upsert` para SLA, usuarios y agentes, y comprueba la existencia del ticket de muestra. Puede ejecutarse en cada arranque sin duplicar datos funcionales.
