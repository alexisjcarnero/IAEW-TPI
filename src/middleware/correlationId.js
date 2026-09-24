const crypto = require('crypto');

// Propaga (o genera) un x-correlation-id por request, para poder
// correlacionar logs entre la API, el worker y el webhook receiver.
function correlationId(req, res, next) {
  const incoming = req.get('x-correlation-id');
  req.correlationId = incoming || crypto.randomUUID();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
}

module.exports = { correlationId };
