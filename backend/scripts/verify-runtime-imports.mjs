import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const localModules = fileURLToPath(new URL('../node_modules/', import.meta.url));
const serviceLocal = process.argv.includes('--service-local');

const runtimePackages = [
  '@prisma/client',
  'bcrypt',
  'cors',
  'dotenv',
  'express',
  'ioredis',
  'jsonwebtoken',
  'luxon',
  'ws',
  'zod'
];

for (const packageName of runtimePackages) {
  if (serviceLocal) {
    const resolved = realpathSync(require.resolve(packageName));
    const packagePath = relative(realpathSync(localModules), resolved);
    if (packagePath.startsWith('..') || isAbsolute(packagePath)) {
      throw new Error(`${packageName} se resuelve fuera de backend/node_modules: ${resolved}. Instalá con npm ci --workspaces=false.`);
    }
  }
  await import(packageName);
}

const backend = await import('../dist/src/app.js');
if (typeof backend.app !== 'function' || typeof backend.httpServer?.listen !== 'function') {
  throw new Error('La salida compilada no exporta la aplicación Express y el servidor HTTP esperados.');
}

console.log(`Runtime backend verificado: ${runtimePackages.length} dependencias y dist/src/app.js cargaron correctamente.`);
