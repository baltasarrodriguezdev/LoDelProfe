import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/prisma/client.js';

const db = prisma as any;
let server: ReturnType<typeof app.listen>;
let baseUrl = '';

const token = (userId: number, role: 'CLIENT' | 'ADMIN' | 'SUPERADMIN' = 'SUPERADMIN') => jwt.sign({ userId, role }, config.jwtSecret);
const headers = (role: 'CLIENT' | 'ADMIN' | 'SUPERADMIN' = 'SUPERADMIN') => ({
  'content-type': 'application/json',
  authorization: `Bearer ${token(1, role)}`
});

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

beforeEach(() => {
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, role: 'SUPERADMIN', active: true });
  db.user.findFirst = async () => null;
});

test('superadmin crea cliente pendiente sin exponer passwordHash', async () => {
  let created: any;
  db.user.create = async ({ data, omit }: any) => {
    assert.deepEqual(omit, { passwordHash: true });
    created = { id: 50, createdAt: new Date(), updatedAt: new Date(), ...data };
    const { passwordHash: _passwordHash, ...publicUser } = created;
    return publicUser;
  };

  const response = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ firstName: 'Baltasar', lastName: 'Rodriguez', phone: '3576 468131', password: 'clave-segura' })
  });

  assert.equal(response.status, 201);
  const body = await response.json() as any;
  assert.equal(created.phone, '3576468131');
  assert.equal(created.role, 'CLIENT');
  assert.equal(created.active, true);
  assert.equal(created.phoneVerified, false);
  assert.equal(created.status, 'PENDING_VERIFICATION');
  assert.equal(created.isBlocked, false);
  assert.equal(await bcrypt.compare('clave-segura', created.passwordHash), true);
  assert.equal(body.passwordHash, undefined);
});

test('alta manual rechaza telefono duplicado', async () => {
  db.user.findFirst = async () => ({ id: 51, phone: '3576468131' });

  const response = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ firstName: 'Baltasar', lastName: 'Rodriguez', phone: '3576 468131', password: 'clave-segura' })
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { message: 'Ese teléfono ya está registrado' });
});

test('admin no superadmin no puede crear clientes', async () => {
  const response = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: headers('ADMIN'),
    body: JSON.stringify({ firstName: 'Ana', lastName: 'Perez', phone: '3576468131', password: 'clave-segura' })
  });

  assert.equal(response.status, 403);
});