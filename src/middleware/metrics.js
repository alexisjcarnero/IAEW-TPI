const client = require('prom-client');
const { prisma } = require('../db');

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

const activeTickets = new client.Gauge({
  name: 'mesa_ayuda_tickets_active',
  help: 'Tickets sin resolver ni cerrar al momento del scrape.',
});

const overdueTickets = new client.Gauge({
  name: 'mesa_ayuda_tickets_overdue',
  help: 'Tickets activos cuyo plazo SLA de resolucion ya vencio.',
});

const averageTimeToClose = new client.Gauge({
  name: 'mesa_ayuda_ticket_time_to_close_seconds_avg',
  help: 'Tiempo medio desde creacion hasta cierre de tickets cerrados, en segundos.',
});

activeTickets.set(0);
overdueTickets.set(0);
averageTimeToClose.set(0);

async function updateTicketMetrics(db = prisma) {
  const [snapshot] = await db.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE estado NOT IN ('RESUELTO', 'CERRADO'))::int AS active,
      COUNT(*) FILTER (
        WHERE estado NOT IN ('RESUELTO', 'CERRADO') AND vence_sla_at < NOW()
      )::int AS overdue,
      COALESCE(
        AVG(EXTRACT(EPOCH FROM (cerrado_en - creado_en)))
          FILTER (WHERE cerrado_en IS NOT NULL),
        0
      )::double precision AS average_seconds
    FROM tickets
  `;
  activeTickets.set(Number(snapshot.active));
  overdueTickets.set(Number(snapshot.overdue));
  averageTimeToClose.set(Number(snapshot.average_seconds));
  return snapshot;
}

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

async function metricsHandler(req, res) {
  if (process.env.DATABASE_URL) {
    try {
      await updateTicketMetrics();
    } catch (error) {
      req.log?.warn({ err: error }, 'No se pudieron actualizar las metricas de tickets');
    }
  }
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}

module.exports = {
  metricsMiddleware,
  metricsHandler,
  ticketsCreated,
  ticketsEscalated,
  businessErrors,
  updateTicketMetrics,
};
