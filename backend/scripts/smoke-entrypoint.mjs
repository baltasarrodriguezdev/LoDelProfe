import { spawn } from 'node:child_process';

const port = 32109;
const startedAt = performance.now();
const child = spawn(process.execPath, ['dist/src/server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    JWT_SECRET: process.env.JWT_SECRET ?? 'container-build-smoke-secret',
    FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    REALTIME_REDIS_URL: ''
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
let childError = null;
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
child.on('error', error => { childError = error; });

const timeout = setTimeout(() => child.kill('SIGTERM'), 12_000);

function waitForOutput(pattern) {
  return new Promise((resolve, reject) => {
    const inspectOutput = () => {
      if (output.includes(pattern)) return resolve(performance.now() - startedAt);
      if (childError) return reject(childError);
      if (child.exitCode !== null) return reject(new Error(`El entrypoint terminó antes de informar “${pattern}” (código ${child.exitCode}).\n${output}`));
      setTimeout(inspectOutput, 10);
    };
    inspectOutput();
  });
}

try {
  const listeningMs = await waitForOutput(`API lista en http://localhost:${port}`);
  if (listeningMs > 500) {
    throw new Error(`El entrypoint tardó ${listeningMs.toFixed(1)}ms en escuchar; el máximo permitido por el smoke test es 500ms.`);
  }

  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  if (!response.ok || (await response.json()).status !== 'ok') {
    throw new Error(`El health check del entrypoint devolvió ${response.status}.`);
  }
  const earlyRouteResponses = Promise.all([
    fetch(`http://127.0.0.1:${port}/api/auth/me`),
    fetch(`http://127.0.0.1:${port}/api/realtime`)
  ]);
  const initializedMs = await waitForOutput('initialization:complete');

  const [me, realtime] = await earlyRouteResponses;
  if (me.status !== 401 || realtime.status !== 404) {
    throw new Error(`Rutas durante cold start: /api/auth/me=${me.status} (esperado 401), /api/realtime=${realtime.status} (esperado 404).`);
  }

  console.log(`Cold start verificado: listen=${listeningMs.toFixed(1)}ms, inicialización=${initializedMs.toFixed(1)}ms, /api/health=${response.status}.`);
} finally {
  clearTimeout(timeout);
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
}
