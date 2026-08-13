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
if (typeof backend.app !== 'function' || typeof backend.httpServer?.listen !== 'function') {
  throw new Error('La salida compilada no exporta la aplicación Express y el servidor HTTP esperados.');
}

console.log(`Runtime backend verificado: ${runtimePackages.length} dependencias y dist/src/app.js cargaron correctamente.`);
