const test = require('node:test');
const assert = require('node:assert/strict');

const { retryCountOf, retryableHttpStatus, scheduleRetry } = require('../../worker/retry');

function sampleMessage(headers = {}) {
  return {
    content: Buffer.from('{"id":"evt-1"}'),
    properties: { headers, contentType: 'application/json', messageId: 'evt-1', correlationId: 'corr-1' },
  };
}

test('cuenta reintentos por header AMQP y rechaza un contador invalido', () => {
  assert.equal(retryCountOf(sampleMessage()), 0);
  assert.equal(retryCountOf(sampleMessage({ 'x-retry-count': 2 })), 2);
  assert.equal(retryCountOf(sampleMessage({ 'x-retry-count': 'invalido' })), 3);
  assert.equal(retryCountOf(sampleMessage({ 'x-retry-count': -1 })), 3);
});

test('solo reintenta respuestas HTTP potencialmente transitorias', () => {
  for (const status of [408, 429, 500, 502, 503]) assert.equal(retryableHttpStatus(status), true);
  for (const status of [301, 400, 401, 403, 404, 422]) assert.equal(retryableHttpStatus(status), false);
});

test('publica en la cola de backoff y hace ACK solo despues del confirm', async () => {
  const message = sampleMessage();
  const actions = [];
  let confirm;
  const channel = {
    sendToQueue(queue, content, options, callback) {
      actions.push({ queue, content, options });
      confirm = callback;
    },
    ack(delivery) { actions.push({ ack: delivery }); },
  };

  const pending = scheduleRetry(channel, 'mesa.notificaciones', message, {
    id: 'evt-1', correlationId: 'corr-1', type: 'ticket.escalado',
  }, 1);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].queue, 'mesa.notificaciones.retry.4000ms');
  assert.equal(actions[0].content, message.content);
  assert.equal(actions[0].options.persistent, true);
  assert.equal(actions[0].options.headers['x-retry-count'], 2);

  confirm();
  assert.equal(await pending, 4000);
  assert.deepEqual(actions[1], { ack: message });
});

test('si el broker rechaza la republicacion, el original queda sin ACK', async () => {
  const message = sampleMessage();
  let confirm;
  let acknowledged = false;
  const channel = {
    sendToQueue(_queue, _content, _options, callback) { confirm = callback; },
    ack() { acknowledged = true; },
  };

  const pending = scheduleRetry(channel, 'mesa.notificaciones', message, {
    id: 'evt-1', correlationId: 'corr-1', type: 'ticket.cerrado',
  }, 0);
  confirm(new Error('broker nack'));
  await assert.rejects(pending, /broker nack/);
  assert.equal(acknowledged, false);
});
