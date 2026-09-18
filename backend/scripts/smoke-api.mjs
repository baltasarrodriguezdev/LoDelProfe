import { createServer } from 'node:http';
import appModule from '../dist/src/app.js';
import { prisma } from '../dist/src/prisma/client.js';

const app = appModule.default ?? appModule;
const httpServer = createServer(app);

const expectedStatuses = new Map([
  ['/api/auth/me', 401],
  ['/api/league/active', 200],
  ['/api/realtime', 404]
]);

await new Promise((resolve, reject) => {
  httpServer.once('error', reject);
  httpServer.listen(0, '127.0.0.1', resolve);
});

try {
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('No se pudo resolver el puerto del smoke test.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const [path, expectedStatus] of expectedStatuses) {
    const response = await fetch(`${baseUrl}${path}`);
    console.log(`${path} -> ${response.status}`);
    if (response.status !== expectedStatus) {
      throw new Error(`${path} devolvió ${response.status}; se esperaba ${expectedStatus}: ${await response.text()}`);
    }
  }
} finally {
  await new Promise(resolve => httpServer.close(resolve));
  await prisma.$disconnect();
}
