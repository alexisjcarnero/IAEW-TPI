'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

async function main() {
  const { AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET } = process.env;
  if ([AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET].some(value => !value)) {
    throw new Error('Complete AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_CLIENT_ID y AUTH0_CLIENT_SECRET en .env local.');
  }
  if (process.platform !== 'win32') {
    throw new Error('Este lanzador usa el script PowerShell de Windows; consulte docs/PRUEBAS.md para otros sistemas.');
  }

  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: AUTH0_AUDIENCE,
      grant_type: 'client_credentials'
    })
  });
  if (!response.ok) throw new Error(`Auth0 no emitió un JWT: HTTP ${response.status}.`);
  const payload = await response.json();
  if (typeof payload.access_token !== 'string') throw new Error('Auth0 no devolvió access_token.');
  if (!String(payload.scope || '').split(' ').includes('read:tickets')) {
    throw new Error('El JWT no contiene read:tickets; revise API Access en Auth0.');
  }

  const childEnv = { ...process.env, ACCESS_TOKEN: payload.access_token };
  delete childEnv.AUTH0_CLIENT_ID;
  delete childEnv.AUTH0_CLIENT_SECRET;
  const scriptPath = path.join(__dirname, 'run-load-test.ps1');
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath];
  if (process.argv[2]) args.push('-JMeterExecutable', process.argv[2]);
  console.log('JWT obtenido de Auth0 con read:tickets; iniciando JMeter (token oculto).');
  const child = spawn('powershell.exe', args, {
    cwd: projectRoot,
    env: childEnv,
    stdio: 'inherit',
    windowsHide: true
  });
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`JMeter terminó con código ${code ?? signal}.`));
    });
  });
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
