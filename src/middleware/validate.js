const { AppError } = require('../http/AppError');

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError(400, 'Solicitud invalida', { errors }));
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = { validate };
