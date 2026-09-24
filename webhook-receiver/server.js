/**
 * Placeholder del canal externo (Slack/Teams simulado).
 *
 * Recibe el webhook que la API de Mesa de ayuda envía cuando un ticket se
 * escala o se cierra, verifica la firma HMAC-SHA256 (header
 * `X-Signature-256`, calculada sobre el body crudo con WEBHOOK_SECRET) y
 * loguea el evento recibido. En la Entrega 2 esto puede ampliarse para
 * publicar en un canal real.
 */
const express = require('express');
const crypto = require('crypto');

const PORT = process.env.PORT || 4000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'colocar-secreto-compartido-local';

const app = express();

// Necesitamos el body crudo para poder verificar la firma HMAC.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

function verifySignature(req) {
  const signatureHeader = req.get('X-Signature-256') || '';
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody || Buffer.from(''))
    .digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '');

  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}

app.get('/health', (_req, res) => res.json({ status: 'up' }));

app.post('/webhooks/mesa-ayuda', (req, res) => {
  const valid = verifySignature(req);

  console.log(
    JSON.stringify({
      level: valid ? 'info' : 'warn',
      msg: valid ? 'webhook recibido' : 'firma de webhook inválida',
      signatureValid: valid,
      payload: req.body,
      timestamp: new Date().toISOString(),
    })
  );

  if (!valid) {
    return res.status(401).json({ error: 'firma inválida' });
  }

  return res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: `webhook-receiver escuchando en :${PORT}` }));
});
