'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function tokenFor(clientId, clientSecret) {
  const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials'
    })
  });
  if (!response.ok) throw new Error(`Auth0 no emitió el JWT: HTTP ${response.status}.`);
  return response.json();
}

async function api(method, token) {
  return fetch('http://localhost:3000/api/v1/tickets', {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    ...(method === 'POST' ? { body: '{}' } : {})
  });
}

async function main() {
  for (const key of ['AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET']) {
    if (!process.env[key]) throw new Error(`Falta ${key} en .env local.`);
  }

  const full = await tokenFor(process.env.AUTH0_CLIENT_ID, process.env.AUTH0_CLIENT_SECRET);
  const parts = full.access_token.split('.');
  if (parts.length !== 3) throw new Error('Auth0 no emitió un JWT de tres segmentos.');
  parts[2] = `${parts[2][0] === 'A' ? 'z' : 'A'}${parts[2].slice(1)}`;
  const tampered = parts.join('.');

  const checks = [
    ['sin JWT', await api('GET'), 401],
    ['JWT auténtico con read:tickets', await api('GET', full.access_token), 200],
    ['firma alterada', await api('GET', tampered), 401]
  ];
  const { AUTH0_READONLY_CLIENT_ID, AUTH0_READONLY_CLIENT_SECRET } = process.env;
  if (AUTH0_READONLY_CLIENT_ID || AUTH0_READONLY_CLIENT_SECRET) {
    if (!AUTH0_READONLY_CLIENT_ID || !AUTH0_READONLY_CLIENT_SECRET) {
      throw new Error('Complete ambos valores AUTH0_READONLY_CLIENT_ID y AUTH0_READONLY_CLIENT_SECRET.');
    }
    const limited = await tokenFor(AUTH0_READONLY_CLIENT_ID, AUTH0_READONLY_CLIENT_SECRET);
    const limitedScopes = String(limited.scope || '').split(' ').filter(Boolean);
    if (!limitedScopes.includes('read:tickets') || limitedScopes.includes('write:tickets')) {
      throw new Error(`El cliente de solo lectura no tiene los scopes esperados: ${limitedScopes.join(',')}.`);
    }
    checks.push(['JWT sin write:tickets', await api('POST', limited.access_token), 403]);
  } else {
    console.log('403 con scope insuficiente: pendiente de cliente M2M de solo lectura.');
  }
  for (const [name, response, expected] of checks) {
    console.log(`${name}: HTTP ${response.status} (esperado ${expected})`);
    if (response.status !== expected) process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
