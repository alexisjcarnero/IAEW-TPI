const test = require('node:test');
const assert = require('node:assert/strict');

const { signBody, verifyBodySignature } = require('../../shared/webhookSignature');

test('firma y verifica exactamente los mismos bytes del webhook', () => {
  const secret = 'secreto-de-prueba';
  const body = Buffer.from('{"event":"ticket.escalado","id":"evt-1"}');
  const signature = signBody(body, secret);

  assert.match(signature, /^[a-f0-9]{64}$/);
  assert.equal(verifyBodySignature(body, `sha256=${signature}`, secret), true);
});

test('rechaza body alterado, secreto incorrecto y firma malformada', () => {
  const body = Buffer.from('{"event":"ticket.escalado"}');
  const signature = signBody(body, 'secreto');

  assert.equal(verifyBodySignature(Buffer.from('{"event":"ticket.cerrado"}'), `sha256=${signature}`, 'secreto'), false);
  assert.equal(verifyBodySignature(body, `sha256=${signature}`, 'otro-secreto'), false);
  assert.equal(verifyBodySignature(body, 'sha256=no-es-hex', 'secreto'), false);
  assert.equal(verifyBodySignature(body, `sha256=${signature}`, ''), false);
});
