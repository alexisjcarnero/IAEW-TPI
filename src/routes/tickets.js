const express = require('express');

const { requireScope, requireScopes } = require('../middleware/auth0');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../http/asyncHandler');
const schemas = require('../validation/schemas');
const tickets = require('../services/ticketService');
const outbox = require('../messaging/outboxPublisher');
const { ticketsCreated, ticketsEscalated } = require('../middleware/metrics');

const router = express.Router();

router.get(
  '/tickets',
  requireScope('read:tickets'),
  validate(schemas.ticketQuery, 'query'),
  asyncHandler(async (req, res) => {
    res.json({ data: await tickets.list(req.query) });
  })
);

router.post(
  '/tickets',
  requireScope('write:tickets'),
  validate(schemas.ticketCreate),
  asyncHandler(async (req, res) => {
    const ticket = await tickets.create(req.body);
    ticketsCreated.inc();
    res.location(`/api/v1/tickets/${ticket.id}`).status(201).json(ticket);
  })
);

router.get(
  '/tickets/:id',
  requireScope('read:tickets'),
  validate(schemas.idParams, 'params'),
  asyncHandler(async (req, res) => res.json(await tickets.get(req.params.id)))
);

router.patch(
  '/tickets/:id',
  requireScope('write:tickets'),
  validate(schemas.idParams, 'params'),
  validate(schemas.ticketUpdate),
  asyncHandler(async (req, res) => res.json(await tickets.update(req.params.id, req.body)))
);

router.delete(
  '/tickets/:id',
  requireScope('write:tickets'),
  validate(schemas.idParams, 'params'),
  asyncHandler(async (req, res) => {
    await tickets.remove(req.params.id);
    res.status(204).end();
  })
);

router.post(
  '/tickets/:id/asignacion',
  requireScope('assign:tickets'),
  validate(schemas.idParams, 'params'),
  validate(schemas.asignacionCreate),
  asyncHandler(async (req, res) => res.json(await tickets.assign(req.params.id, req.body.agenteId)))
);

router.post(
  '/tickets/:id/escalamientos',
  requireScopes('write:tickets', 'assign:tickets'),
  validate(schemas.idParams, 'params'),
  validate(schemas.escalamientoCreate),
  asyncHandler(async (req, res) => {
    const result = await tickets.escalate(req.params.id, req.body, req.correlationId);
    ticketsEscalated.inc({
      nivel_origen: result.escalation.nivelOrigen,
      nivel_destino: result.escalation.nivelDestino,
    });
    outbox.flushOnce(req.log, [result.eventId]).catch((error) => {
      req.log.warn({ err: error, eventId: result.eventId }, 'El evento quedo pendiente en outbox');
    });
    res.status(201).json({
      ticket: result.ticket,
      escalamiento: result.escalation,
      evento: { id: result.eventId, estado: 'PENDIENTE_O_PUBLICADO' },
    });
  })
);

router.post(
  '/tickets/:id/cierre',
  requireScope('close:tickets'),
  validate(schemas.idParams, 'params'),
  validate(schemas.cierreCreate),
  asyncHandler(async (req, res) => {
    const result = await tickets.close(req.params.id, req.body, req.correlationId);
    outbox.flushOnce(req.log, [result.eventId]).catch((error) => {
      req.log.warn({ err: error, eventId: result.eventId }, 'El evento quedo pendiente en outbox');
    });
    res.json({ ticket: result.ticket, evento: { id: result.eventId, estado: 'PENDIENTE_O_PUBLICADO' } });
  })
);

router.get(
  '/tickets/:id/comentarios',
  requireScope('read:tickets'),
  validate(schemas.idParams, 'params'),
  asyncHandler(async (req, res) => res.json({ data: await tickets.listComments(req.params.id) }))
);

router.post(
  '/tickets/:id/comentarios',
  requireScope('write:tickets'),
  validate(schemas.idParams, 'params'),
  validate(schemas.comentarioCreate),
  asyncHandler(async (req, res) => {
    const comment = await tickets.addComment(req.params.id, req.body);
    res.status(201).json(comment);
  })
);

router.get(
  '/tickets/:id/notificaciones',
  requireScope('read:tickets'),
  validate(schemas.idParams, 'params'),
  asyncHandler(async (req, res) => res.json({ data: await tickets.listNotifications(req.params.id) }))
);

module.exports = router;
