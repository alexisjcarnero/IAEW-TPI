const assert = require('node:assert/strict');
const { signBody } = require('../shared/webhookSignature');

async function main() {
  const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:4000';
  const secret = process.env.WEBHOOK_SECRET || 'colocar-secreto-compartido-local';
  const event = {
    id: `smoke-${Date.now()}`,
    type: 'ticket.escalado',
    subject: 'ticket-smoke',
    correlationId: 'smoke-webhook',
  };
  const body = JSON.stringify(event);
  const url = `${baseUrl}/webhooks/mesa-ayuda`;
  const headers = {
    'content-type': 'application/json',
    'x-event-id': event.id,
    'x-correlation-id': event.correlationId,
    'x-signature-256': `sha256=${signBody(body, secret)}`,
  };

  const invalid = await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'x-signature-256': `sha256=${'0'.repeat(64)}` },
    body,
  });
  const valid = await fetch(url, { method: 'POST', headers, body });
  const duplicate = await fetch(url, { method: 'POST', headers, body });
  const receptionsResponse = await fetch(`${url}/recepciones`);
  const receptions = await receptionsResponse.json();
  const observed = receptions.data.some((received) => received.eventId === event.id);

  assert.equal(invalid.status, 401);
  assert.equal(valid.status, 202);
  assert.equal(duplicate.status, 200);
  assert.equal(receptionsResponse.status, 200);
  assert.equal(observed, true);
  console.log(JSON.stringify({ invalid: invalid.status, valid: valid.status, duplicate: duplicate.status, observed }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
