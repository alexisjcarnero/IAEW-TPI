const express = require('express');
const { prisma } = require('../db');
const { requireScope } = require('../middleware/auth0');

const router = express.Router();
const estadosPermitidos = new Set(['ABIERTO', 'ASIGNADO', 'EN_PROGRESO', 'ESCALADO', 'RESUELTO', 'CERRADO']);
const prioridadesPermitidas = new Set(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']);

// GET /api/v1/tickets — implementado para probar el camino end-to-end
// (Auth0 -> API -> PostgreSQL). El resto de las operaciones de negocio
// quedan como esqueleto (501) para la Entrega 2.
router.get('/tickets', requireScope('read:tickets'), async (req, res, next) => {
  const { estado, prioridad } = req.query;

  if (estado !== undefined && !estadosPermitidos.has(estado)) {
    return res.status(400).type('application/problem+json').json({
      type: 'about:blank',
      title: 'Estado de ticket inválido',
      status: 400,
      correlationId: req.correlationId,
    });
  }

  if (prioridad !== undefined && !prioridadesPermitidas.has(prioridad)) {
    return res.status(400).type('application/problem+json').json({
      type: 'about:blank',
      title: 'Prioridad inválida',
      status: 400,
      correlationId: req.correlationId,
    });
  }

  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        ...(estado !== undefined && { estado }),
        ...(prioridad !== undefined && { prioridad }),
      },
      include: { solicitante: true, agenteAsignado: true, slaPolicy: true },
      orderBy: { creadoEn: 'desc' },
      take: 50,
    });
    res.json({ data: tickets });
  } catch (error) {
    next(error);
  }
});

router.get('/tickets/:id', requireScope('read:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.post('/tickets', requireScope('write:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.patch('/tickets/:id', requireScope('write:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.delete('/tickets/:id', requireScope('write:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

// Flujo multi-paso: asignar un agente al ticket.
router.post('/tickets/:id/asignacion', requireScope('assign:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

// Flujo multi-paso: escalar el ticket validando prioridad, estado,
// responsable y reglas de SLA. Emite el evento `ticket.escalado` (RabbitMQ)
// y dispara el webhook firmado al canal externo. Se implementa en la
// Entrega 2.
router.post('/tickets/:id/escalamientos', requireScope(['write:tickets', 'assign:tickets']), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.post('/tickets/:id/cierre', requireScope('close:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.get('/tickets/:id/comentarios', requireScope('read:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.post('/tickets/:id/comentarios', requireScope('write:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

module.exports = router;
