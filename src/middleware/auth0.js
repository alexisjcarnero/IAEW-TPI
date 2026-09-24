const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');
const config = require('../config');

// Valida el access token JWT (RS256) emitido por Auth0: verifica firma,
// issuer, audience y expiración.
const validateAccessToken = auth({
  issuerBaseURL: `https://${config.auth0.domain}`,
  audience: config.auth0.audience,
  tokenSigningAlg: 'RS256',
});

// Combina la validación del token con la verificación de uno o más scopes
// requeridos para el endpoint (ej: 'write:tickets').
function requireScope(scope) {
  return [validateAccessToken, requiredScopes(scope)];
}

module.exports = { validateAccessToken, requireScope };
