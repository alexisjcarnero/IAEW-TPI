const amqplib = require('amqplib');
const config = require('../config');

let channel = null;
let connection = null;

async function connect(logger) {
  try {
    connection = await amqplib.connect(config.rabbit.url);
    channel = await connection.createChannel();
    await channel.assertExchange(config.rabbit.exchange, 'topic', { durable: true });
    logger?.info('Conectado a RabbitMQ y exchange declarado');

    connection.on('close', () => {
      channel = null;
      logger?.warn('Conexión a RabbitMQ cerrada');
    });
  } catch (error) {
    channel = null;
    logger?.error({ err: error }, 'No se pudo conectar a RabbitMQ');
  }
}

// Publica un evento de dominio (ej: "ticket.escalado") en el exchange
// topic de Mesa de ayuda. En la Entrega 2, un worker consumidor procesará
// estos eventos (recordatorios, cálculo de vencimientos, notificaciones).
function publishEvent(routingKey, payload) {
  if (!channel) return false;

  const body = Buffer.from(JSON.stringify(payload));
  return channel.publish(config.rabbit.exchange, routingKey, body, {
    contentType: 'application/json',
    persistent: true,
  });
}

function isConnected() {
  return Boolean(channel);
}

module.exports = { connect, publishEvent, isConnected };
