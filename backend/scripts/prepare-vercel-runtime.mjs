import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// El builder de Services reubica src/app.js en la raíz de la función.
// Su resolución de paquetes necesita node_modules en esa misma raíz.
const source = fileURLToPath(new URL('../node_modules/', import.meta.url));
const target = fileURLToPath(new URL('../../node_modules/', import.meta.url));
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log('Dependencias de runtime preparadas en la raíz del repositorio para Vercel Services.');
