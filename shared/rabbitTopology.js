// Tres reintentos tras el primer intento: 2, 4 y 8 segundos.
const RETRY_DELAYS_MS = Object.freeze([2000, 4000, 8000]);

function retryQueueName(queue, retryIndex) {
  return `${queue}.retry.${RETRY_DELAYS_MS[retryIndex]}ms`;
}

async function assertTopology(channel, { exchange, queue }) {
  const deadExchange = `${exchange}.dlx`;
  const deadQueue = `${queue}.dead`;

  await channel.assertExchange(exchange, 'topic', { durable: true });
  await channel.assertExchange(deadExchange, 'topic', { durable: true });
  await channel.assertQueue(deadQueue, { durable: true });
  await channel.bindQueue(deadQueue, deadExchange, '#');
  await channel.assertQueue(queue, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': deadExchange },
  });
  await channel.bindQueue(queue, exchange, 'ticket.escalado');
  await channel.bindQueue(queue, exchange, 'ticket.cerrado');

  for (const [index, delayMs] of RETRY_DELAYS_MS.entries()) {
    await channel.assertQueue(retryQueueName(queue, index), {
      durable: true,
      arguments: {
        'x-message-ttl': delayMs,
        // La cola por defecto enruta al nombre de la cola principal.
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': queue,
      },
    });
  }
}

module.exports = { RETRY_DELAYS_MS, retryQueueName, assertTopology };
