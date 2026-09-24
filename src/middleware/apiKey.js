const config = require('../config');

// Ejemplo básico de endpoint protegido con api_key, usando el header
// `x-api-key`, tal como pide la consigna del TPI para un caso de uso interno.
function requireApiKey(req, res, next) {
  const apiKey = req.get('x-api-key');

  if (!apiKey || apiKey !== config.internalApiKey) {
    return res.status(401).json({
      type: 'about:blank',
      title: 'API key inválida o faltante',
      status: 401,
    });
  }

  return next();
}

module.exports = { requireApiKey };
