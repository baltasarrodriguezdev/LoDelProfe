import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { databaseUrlForConnection } from '../src/utils/database-url.js';

const require = createRequire(import.meta.url);

type Result = { status: number | null; stdout?: string; stderr?: string; error?: Error };

export async function deployWithRetry(
  run: () => Result,
  pause: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  log: (message: string) => void = console.log
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = run();
    if (result.error) throw result.error;
    if (result.status === 0) return 0;
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (!/\bP1001\b/.test(output) || attempt === 3) return result.status ?? 1;
    log(`TiDB no respondió (P1001). Reintentando migraciones: ${attempt + 1}/3.`);
    await pause(attempt * 2000);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = databaseUrlForConnection(process.env.DATABASE_URL);
  deployWithRetry(() => {
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      encoding: 'utf8',
      env: { ...process.env, ...(url ? { DATABASE_URL: url } : {}) }
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return result;
  }).then(status => { process.exitCode = status; }).catch(() => {
    console.error('No se pudo ejecutar Prisma migrate deploy.');
    process.exitCode = 1;
  });
}
