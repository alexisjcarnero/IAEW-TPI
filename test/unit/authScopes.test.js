const test = require('node:test');
const assert = require('node:assert/strict');

process.env.AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || 'example.us.auth0.com';
process.env.AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || 'https://mesa-ayuda.local';

const { requireScopes } = require('../../src/middleware/auth0');

function checkScopes(granted) {
  const scopeMiddleware = requireScopes('write:tickets', 'assign:tickets')[1];
  let result;
  scopeMiddleware({ auth: { payload: { scope: granted } } }, {}, (error) => {
    result = error || null;
  });
  return result;
}

test('escalamiento exige todos los scopes declarados', () => {
  const error = checkScopes('write:tickets');
  assert.equal(error.status, 403);
});

test('acepta un JWT cuyo claim scope contiene ambos permisos', () => {
  assert.equal(checkScopes('read:tickets write:tickets assign:tickets'), null);
});
