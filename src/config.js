require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl: process.env.DATABASE_URL,
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
  },
  internalApiKey: process.env.INTERNAL_API_KEY,
  rabbit: {
    url: process.env.RABBIT_URL || 'amqp://iaew:iaew-local@localhost:5672',
    exchange: process.env.RABBIT_EXCHANGE || 'mesa-ayuda.eventos',
    queue: process.env.RABBIT_QUEUE || 'mesa-ayuda.notificaciones',
    outboxPollMs: Number(process.env.OUTBOX_POLL_MS || 2000),
  },
  webhook: {
    url: process.env.WEBHOOK_URL,
    secret: process.env.WEBHOOK_SECRET,
  },
};
