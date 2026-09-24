const express = require('express');
const { requireScope } = require('../middleware/auth0');

const router = express.Router();

// La consigna define scopes sobre tickets (`read:tickets`, `write:tickets`,
// `assign:tickets`, `close:tickets`); se reutiliza `assign:tickets` para
// administrar agentes, ya que son quienes reciben las asignaciones.
router.get('/agentes', requireScope('assign:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.post('/agentes', requireScope('assign:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.get('/agentes/:id', requireScope('assign:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.patch('/agentes/:id', requireScope('assign:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.delete('/agentes/:id', requireScope('assign:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

module.exports = router;
