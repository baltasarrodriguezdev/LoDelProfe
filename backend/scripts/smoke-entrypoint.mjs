import { spawn } from 'node:child_process';

const port = 32109;
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
child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });

const timeout = setTimeout(() => child.kill('SIGTERM'), 8_000);

try {
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`El entrypoint terminó antes de iniciar (código ${code}).\n${output}`)));
    const inspectOutput = () => {
      if (output.includes(`API lista en http://localhost:${port}`)) resolve();
      else setTimeout(inspectOutput, 25);
    };
    inspectOutput();
  });

  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  if (!response.ok || (await response.json()).status !== 'ok') {
    throw new Error(`El health check del entrypoint devolvió ${response.status}.`);
  }
  console.log(`Entrypoint de producción verificado en /api/health (${response.status}).`);
} finally {
  clearTimeout(timeout);
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
}
