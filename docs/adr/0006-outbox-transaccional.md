# ADR 0006 — Outbox transaccional para eventos de dominio

- **Estado:** Aceptada
- **Fecha:** 2026-11-10

## Contexto

Una transacción SQL no puede incluir atómicamente un publish AMQP. Si se actualiza el ticket y luego falla RabbitMQ, el negocio queda confirmado sin evento; si se publica primero y luego falla SQL, aparece un evento de algo que no ocurrió.

## Decisión

Persistir `EventoOutbox` dentro de la misma transacción PostgreSQL que el escalamiento/cierre. Un proceso periódico en la API lee pendientes, publica con confirm channel y completa `publicadoEn` solo tras confirmación de RabbitMQ.

## Alternativas consideradas

- Dual write directo DB + RabbitMQ: menos código pero tiene una ventana explícita de pérdida/inconsistencia.
- Transacción distribuida 2PC: RabbitMQ/Prisma no ofrecen una solución simple y añade acoplamiento.
- CDC/Debezium: robusto en sistemas grandes, desproporcionado para el TPI.

## Consecuencias

- Si RabbitMQ cae, la respuesta de negocio puede confirmarse y el evento se reintenta.
- Puede publicarse dos veces si el proceso cae después del confirm pero antes de marcar la fila. Por eso el consumidor debe ser idempotente.
- La tabla outbox requiere una política futura de limpieza/archivo.
