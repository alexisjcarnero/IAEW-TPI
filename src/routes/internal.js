const express = require('express');
const { prisma } = require('../db');
const { requireApiKey } = require('../middleware/apiKey');

const router = express.Router();

// Endpoint interno protegido con `x-api-key` (no con JWT): pensado para que
// otro servicio de confianza (ej. el worker de SLA) consulte las políticas
// vigentes sin pasar por Auth0.
router.get('/internal/sla-policies', requireApiKey, async (req, res, next) => {
  try {
    const policies = await prisma.slaPolicy.findMany();
    res.json({ data: policies });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
