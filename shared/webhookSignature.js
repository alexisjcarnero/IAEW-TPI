const crypto = require('crypto');

function signBody(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function verifyBodySignature(rawBody, signatureHeader, secret) {
  if (!secret) return false;
  const provided = (signatureHeader || '').replace(/^sha256=/, '');
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = signBody(rawBody, secret);
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}

module.exports = { signBody, verifyBodySignature };
