const { RETRY_DELAYS_MS, retryQueueName } = require('../shared/rabbitTopology');

function retryCountOf(message) {
  const count = Number(message.properties.headers?.['x-retry-count'] ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : RETRY_DELAYS_MS.length;
}

function retryableHttpStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function scheduleRetry(channel, queue, message, event, retryCount) {
  const retryQueue = retryQueueName(queue, retryCount);
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
  channel.ack(message);
  return RETRY_DELAYS_MS[retryCount];
}

module.exports = { retryCountOf, retryableHttpStatus, scheduleRetry };
