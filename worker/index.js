const amqplib = require('amqplib');
const http = require('http');
const pino = require('pino');
const client = require('prom-client');
const { PrismaClient } = require('@prisma/client');
const { signBody } = require('./webhookSignature');
const { RETRY_DELAYS_MS, retryQueueName, assertTopology } = require('./rabbitTopology');

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
let stopping = false;

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

function failure(message, retryable) {
  const error = new Error(message);
  error.retryable = retryable;
  return error;
}

function retryCountOf(message) {
  const count = Number(message.properties.headers?.['x-retry-count'] ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : RETRY_DELAYS_MS.length;
}

function acknowledgeOrExit(message, eventId) {
  try {
    channel.ack(message);
  } catch (error) {
    ready = false;
    logger.fatal({ err: error, eventId }, 'No se pudo confirmar el consumo');
    process.exit(1);
  }
}

async function scheduleRetry(message, event, retryCount) {
  const retryQueue = retryQueueName(config.queue, retryCount);
  await new Promise((resolve, reject) => {
    channel.sendToQueue(retryQueue, message.content, {
      persistent: true,
      contentType: message.properties.contentType || 'application/json',
      messageId: message.properties.messageId || event.id,
      correlationId: message.properties.correlationId || event.correlationId,
      type: message.properties.type || event.type,
      headers: { 'x-retry-count': retryCount + 1 },
    }, (error) => (error ? reject(error) : resolve()));
  });
  // Un ACK perdido puede duplicar la entrega, pero nunca se confirma antes de publicar.
  acknowledgeOrExit(message, event.id);
  return RETRY_DELAYS_MS[retryCount];
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
    try {
      event = JSON.parse(message.content.toString('utf8'));
    } catch (_error) {
      throw failure('JSON del evento invalido', false);
    }
    if (
      !event || typeof event !== 'object' || typeof event.id !== 'string' || !event.id ||
      !['ticket.escalado', 'ticket.cerrado'].includes(event.type) ||
      typeof event.data?.ticketId !== 'string' || !event.data.ticketId
    ) {
      throw failure('Evento invalido', false);
    }

    let notification = await prisma.notificacion.findUnique({ where: { eventoId: event.id } });
    if (notification?.estado === 'ENVIADA') {
      processed.inc({ type: event.type, result: 'duplicate' });
      acknowledgeOrExit(message, event.id);
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

    if (!succeeded) {
      throw failure(`Webhook respondio ${status}`, status === 408 || status === 429 || status >= 500);
    }
    processed.inc({ type: event.type, result: 'success' });
    logger.info(
      { eventId: event.id, type: event.type, correlationId: event.correlationId, webhookStatus: status },
      'Evento procesado'
    );
    acknowledgeOrExit(message, event.id);
  } catch (error) {
    if (event?.id) {
      await prisma.notificacion.update({
        where: { eventoId: event.id },
        data: { estado: 'FALLIDA' },
      }).catch(() => {});
    }

    const retryCount = retryCountOf(message);
    const retry = error.retryable !== false && retryCount < RETRY_DELAYS_MS.length;
    if (retry) {
      try {
        const delayMs = await scheduleRetry(message, event, retryCount);
        processed.inc({ type: event.type, result: 'retry' });
        logger.warn(
          { err: error, eventId: event.id, correlationId: event.correlationId, retryNumber: retryCount + 1, delayMs },
          'Fallo temporal; evento programado para reintento'
        );
        return;
      } catch (publishError) {
        // Sin confirmacion no se hace ACK: al cerrar la conexion RabbitMQ reentrega el original.
        ready = false;
        logger.fatal({ err: publishError, eventId: event.id }, 'No se pudo confirmar el reintento');
        process.exit(1);
      }
    }

    processed.inc({ type: event?.type || 'invalid', result: 'dead_letter' });
    logger.error(
      { err: error, eventId: event?.id, correlationId: event?.correlationId, retryCount },
      'Evento enviado a dead-letter queue'
    );
    channel.nack(message, false, false);
  }
}

async function startConsumer() {
  if (!config.webhookSecret) throw new Error('WEBHOOK_SECRET es obligatorio');
  connection = await amqplib.connect(config.rabbitUrl);
  connection.on('error', (error) => logger.error({ err: error }, 'Error de conexion RabbitMQ'));
  connection.on('close', () => {
    ready = false;
    if (!stopping) {
      logger.fatal('Conexion RabbitMQ cerrada; reiniciando worker para recuperar consumo');
      process.exit(1);
    }
  });
  channel = await connection.createConfirmChannel();
  await assertTopology(channel, { exchange: config.exchange, queue: config.queue });
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
  stopping = true;
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
