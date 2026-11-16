const test = require('node:test');
const assert = require('node:assert/strict');

const { RETRY_DELAYS_MS, retryQueueName, assertTopology } = require('../../shared/rabbitTopology');

test('declara la cola principal, la DLQ y el backoff exponencial durable', async () => {
  const calls = [];
  const channel = Object.fromEntries(
    ['assertExchange', 'assertQueue', 'bindQueue'].map((method) => [
      method,
      async (...args) => { calls.push({ method, args }); },
    ])
  );

  await assertTopology(channel, { exchange: 'mesa.eventos', queue: 'mesa.notificaciones' });

  assert.deepEqual(RETRY_DELAYS_MS, [2000, 4000, 8000]);
  assert.deepEqual(
    calls.filter((call) => call.method === 'assertQueue').map((call) => call.args[0]),
    [
      'mesa.notificaciones.dead',
      'mesa.notificaciones',
      'mesa.notificaciones.retry.2000ms',
      'mesa.notificaciones.retry.4000ms',
      'mesa.notificaciones.retry.8000ms',
    ]
  );

  for (const [index, delayMs] of RETRY_DELAYS_MS.entries()) {
    const queue = retryQueueName('mesa.notificaciones', index);
    const declaration = calls.find((call) => call.method === 'assertQueue' && call.args[0] === queue);
    assert.equal(declaration.args[1].durable, true);
    assert.deepEqual(declaration.args[1].arguments, {
      'x-message-ttl': delayMs,
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': 'mesa.notificaciones',
    });
  }
});
