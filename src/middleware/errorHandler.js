// Handler de errores centralizado. Responde en formato `application/problem+json`
// (RFC 9457), incluido el caso de tokens inválidos que lanza
// express-oauth2-jwt-bearer (InvalidTokenError / UnauthorizedError).
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  req.log?.error({ err, status }, 'request finalizada con error');

  res.status(status).type('application/problem+json').json({
    type: 'about:blank',
    title: err.message || 'Error interno',
    status,
    correlationId: req.correlationId,
  });
}

module.exports = { errorHandler };
