const amqplib = require('amqplib');
const http = require('http');
const pino = require('pino');
const client = require('prom-client');
const { PrismaClient } = require('@prisma/client');
const { signBody } = require('./webhookSignature');

const config = {
  rabbitUrl: process.env.RABBIT_URL || 'amqp://iaew:iaew-local@rabbitmq:5672',
  exchange: process.env.RABBIT_EXCHANGE || 'mesa-ayuda.eventos',
  queue: process.env.RABBIT_QUEUE || 'mesa-ayuda.notificaciones',
  webhookUrl: process.env.WEBHOOK_URL || 'http://webhook-receiver:4000/webhooks/mesa-ayuda',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  metricsPort: Number(process.env.METRICS_PORT || 9100),
  logLevel: process.env.LOG_LEVEL || 'info',
};

const logger = pino({ level: config.logLevel });
const prisma = new PrismaClient();
let connection;
let channel;
let ready = false;

client.collectDefaultMetrics({ prefix: 'mesa_ayuda_worker_' });
const processed = new client.Counter({
  name: 'mesa_ayuda_worker_events_processed_total',
  help: 'Eventos procesados por resultado.',
  labelNames: ['type', 'result'],
});
const webhookDuration = new client.Histogram({
  name: 'mesa_ayuda_worker_webhook_duration_seconds',
  help: 'Duracion del envio al webhook.',
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

function notificationMessage(event) {
  if (event.type === 'ticket.escalado') {
    return `Ticket escalado de ${event.data.nivelOrigen} a ${event.data.nivelDestino}: ${event.data.motivo}`;
  }
  return `Ticket cerrado: ${event.data.resolucion}`;
}

async function sendWebhook(event) {
  const body = JSON.stringify(event);
  const signature = signBody(body, config.webhookSecret);
  const end = webhookDuration.startTimer();
  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-256': `sha256=${signature}`,
        'x-event-id': event.id,
        'x-correlation-id': event.correlationId,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    return response.status;
  } finally {
    end();
  }
}

async function consumeMessage(message) {
  let event;
  try {
    event = JSON.parse(message.content.toString('utf8'));
    if (!event.id || !event.type || !event.data?.ticketId) throw new Error('Evento invalido');

    let notification = await prisma.notificacion.findUnique({ where: { eventoId: event.id } });
    if (notification?.estado === 'ENVIADA') {
      processed.inc({ type: event.type, result: 'duplicate' });
      channel.ack(message);
      return;
    }
    if (!notification) {
      notification = await prisma.notificacion.create({
        data: {
          eventoId: event.id,
          ticketId: event.data.ticketId,
          tipo: event.type,
          mensaje: notificationMessage(event),
        },
      });
    }

    notification = await prisma.notificacion.update({
      where: { eventoId: event.id },
      data: { intentos: { increment: 1 } },
    });
    const status = await sendWebhook(event);
    const succeeded = status >= 200 && status < 300;
    notification = await prisma.notificacion.update({
      where: { eventoId: event.id },
      data: {
        webhookStatus: status,
        estado: succeeded ? 'ENVIADA' : 'FALLIDA',
        ...(succeeded && { procesadoEn: new Date() }),
      },
    });

    if (!succeeded) throw new Error(`Webhook respondio ${status}`);
    processed.inc({ type: event.type, result: 'success' });
    logger.info(
      { eventId: event.id, type: event.type, correlationId: event.correlationId, webhookStatus: status },
      'Evento procesado'
    );
    channel.ack(message);
  } catch (error) {
    const attempts = event?.id
      ? await prisma.notificacion
          .update({
            where: { eventoId: event.id },
            data: { estado: 'FALLIDA' },
            select: { intentos: true },
          })
          .catch(() => null)
      : null;
    const retry = Boolean(attempts && attempts.intentos < 3);
    processed.inc({ type: event?.type || 'invalid', result: retry ? 'retry' : 'dead_letter' });
    logger.error(
      { err: error, eventId: event?.id, correlationId: event?.correlationId, retry },
      retry ? 'Fallo temporal; evento reencolado' : 'Evento enviado a dead-letter queue'
    );
    channel.nack(message, false, retry);
  }
}

async function startConsumer() {
  if (!config.webhookSecret) throw new Error('WEBHOOK_SECRET es obligatorio');
  connection = await amqplib.connect(config.rabbitUrl);
  channel = await connection.createChannel();
  const deadExchange = `${config.exchange}.dlx`;
  const deadQueue = `${config.queue}.dead`;
  await channel.assertExchange(config.exchange, 'topic', { durable: true });
  await channel.assertExchange(deadExchange, 'topic', { durable: true });
  await channel.assertQueue(deadQueue, { durable: true });
  await channel.bindQueue(deadQueue, deadExchange, '#');
  await channel.assertQueue(config.queue, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': deadExchange },
  });
  await channel.bindQueue(config.queue, config.exchange, 'ticket.escalado');
  await channel.bindQueue(config.queue, config.exchange, 'ticket.cerrado');
  channel.prefetch(5);
  await channel.consume(config.queue, consumeMessage, { noAck: false });
  ready = true;
  logger.info({ queue: config.queue }, 'Worker consumiendo eventos');
}

const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'content-type': client.register.contentType });
    res.end(await client.register.metrics());
  } else if (req.url === '/health') {
    res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: ready ? 'up' : 'starting' }));
  } else {
    res.writeHead(404).end();
  }
});

metricsServer.listen(config.metricsPort, () => {
  logger.info({ port: config.metricsPort }, 'Metricas del worker disponibles');
});

async function shutdown(signal) {
  logger.info({ signal }, 'Apagado ordenado del worker');
  ready = false;
  await channel?.close().catch(() => {});
  await connection?.close().catch(() => {});
  await prisma.$disconnect();
  metricsServer.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startConsumer().catch((error) => {
  logger.fatal({ err: error }, 'No se pudo iniciar el worker');
  process.exit(1);
});
