const crypto = require('crypto');
const config = require('../config');

// Envía un webhook firmado (HMAC-SHA256 sobre el body, en el header
// `X-Signature-256`) al canal externo cuando ocurre un evento sensible
// (escalamiento o cierre de ticket). Es la "integración adicional" del TPI.
async function sendWebhook(event, payload, logger) {
  if (!config.webhook.url) {
    logger?.warn('WEBHOOK_URL no configurada, se omite el envío');
    return false;
  }

  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
  const signature = crypto.createHmac('sha256', config.webhook.secret || '').update(body).digest('hex');

  try {
    const response = await fetch(config.webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-256': `sha256=${signature}`,
      },
      body,
    });
    logger?.info({ event, status: response.status }, 'webhook enviado');
    return response.ok;
  } catch (error) {
    logger?.error({ err: error, event }, 'error enviando webhook');
    return false;
  }
}

module.exports = { sendWebhook };
