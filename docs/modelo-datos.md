# Modelo de datos

Base de datos: **PostgreSQL 16**. Definido con Prisma (`prisma/schema.prisma`); ver [ADR 0002](adr/0002-base-datos-postgresql.md).

## Diagrama entidad-relación

```mermaid
erDiagram
    USUARIO ||--o{ TICKET : "solicita"
    AGENTE ||--o{ TICKET : "atiende (opcional)"
    SLA_POLICY ||--o{ TICKET : "rige"
    TICKET ||--o{ COMENTARIO : "tiene"
    TICKET ||--o{ ESCALAMIENTO : "acumula"
    AGENTE ||--o{ ESCALAMIENTO : "recibe (opcional)"

    USUARIO {
        uuid id PK
        string nombre
        string email UK
        enum rol "SOLICITANTE | SUPERVISOR"
        datetime creado_en
    }

    AGENTE {
        uuid id PK
        string nombre
        string email UK
        enum nivel "N1 | N2 | N3"
        boolean activo
        datetime creado_en
    }

    SLA_POLICY {
        uuid id PK
        enum prioridad UK "BAJA | MEDIA | ALTA | CRITICA"
        int minutos_primera_respuesta
        int minutos_resolucion
    }

    TICKET {
        uuid id PK
        string titulo
        string descripcion
        enum prioridad "BAJA | MEDIA | ALTA | CRITICA"
        enum estado "ABIERTO | ASIGNADO | EN_PROGRESO | ESCALADO | RESUELTO | CERRADO"
        enum nivel_actual "N1 | N2 | N3"
        uuid solicitante_id FK
        uuid agente_asignado_id FK
        uuid sla_policy_id FK
        datetime vence_sla_at
        datetime creado_en
        datetime actualizado_en
        datetime cerrado_en
    }

    COMENTARIO {
        uuid id PK
        uuid ticket_id FK
        string autor
        string texto
        datetime creado_en
    }

    ESCALAMIENTO {
        uuid id PK
        uuid ticket_id FK
        enum nivel_origen "N1 | N2 | N3"
        enum nivel_destino "N1 | N2 | N3"
        uuid agente_destino_id FK
        string motivo
        datetime creado_en
    }
```

## Diccionario de datos (resumen)

| Tabla | Campo clave | Notas |
|---|---|---|
| `usuarios` | `email` único | Solicitantes o supervisores. |
| `agentes` | `email` único, `nivel` | Nivel determina a qué escalamientos puede recibir. |
| `sla_policies` | `prioridad` único | Minutos de primera respuesta y resolución por prioridad; seedeada. |
| `tickets` | FKs a `usuarios`, `agentes` (nullable), `sla_policies` | `vence_sla_at` se calcula al crear/escalar según la política de SLA. |
| `comentarios` | FK a `tickets` | Historial de seguimiento del ticket. |
| `escalamientos` | FK a `tickets`, `agentes` (nullable) | Historial de cada escalamiento: de qué nivel a qué nivel y por qué. |

## Estrategia de migraciones y seed

- **Migraciones versionadas** con Prisma Migrate: cada cambio de esquema genera una carpeta en `prisma/migrations/<timestamp_o_nombre>/migration.sql`. La migración inicial es `prisma/migrations/0001_init/migration.sql`.
- **Desarrollo:** `npx prisma migrate dev` (genera y aplica migraciones, actualiza el cliente Prisma).
- **Despliegue (Docker):** el `Dockerfile` de la API ejecuta `npx prisma migrate deploy` al iniciar el contenedor, aplicando solo migraciones pendientes — seguro para reiniciar el compose sin perder datos.
- **Seed:** `prisma/seed.js`, ejecutado manualmente con `npx prisma db seed` o `npm run prisma:seed`. Usa `upsert` para ser **idempotente**: crea las políticas de SLA (una por prioridad), agentes de ejemplo (N1/N2/N3), un usuario solicitante y un ticket de ejemplo, sin duplicar si se corre más de una vez.
