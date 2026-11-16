const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const { signBody } = require('../../shared/webhookSignature');

async function freePort() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

test('el receptor acepta HMAC valido, rechaza firma invalida y deduplica', async (t) => {
  const port = await freePort();
  const secret = 'secreto-solo-para-test';
  const receiver = spawn(process.execPath, [path.resolve(__dirname, '../../webhook-receiver/server.js')], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, PORT: String(port), WEBHOOK_SECRET: secret },
    stdio: 'ignore',
  });
  t.after(() => receiver.kill());

  const baseUrl = `http://127.0.0.1:${port}`;
  let healthy = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (receiver.exitCode !== null) break;
    try {
      healthy = (await fetch(`${baseUrl}/health`)).ok;
      if (healthy) break;
    } catch (_error) {
      await delay(100);
    }
  }
  assert.equal(healthy, true, 'el receptor debe iniciar antes de probar HTTP');

  const event = { id: 'evt-integration-1', type: 'ticket.escalado', correlationId: 'corr-integration-1' };
  const body = JSON.stringify(event);
  const headers = {
    'content-type': 'application/json',
    'x-event-id': event.id,
    'x-correlation-id': event.correlationId,
  };

  const invalid = await fetch(`${baseUrl}/webhooks/mesa-ayuda`, {
    method: 'POST', headers: { ...headers, 'x-signature-256': `sha256=${'0'.repeat(64)}` }, body,
  });
  assert.equal(invalid.status, 401);

  const signedHeaders = { ...headers, 'x-signature-256': `sha256=${signBody(body, secret)}` };
  const accepted = await fetch(`${baseUrl}/webhooks/mesa-ayuda`, {
    method: 'POST', headers: signedHeaders, body,
  });
  assert.equal(accepted.status, 202);

  const duplicate = await fetch(`${baseUrl}/webhooks/mesa-ayuda`, {
    method: 'POST', headers: signedHeaders, body,
  });
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);

  const received = await fetch(`${baseUrl}/webhooks/mesa-ayuda/recepciones`);
  assert.equal(received.status, 200);
  const entries = (await received.json()).data;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventId, event.id);
  assert.equal(entries[0].correlationId, event.correlationId);

  const metrics = await (await fetch(`${baseUrl}/metrics`)).text();
  assert.match(metrics, /mesa_ayuda_webhook_requests_total\{result="valid"\} 1/);
  assert.match(metrics, /mesa_ayuda_webhook_requests_total\{result="invalid"\} 1/);
});
