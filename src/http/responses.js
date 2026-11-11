const { AppError } = require('./AppError');

function notFound(resource = 'Recurso') {
  throw new AppError(404, `${resource} no encontrado`);
}

function conflict(title, detail) {
  throw new AppError(409, title, { detail });
}

module.exports = { notFound, conflict };
