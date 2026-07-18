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
  db.user.findFirst = async () => ({ id: 7, firstName: 'Ana', lastName: 'Pérez', phone: '3510000000', passwordHash, role: 'CLIENT', active: true, phoneVerified: true, isBlocked: false });
  db.user.findUnique = async () => ({ id: 7, firstName: 'Ana', lastName: 'Pérez', phone: '3510000000', passwordHash, role: 'CLIENT', active: true, phoneVerified: true, isBlocked: false });
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ phone: '3510000000', password: 'clave-segura' })
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^padel_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /padel_csrf=/);
  const body = await response.json() as any;
  assert.equal(body.token, undefined);
  assert.equal(body.user.id, 7);
  assert.equal(body.user.phoneVerified, true);
  assert.equal(body.user.status, 'VERIFIED');

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: cookie.split(';')[0] } });
  assert.equal(me.status, 200);
});

test('rechaza login de usuario bloqueado', async () => {
  const passwordHash = await bcrypt.hash('clave-segura', 4);
  db.user.findFirst = async () => ({ id: 8, firstName: 'Ana', lastName: 'Pérez', phone: '3510000000', passwordHash, role: 'CLIENT', active: true, phoneVerified: false, isBlocked: true });
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ phone: '3510000000', password: 'clave-segura' })
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: 'Tu cuenta está bloqueada. Comunicate con la cancha.' });
});

test('login no queda bloqueado por una cookie de sesión previa sin CSRF', async () => {
  const passwordHash = await bcrypt.hash('clave-segura', 4);
  db.user.findFirst = async () => ({ id: 9, firstName: 'Admin', lastName: 'Club', phone: '3510000000', passwordHash, role: 'ADMIN', active: true, phoneVerified: true, isBlocked: false });
  db.user.findUnique = async () => ({ id: 9, firstName: 'Admin', lastName: 'Club', phone: '3510000000', passwordHash, role: 'ADMIN', active: true, phoneVerified: true, isBlocked: false });

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:4200', cookie: 'padel_session=old-session' },
    body: JSON.stringify({ phone: '3510000000', password: 'clave-segura' })
  });

  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.user.role, 'ADMIN');
});

test('rechaza operaciones mutables desde un origen no autorizado', async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: 'Origen no autorizado' });
});

test('acepta operaciones desde el dominio publico con www', async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { origin: 'https://www.lodelprofe.com' } });
  assert.equal(response.status, 204);
});

test('exige token CSRF cuando se usa cookie de sesión', async () => {
  const cookie = 'padel_session=fake-session; padel_csrf=fake-csrf';
  const rejected = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { origin: 'http://localhost:4200', cookie }
  });
  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), { message: 'Token CSRF inválido' });

  const accepted = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { origin: 'http://localhost:4200', cookie, 'x-csrf-token': 'fake-csrf' }
  });
  assert.equal(accepted.status, 204);
});

test('registro informa errores concretos por campo', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ firstName: 'A', lastName: '', phone: '123', password: 'corta' })
  });
  assert.equal(response.status, 400);
  const body = await response.json() as any;
  assert.match(body.errors.firstName[0], /nombre/i);
  assert.match(body.errors.lastName[0], /apellido/i);
  assert.match(body.errors.phone[0], /tel.fono/i);
  assert.match(body.errors.password[0], /contrase.a/i);
});

test('registro crea usuario no verificado e inicia sesión', async () => {
  let created: any;
  db.user.findFirst = async () => null;
  db.user.create = async ({ data }: any) => {
    created = { id: 12, role: 'CLIENT', active: true, createdAt: new Date(), updatedAt: new Date(), ...data };
    return created;
  };
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ firstName: 'Ana', lastName: 'Pérez', phone: '3576524440', password: 'clave-segura' })
  });
  assert.equal(response.status, 201);
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/i);
  const body = await response.json() as any;
  assert.equal(created.phone, '3576524440');
  assert.equal(created.phoneVerified, false);
  assert.equal(created.status, 'PENDING_VERIFICATION');
  assert.equal(created.isBlocked, false);
  assert.equal(body.user.passwordHash, undefined);
  assert.equal(body.user.phoneVerified, false);
  assert.equal(body.user.status, 'PENDING_VERIFICATION');
});

test('registro existente responde 409', async () => {
  db.user.findFirst = async () => ({ id: 20, phone: '3576524440' });
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ firstName: 'Ana', lastName: 'Pérez', phone: '3576524440', password: 'clave-segura' })
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { message: 'Ese teléfono ya está registrado' });
});

test('expone health tanto bajo /api como en desarrollo sin prefijo', async () => {
  for (const path of ['/api/health', '/health']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  }
});
