import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma/client.js';

const db = prisma as any;
let server: ReturnType<typeof app.listen>;
let baseUrl = '';

before(async () => {
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de test');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});
after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test('login guarda JWT en cookie HttpOnly y no lo expone en JSON', async () => {
  const passwordHash = await bcrypt.hash('clave-segura', 4);
  db.user.findUnique = async () => ({ id: 7, firstName: 'Ana', lastName: 'Pérez', phone: '3510000000', passwordHash, role: 'CLIENT', active: true });
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ phone: '3510000000', password: 'clave-segura' })
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^padel_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  const body = await response.json() as any;
  assert.equal(body.token, undefined);
  assert.equal(body.user.id, 7);

  const me = await fetch(`${baseUrl}/auth/me`, { headers: { cookie: cookie.split(';')[0] } });
  assert.equal(me.status, 200);
});

test('rechaza operaciones mutables desde un origen no autorizado', async () => {
  const response = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: 'Origen no autorizado' });
});