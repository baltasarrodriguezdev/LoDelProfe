import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';

let server: ReturnType<typeof app.listen>;
let baseUrl = '';

before(async () => new Promise<void>(resolve => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de test');
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  });
}));
after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test('un usuario común no puede modificar ni consultar la administración de la liga', async () => {
  const token = jwt.sign({ userId: 99, role: 'CLIENT' }, config.jwtSecret);
  const response = await fetch(`${baseUrl}/api/admin/leagues`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 403);
  assert.match((await response.json() as { message: string }).message, /permisos/i);
});
