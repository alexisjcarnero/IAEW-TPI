const test = require('node:test');
const assert = require('node:assert/strict');

const { safeEqual } = require('../../src/middleware/apiKey');

test('comparacion de API keys acepta solo valores identicos', () => {
  assert.equal(safeEqual('clave-segura', 'clave-segura'), true);
  assert.equal(safeEqual('clave-segura', 'clave-distinta'), false);
  assert.equal(safeEqual('corta', 'mucho-mas-larga'), false);
  assert.equal(safeEqual(undefined, 'clave'), false);
});
