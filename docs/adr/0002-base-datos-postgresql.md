# ADR 0002 — Base de datos: PostgreSQL (relacional) con Prisma

- **Estado:** Aceptada
- **Fecha:** 2026-09-24

## Contexto

El dominio Mesa de ayuda tiene entidades fuertemente relacionadas: un `Ticket` pertenece a un `Usuario` (solicitante), puede tener un `Agente` asignado, sigue una `SlaPolicy` según su prioridad, y acumula `Comentario`s y un historial de `Escalamiento`s. Las reglas de negocio (escalar validando estado/prioridad/SLA) se apoyan en integridad referencial y consultas relacionales (joins, agregaciones para el dashboard de observabilidad).

## Decisión

Usar **PostgreSQL 16** como base de datos, con **Prisma** como ORM/migraciones (`prisma migrate` + `prisma/seed.js`).

## Alternativas consideradas

- **MongoDB** (usado en las clases de la materia con Mongoose): más flexible para documentos, pero el dominio de Mesa de ayuda es naturalmente relacional (FKs entre ticket/usuario/agente/SLA) y las consultas de reporting (p95, throughput, tickets por SLA vencido) son más naturales en SQL.
- **SQLite**: simple para desarrollo local, pero no representa un despliegue realista en contenedores separados (DB propia) como pide la consigna.

## Consecuencias

- Se gana integridad referencial (FKs) y consultas relacionales simples para el dashboard de observabilidad.
- Prisma aporta migraciones versionadas (`prisma/migrations`) reproducibles vía `prisma migrate deploy`, alineado con el punto "modelo de datos + estrategia de migraciones" de la Entrega 1.
- Se agrega un servicio `db` (postgres:16-alpine) en `docker-compose.yml` con volumen persistente y healthcheck.
