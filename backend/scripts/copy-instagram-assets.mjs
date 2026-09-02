import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../assets/instagram', import.meta.url));
const target = fileURLToPath(new URL('../dist/assets/instagram', import.meta.url));

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
