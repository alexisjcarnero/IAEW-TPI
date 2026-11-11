const config = require('../config');
const crypto = require('crypto');

function safeEqual(a, b) {
  const left = Buffer.from(a || '');
  const right = Buffer.from(b || '');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// Ejemplo básico de endpoint protegido con api_key, usando el header
// `x-api-key`, tal como pide la consigna del TPI para un caso de uso interno.
function requireApiKey(req, res, next) {
  const apiKey = req.get('x-api-key');

  if (!apiKey || !config.internalApiKey || !safeEqual(apiKey, config.internalApiKey)) {
    return res.status(401).type('application/problem+json').json({
      type: 'https://mesa-ayuda.local/problems/invalid-api-key',
      title: 'API key inválida o faltante',
      status: 401,
      correlationId: req.correlationId,
    });
  }

  return next();
}

module.exports = { requireApiKey, safeEqual };
