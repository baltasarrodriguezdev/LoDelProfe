import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma/client.js';
import { smsVerification } from '../src/services/sms-verification.service.js';
import { HttpError } from '../src/utils/http-error.js';

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
  db.user.findFirst = async () => ({ id: 7, firstName: 'Ana', lastName: 'Pérez', phone: '3510000000', passwordHash, role: 'CLIENT', active: true });
  db.user.findUnique = async () => ({ id: 7, firstName: 'Ana', lastName: 'Pérez', phone: '3510000000', passwordHash, role: 'CLIENT', active: true });
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
  const body = await response.json() as any;
  assert.equal(body.token, undefined);
  assert.equal(body.user.id, 7);

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: cookie.split(';')[0] } });
  assert.equal(me.status, 200);
});

test('rechaza operaciones mutables desde un origen no autorizado', async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: 'Origen no autorizado' });
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
  assert.match(body.errors.phone[0], /teléfono/i);
  assert.match(body.errors.password[0], /contraseña/i);
});

test('registro envía SMS y crea la cuenta solo después de verificar el código', async () => {
  const passwordHash = await bcrypt.hash('clave-segura', 4);
  let pending: any;
  let sentTo = '';
  db.user.findFirst = async () => null;
  db.pendingRegistration = {
    upsert: async ({ create }: any) => { pending = { id: 1, ...create, passwordHash }; return pending; },
    deleteMany: async () => ({ count: 1 }),
    findUnique: async () => pending,
    update: async () => pending
  };
  smsVerification.send = async phone => { sentTo = phone; };
  smsVerification.check = async () => true;

  const start = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ firstName: 'Ana', lastName: 'Pérez', phone: '+5493515551234', password: 'clave-segura' })
  });
  assert.equal(start.status, 202);
  assert.equal(sentTo, '+5493515551234');

  db.$transaction = async (work: any) => work({
    user: { findFirst: async () => null, create: async ({ data }: any) => ({ id: 12, role: 'CLIENT', active: true, ...data }) },
    pendingRegistration: { delete: async () => pending }
  });
  const verify = await fetch(`${baseUrl}/api/auth/register/verify`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ phone: '+5493515551234', code: '123456' })
  });
  assert.equal(verify.status, 201);
  assert.match(verify.headers.get('set-cookie') ?? '', /HttpOnly/i);
  const body = await verify.json() as any;
  assert.equal(body.user.phone, '5493515551234');
  assert.equal(body.token, undefined);
});

test('registro existente responde 409 y no intenta enviar SMS', async () => {
  let smsCalls = 0;
  db.user.findFirst = async () => ({ id: 20, phone: '5493576524440' });
  smsVerification.send = async () => { smsCalls += 1; };
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ firstName: 'Ana', lastName: 'Pérez', phone: '3576524440', password: 'clave-segura' })
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { message: 'Ya existe una cuenta con ese teléfono.' });
  assert.equal(smsCalls, 0);
});

test('una falla de Twilio responde 502 controlado y limpia el registro pendiente', async () => {
  let deleted = false;
  db.user.findFirst = async () => null;
  db.pendingRegistration = {
    findUnique: async () => null,
    upsert: async ({ create }: any) => create,
    deleteMany: async () => { deleted = true; return { count: 1 }; }
  };
  smsVerification.send = async () => { throw new HttpError(502, 'No pudimos enviar el SMS. Intentá nuevamente más tarde.'); };
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ firstName: 'Ana', lastName: 'Pérez', phone: '3576524440', password: 'clave-segura' })
  });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { message: 'No pudimos enviar el SMS. Intentá nuevamente más tarde.' });
  assert.equal(deleted, true);
});

test('expone health tanto bajo /api como en desarrollo sin prefijo', async () => {
  for (const path of ['/api/health', '/health']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  }
});
