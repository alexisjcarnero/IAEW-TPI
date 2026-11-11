// Handler de errores centralizado. Responde en formato `application/problem+json`
// (RFC 9457), incluido el caso de tokens inválidos que lanza
// express-oauth2-jwt-bearer (InvalidTokenError / UnauthorizedError).
function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let title = err.message || 'Error interno';
  let detail = err.detail;
  let errors = err.errors;

  if (err.code === 'P2002') {
    status = 409;
    title = 'Ya existe un recurso con ese valor unico';
    detail = `Campo(s): ${err.meta?.target || 'unico'}`;
  } else if (err.code === 'P2025') {
    status = 404;
    title = 'Recurso no encontrado';
  } else if (err.code === 'P2034') {
    status = 409;
    title = 'Conflicto de concurrencia; reintente la operacion';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    title = 'JSON invalido';
  }

  req.log?.error({ err, status }, 'request finalizada con error');

  if (status >= 400 && status < 500) {
    require('./metrics').businessErrors.inc({ status_code: String(status) });
  }

  const problemType =
    typeof err.type === 'string' && /^https?:\/\//.test(err.type)
      ? err.type
      : `https://mesa-ayuda.local/problems/${status}`;

  res.status(status).type('application/problem+json').json({
    type: problemType,
    title,
    status,
    ...(detail && { detail }),
    ...(errors && { errors }),
    correlationId: req.correlationId,
  });
}

module.exports = { errorHandler };
