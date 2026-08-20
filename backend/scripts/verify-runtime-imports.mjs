const runtimePackages = [
  '@prisma/client',
  '@resvg/resvg-js',
  'bcrypt',
  'cors',
  'dotenv',
  'express',
  'ioredis',
  'jsonwebtoken',
  'jszip',
  'luxon',
  'satori',
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

const lazyRuntimeModules = [
  'booking.routes.js',
  'league-public.routes.js',
  'league-admin.routes.js',
  'dashboard.routes.js',
  'admin.routes.js'
];
for (const moduleName of lazyRuntimeModules) {
  const module = await import(`../dist/src/routes/${moduleName}`);
  const exportedRouter = module.default?.default ?? module.default;
  if (typeof exportedRouter !== 'function') throw new Error(`${moduleName} no exporta un router ejecutable.`);
}

console.log(`Runtime backend verificado: ${runtimePackages.length} dependencias, app y ${lazyRuntimeModules.length} routers lazy cargaron correctamente.`);
