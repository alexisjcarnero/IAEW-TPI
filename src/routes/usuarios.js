const express = require('express');

const { prisma } = require('../db');
const { requireApiKey } = require('../middleware/apiKey');
const { requireScope } = require('../middleware/auth0');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../http/asyncHandler');
const { notFound, conflict } = require('../http/responses');
const schemas = require('../validation/schemas');

const router = express.Router();

router.get(
  '/usuarios',
  requireScope('read:tickets'),
  asyncHandler(async (_req, res) => {
    res.json({ data: await prisma.usuario.findMany({ orderBy: { creadoEn: 'asc' } }) });
  })
);

router.post(
  '/usuarios',
  requireScope('write:tickets'),
  validate(schemas.usuarioCreate),
  asyncHandler(async (req, res) => {
    const user = await prisma.usuario.create({ data: req.body });
    res.location(`/api/v1/usuarios/${user.id}`).status(201).json(user);
  })
);

router.get(
  '/usuarios/:id',
  requireScope('read:tickets'),
  validate(schemas.idParams, 'params'),
  asyncHandler(async (req, res) => {
    const user = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!user) notFound('Usuario');
    res.json(user);
  })
);

router.patch(
  '/usuarios/:id',
  requireScope('write:tickets'),
  validate(schemas.idParams, 'params'),
  validate(schemas.usuarioUpdate),
  asyncHandler(async (req, res) => {
    const exists = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!exists) notFound('Usuario');
    res.json(await prisma.usuario.update({ where: { id: req.params.id }, data: req.body }));
  })
);

// Ejemplo pedido por la consigna: autenticacion por x-api-key en lugar de JWT.
router.delete(
  '/usuarios/:id',
  requireApiKey,
  validate(schemas.idParams, 'params'),
  asyncHandler(async (req, res) => {
    const user = await prisma.usuario.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { tickets: true } } },
    });
    if (!user) notFound('Usuario');
    if (user._count.tickets) conflict('El usuario tiene tickets asociados y no puede eliminarse');
    await prisma.usuario.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

module.exports = router;
