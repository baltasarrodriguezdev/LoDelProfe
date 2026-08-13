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
  await import(packageName);
}

const backend = await import('../dist/src/app.js');
const defaultExport = backend.default?.default ?? backend.default;
if (typeof backend.app !== 'function' || defaultExport !== backend.app) {
  throw new Error('La salida compilada no exporta la aplicación Express y el servidor HTTP esperados.');
}

console.log(`Runtime backend verificado: ${runtimePackages.length} dependencias y dist/src/app.js cargaron correctamente.`);
