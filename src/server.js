const pino = require('pino');

const config = require('./config');
const { prisma } = require('./db');
const { createApp } = require('./app');
const rabbit = require('./messaging/rabbit');
const outboxPublisher = require('./messaging/outboxPublisher');

const logger = pino({ level: config.logLevel });
const app = createApp(logger);

let server;

async function start() {
  await rabbit.connect(logger);
  outboxPublisher.start(logger);
  server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Mesa de ayuda API iniciada');
  });
}

async function shutdown(signal) {
  logger.info({ signal }, 'Apagado ordenado de la API');
  outboxPublisher.stop();
  await rabbit.close();
  await prisma.$disconnect();
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  logger.fatal({ err: error }, 'No se pudo iniciar la API');
  process.exit(1);
});
