const crypto = require('crypto');

// Propaga (o genera) un x-correlation-id por request, para poder
// correlacionar logs entre la API, el worker y el webhook receiver.
function correlationId(req, res, next) {
  const incoming = req.get('x-correlation-id');
  const valid = incoming && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming);
  req.correlationId = valid ? incoming : crypto.randomUUID();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
}

module.exports = { correlationId };
