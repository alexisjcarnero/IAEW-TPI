const express = require('express');
const { checkDatabase } = require('../db');
const { isConnected } = require('../messaging/rabbit');

const router = express.Router();

// Endpoint público (sin autenticación) para probar que la API, la DB y el
// broker están arriba. Útil para healthchecks de Docker Compose.
router.get('/health', async (_req, res) => {
  const db = await checkDatabase();
  const broker = isConnected() ? 'up' : 'down';
  const status = db === 'up' && broker === 'up' ? 200 : 503;

  res.status(status).json({ status: status === 200 ? 'ok' : 'degraded', db, broker });
});

module.exports = router;
