const amqplib = require('amqplib');
const config = require('../config');
const { assertTopology } = require('../../shared/rabbitTopology');

let channel = null;
let connection = null;
let logger = null;
let reconnectTimer = null;
let closing = false;

function scheduleReconnect() {
  if (closing || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(logger);
  }, 5000);
  reconnectTimer.unref?.();
}

async function connect(appLogger) {
  logger = appLogger || logger;
  if (channel || closing) return;
  try {
    connection = await amqplib.connect(config.rabbit.url);
    const candidateChannel = await connection.createConfirmChannel();
    await assertTopology(candidateChannel, { exchange: config.rabbit.exchange, queue: config.rabbit.queue });
    channel = candidateChannel;
    logger?.info({ exchange: config.rabbit.exchange }, 'Conexion a RabbitMQ establecida');

    connection.on('error', (error) => logger?.error({ err: error }, 'Error de conexion RabbitMQ'));
    connection.on('close', () => {
      channel = null;
      connection = null;
      logger?.warn('Conexion a RabbitMQ cerrada; se reintentara');
      scheduleReconnect();
    });
  } catch (error) {
    channel = null;
    await connection?.close().catch(() => {});
    connection = null;
    logger?.error({ err: error }, 'No se pudo conectar a RabbitMQ; se reintentara');
    scheduleReconnect();
  }
}

async function publishEvent(routingKey, event) {
  if (!channel) throw new Error('RabbitMQ no esta conectado');
  channel.publish(config.rabbit.exchange, routingKey, Buffer.from(JSON.stringify(event)), {
    contentType: 'application/json',
    persistent: true,
    messageId: event.id,
    correlationId: event.correlationId,
    timestamp: Date.now(),
    type: routingKey,
  });
  await channel.waitForConfirms();
}

function isConnected() {
  return Boolean(channel);
}

async function close() {
  closing = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (channel) await channel.close().catch(() => {});
  if (connection) await connection.close().catch(() => {});
  channel = null;
  connection = null;
}

module.exports = { connect, publishEvent, isConnected, close };
