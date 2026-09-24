const express = require('express');
const { requireApiKey } = require('../middleware/apiKey');
const { requireScope } = require('../middleware/auth0');

const router = express.Router();

router.get('/usuarios', requireScope('read:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.post('/usuarios', requireScope('write:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

router.get('/usuarios/:id', requireScope('read:tickets'), (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

// Ejemplo de endpoint interno protegido con `x-api-key` en lugar de JWT,
// tal como pide la consigna (por ejemplo, para un job interno de limpieza
// de usuarios inactivos).
router.delete('/usuarios/:id', requireApiKey, (_req, res) => {
  res.status(501).json({ title: 'No implementado en la Entrega 1', status: 501 });
});

module.exports = router;
