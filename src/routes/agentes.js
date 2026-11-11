const express = require('express');

const { prisma } = require('../db');
const { requireScope } = require('../middleware/auth0');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../http/asyncHandler');
const { notFound, conflict } = require('../http/responses');
const schemas = require('../validation/schemas');

const router = express.Router();

router.get(
  '/agentes',
  requireScope('assign:tickets'),
  validate(schemas.agenteQuery, 'query'),
  asyncHandler(async (req, res) => {
    const data = await prisma.agente.findMany({
      where: {
        ...(req.query.nivel && { nivel: req.query.nivel }),
        ...(req.query.activo !== undefined && { activo: req.query.activo }),
      },
      orderBy: { creadoEn: 'asc' },
    });
    res.json({ data });
  })
);

router.post(
  '/agentes',
  requireScope('assign:tickets'),
  validate(schemas.agenteCreate),
  asyncHandler(async (req, res) => {
    const agent = await prisma.agente.create({ data: req.body });
    res.location(`/api/v1/agentes/${agent.id}`).status(201).json(agent);
  })
);

router.get(
  '/agentes/:id',
  requireScope('assign:tickets'),
  validate(schemas.idParams, 'params'),
  asyncHandler(async (req, res) => {
    const agent = await prisma.agente.findUnique({ where: { id: req.params.id } });
    if (!agent) notFound('Agente');
    res.json(agent);
  })
);

router.patch(
  '/agentes/:id',
  requireScope('assign:tickets'),
  validate(schemas.idParams, 'params'),
  validate(schemas.agenteUpdate),
  asyncHandler(async (req, res) => {
    const exists = await prisma.agente.findUnique({ where: { id: req.params.id } });
    if (!exists) notFound('Agente');
    const agent = await prisma.agente.update({ where: { id: req.params.id }, data: req.body });
    res.json(agent);
  })
);

router.delete(
  '/agentes/:id',
  requireScope('assign:tickets'),
  validate(schemas.idParams, 'params'),
  asyncHandler(async (req, res) => {
    const agent = await prisma.agente.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { ticketsAsignados: true, escalamientos: true } } },
    });
    if (!agent) notFound('Agente');
    if (agent._count.ticketsAsignados || agent._count.escalamientos) {
      conflict('El agente tiene historial asociado', 'Puede desactivarse con PATCH {"activo": false}.');
    }
    await prisma.agente.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

module.exports = router;
