const client = require('prom-client');

client.collectDefaultMetrics({ prefix: 'mesa_ayuda_api_' });

const httpRequests = new client.Counter({
  name: 'mesa_ayuda_http_requests_total',
  help: 'Cantidad total de respuestas HTTP de la API.',
  labelNames: ['method', 'route', 'status_code'],
});

const httpDuration = new client.Histogram({
  name: 'mesa_ayuda_http_request_duration_seconds',
  help: 'Duracion de requests HTTP de la API en segundos.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const ticketsCreated = new client.Counter({
  name: 'mesa_ayuda_tickets_created_total',
  help: 'Tickets creados.',
});

const ticketsEscalated = new client.Counter({
  name: 'mesa_ayuda_tickets_escalated_total',
  help: 'Tickets escalados exitosamente.',
  labelNames: ['nivel_origen', 'nivel_destino'],
});

const businessErrors = new client.Counter({
  name: 'mesa_ayuda_business_errors_total',
  help: 'Errores de negocio por codigo HTTP.',
  labelNames: ['status_code'],
});

function routeLabel(req) {
  if (!req.route?.path) return 'unmatched';
  return `${req.baseUrl || ''}${req.route.path}`;
}

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: String(res.statusCode),
    };
    httpRequests.inc(labels);
    end(labels);
  });
  next();
}

async function metricsHandler(_req, res) {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}

module.exports = {
  metricsMiddleware,
  metricsHandler,
  ticketsCreated,
  ticketsEscalated,
  businessErrors,
};
