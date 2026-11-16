const test = require('node:test');
const assert = require('node:assert/strict');
const pino = require('pino');

process.env.AUTH0_DOMAIN ||= 'test.example.auth0.com';
process.env.AUTH0_AUDIENCE ||= 'https://test.mesa-ayuda.local';

const { createApp } = require('../../src/app');
const { prisma } = require('../../src/db');

test('la API expone metricas y protege rutas JWT y API key sin depender de la DB', async (t) => {
  const app = createApp(pino({ level: 'silent' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const correlationId = 'test-http-sin-secretos';
  const unauthorized = await fetch(`${baseUrl}/api/v1/tickets`, {
    headers: { 'x-correlation-id': correlationId },
  });
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers.get('content-type'), /application\/problem\+json/);
  assert.equal(unauthorized.headers.get('x-correlation-id'), correlationId);
  assert.equal((await unauthorized.json()).correlationId, correlationId);

  const invalidKey = await fetch(`${baseUrl}/internal/sla-policies`, {
    headers: { 'x-api-key': 'clave-incorrecta' },
  });
  assert.equal(invalidKey.status, 401);
  assert.match(invalidKey.headers.get('content-type'), /application\/problem\+json/);

  const missing = await fetch(`${baseUrl}/ruta-inexistente`);
  assert.equal(missing.status, 404);

  const metrics = await fetch(`${baseUrl}/metrics`);
  assert.equal(metrics.status, 200);
  assert.match(await metrics.text(), /mesa_ayuda_http_requests_total/);
});
