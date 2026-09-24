require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
  },
  internalApiKey: process.env.INTERNAL_API_KEY,
  rabbit: {
    url: process.env.RABBIT_URL || 'amqp://iaew:iaew-local@localhost:5672',
    exchange: process.env.RABBIT_EXCHANGE || 'mesa-ayuda.eventos',
  },
  webhook: {
    url: process.env.WEBHOOK_URL,
    secret: process.env.WEBHOOK_SECRET,
  },
};
