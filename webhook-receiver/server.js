const express = require('express');
const client = require('prom-client');
const { verifyBodySignature } = require('./webhookSignature');

const PORT = Number(process.env.PORT || 4000);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const app = express();
const receivedEvents = [];
const acceptedEventIds = new Set();

client.collectDefaultMetrics({ prefix: 'mesa_ayuda_webhook_' });
const webhookRequests = new client.Counter({
  name: 'mesa_ayuda_webhook_requests_total',
  help: 'Webhooks recibidos por resultado de validacion.',
  labelNames: ['result'],
});

app.use(
  express.json({
    limit: '100kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

function verifySignature(req) {
  return verifyBodySignature(
    req.rawBody || Buffer.from(''),
    req.get('X-Signature-256') || '',
    WEBHOOK_SECRET
  );
}

app.get('/health', (_req, res) => res.json({ status: 'up' }));

app.get('/metrics', async (_req, res) => {
  res.set('content-type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Solo para la demo local: permite observar los ultimos eventos cuya firma fue valida.
app.get('/webhooks/mesa-ayuda/recepciones', (_req, res) => {
  res.json({ data: receivedEvents });
});

app.post('/webhooks/mesa-ayuda', (req, res) => {
  const valid = verifySignature(req);
  const log = {
    level: valid ? 'info' : 'warn',
    msg: valid ? 'webhook recibido' : 'firma de webhook invalida',
    signatureValid: valid,
    eventId: req.get('x-event-id'),
    correlationId: req.get('x-correlation-id'),
    eventType: req.body?.type,
    timestamp: new Date().toISOString(),
  };
  console.log(JSON.stringify(log));

  if (!valid) {
    webhookRequests.inc({ result: 'invalid' });
    return res.status(401).type('application/problem+json').json({
      type: 'https://mesa-ayuda.local/problems/invalid-webhook-signature',
      title: 'Firma invalida',
      status: 401,
    });
  }

  if (acceptedEventIds.has(req.body.id)) {
    webhookRequests.inc({ result: 'duplicate' });
    return res.status(200).json({ received: true, duplicate: true, eventId: req.body.id });
  }

  webhookRequests.inc({ result: 'valid' });
  acceptedEventIds.add(req.body.id);
  receivedEvents.unshift({
    eventId: req.body.id,
    type: req.body.type,
    subject: req.body.subject,
    correlationId: req.body.correlationId,
    receivedAt: new Date().toISOString(),
  });
  if (receivedEvents.length > 100) {
    const removed = receivedEvents.splice(100);
    for (const event of removed) acceptedEventIds.delete(event.eventId);
  }
  return res.status(202).json({ received: true, eventId: req.body.id });
});

app.use((err, req, res, _next) => {
  console.log(JSON.stringify({ level: 'error', msg: err.message, timestamp: new Date().toISOString() }));
  res.status(400).type('application/problem+json').json({
    type: 'https://mesa-ayuda.local/problems/invalid-json',
    title: 'JSON invalido',
    status: 400,
  });
});

if (!WEBHOOK_SECRET) {
  console.log(JSON.stringify({ level: 'warn', msg: 'WEBHOOK_SECRET no configurado; todas las firmas fallaran' }));
}

app.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: `webhook-receiver escuchando en :${PORT}` }));
});
