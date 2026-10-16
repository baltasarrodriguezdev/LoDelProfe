import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/prisma/client.js';
import { drainLocalMailbox } from '../src/services/email.service.js';

const db = prisma as any;
let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let users: any[] = [];
let tokens: any[] = [];
let nextUserId = 10;

const jsonHeaders = { 'content-type': 'application/json', origin: 'http://localhost:4200' };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function userDelegate() {
  return {
    findUnique: async ({ where }: any) => users.find(user => where.id === user.id || where.email === user.email) ?? null,
    findFirst: async ({ where }: any) => users.find(user => where.phone?.in?.includes(user.phone)) ?? null,
    create: async ({ data }: any) => {
      const user = { id: nextUserId++, role: 'CLIENT', securityVersion: 0, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data };
      users.push(user); return user;
    },
    update: async ({ where, data }: any) => {
      const user = users.find(item => item.id === where.id)!;
      Object.assign(user, data, data.securityVersion?.increment ? { securityVersion: user.securityVersion + data.securityVersion.increment } : {});
      return user;
    },
    updateMany: async ({ where, data }: any) => {
      const selected = users.filter(user => (!where.id || user.id === where.id) && (where.email === undefined || user.email === where.email) && (where.emailVerifiedAt !== null || user.emailVerifiedAt === null));
      for (const user of selected) Object.assign(user, data, data.securityVersion?.increment ? { securityVersion: user.securityVersion + data.securityVersion.increment } : {});
      return { count: selected.length };
    }
  };
}

function tokenDelegate() {
  return {
    findFirst: async ({ where }: any) => tokens.filter(token => {
      if (where.userId && token.userId !== where.userId) return false;
      if (where.purpose && token.purpose !== where.purpose) return false;
      if (where.tokenHash && token.tokenHash !== where.tokenHash) return false;
      if (where.consumedAt === null && token.consumedAt) return false;
      if (where.invalidatedAt === null && token.invalidatedAt) return false;
      if (where.expiresAt?.gt && token.expiresAt <= where.expiresAt.gt) return false;
      return true;
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
    create: async ({ data }: any) => { const token = { id: `token-${tokens.length + 1}`, consumedAt: null, invalidatedAt: null, createdAt: new Date(), ...data }; tokens.push(token); return token; },
    updateMany: async ({ where, data }: any) => {
      const selected = tokens.filter(token => (!where.id || token.id === where.id) && (!where.userId || token.userId === where.userId) && (!where.purpose || token.purpose === where.purpose) && (where.consumedAt !== null || !token.consumedAt) && (where.invalidatedAt !== null || !token.invalidatedAt) && (!where.expiresAt?.gt || token.expiresAt > where.expiresAt.gt));
      for (const token of selected) Object.assign(token, data);
      return { count: selected.length };
    }
  };
}

before(async () => new Promise<void>(resolve => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor');
    baseUrl = `http://127.0.0.1:${address.port}`; resolve();
  });
}));
after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

beforeEach(() => {
  users = []; tokens = []; nextUserId = 10; drainLocalMailbox();
  Object.assign(db.user, userDelegate());
  Object.assign(db.accountToken, tokenDelegate());
  db.auditLog.create = async ({ data }: any) => ({ id: 1n, ...data });
  db.$transaction = async (work: any) => work({ user: userDelegate(), accountToken: tokenDelegate() });
});

function tokenFromLastEmail() {
  const email = drainLocalMailbox().at(-1);
  const token = email?.text.match(/#token=([A-Za-z0-9_-]{43})/)?.[1];
  assert.ok(token); return token;
}

test('registro normaliza datos, conserva el hash y envía un token hasheado', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ firstName: 'Ana', lastName: 'Pérez', email: ' ANA@Example.COM ', phone: '5493576000000', password: 'frase-larga-segura' }) });
  assert.equal(response.status, 201);
  const setCookie = response.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /HttpOnly/i);
  assert.equal(users[0].email, 'ana@example.com'); assert.equal(users[0].phone, '3576000000');
  assert.equal(users[0].emailVerifiedAt, null); assert.equal(await bcrypt.compare('frase-larga-segura', users[0].passwordHash), true);
  const raw = tokenFromLastEmail(); assert.equal(tokens[0].tokenHash, hash(raw)); assert.notEqual(tokens[0].tokenHash, raw);
  const sessionCookie = setCookie.match(/padel_session=[^;,]+/)?.[0];
  assert.ok(sessionCookie);
  const privateResponse = await fetch(`${baseUrl}/api/bookings/my`, { headers: { cookie: sessionCookie } });
  assert.equal(privateResponse.status, 403);
  assert.equal((await privateResponse.json() as any).code, 'EMAIL_NOT_VERIFIED');
});

test('confirmación requiere POST, consume una vez e invalida la sesión limitada', async () => {
  const passwordHash = await bcrypt.hash('clave-segura', 4);
  users.push({ id: 7, firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', phone: '3576000000', passwordHash, role: 'CLIENT', active: true, isBlocked: false, securityVersion: 0, emailVerifiedAt: null });
  const raw = 'A'.repeat(43);
  tokens.push({ id: 't1', userId: 7, purpose: 'EMAIL_VERIFICATION', tokenHash: hash(raw), targetEmail: 'ana@example.com', expiresAt: new Date(Date.now() + 60_000), consumedAt: null, invalidatedAt: null, createdAt: new Date() });
  const first = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ token: raw }) });
  assert.equal(first.status, 200); assert.ok(users[0].emailVerifiedAt); assert.equal(users[0].securityVersion, 1);
  const second = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ token: raw }) });
  assert.equal(second.status, 400); assert.equal((await second.json() as any).code, 'INVALID_OR_EXPIRED_TOKEN');
});

test('rechaza tokens vencidos y de propósito incorrecto', async () => {
  const raw = 'B'.repeat(43);
  users.push({ id: 7, email: 'ana@example.com', emailVerifiedAt: null, securityVersion: 0 });
  tokens.push({ id: 't1', userId: 7, purpose: 'PASSWORD_RESET', tokenHash: hash(raw), targetEmail: 'ana@example.com', expiresAt: new Date(Date.now() + 60_000), consumedAt: null, invalidatedAt: null, createdAt: new Date() });
  let response = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ token: raw }) });
  assert.equal(response.status, 400);
  tokens[0].purpose = 'EMAIL_VERIFICATION'; tokens[0].expiresAt = new Date(Date.now() - 1);
  response = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ token: raw }) });
  assert.equal(response.status, 400);
});

test('login usa email, exige confirmación y respeta bloqueos', async () => {
  const passwordHash = await bcrypt.hash('clave-segura', 4);
  const user = { id: 7, firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', phone: '3576000000', passwordHash, role: 'CLIENT', active: true, isBlocked: false, securityVersion: 0, emailVerifiedAt: null };
  users.push(user);
  let response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'ana@example.com', password: 'clave-segura' }) });
  assert.equal(response.status, 403); assert.equal((await response.json() as any).code, 'EMAIL_NOT_VERIFIED');
  user.emailVerifiedAt = new Date();
  response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'ANA@example.com', password: 'clave-segura' }) });
  assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/i);
  const loginBody = await response.json() as any;
  assert.equal(loginBody.token, undefined);
  assert.equal(loginBody.user.passwordHash, undefined);
  user.isBlocked = true;
  response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'ana@example.com', password: 'clave-segura' }) });
  assert.equal(response.status, 403); assert.equal((await response.json() as any).code, 'CUSTOMER_BLOCKED');
});

test('reenvÃ­o invalida el enlace anterior y entrega uno nuevo', async () => {
  users.push({ id: 7, email: 'ana@example.com', emailVerifiedAt: null, active: true, isBlocked: false });
  tokens.push({ id: 'old', userId: 7, purpose: 'EMAIL_VERIFICATION', tokenHash: hash('A'.repeat(43)), targetEmail: 'ana@example.com', expiresAt: new Date(Date.now() + 60_000), consumedAt: null, invalidatedAt: null, createdAt: new Date(Date.now() - 120_000) });
  const response = await fetch(`${baseUrl}/api/auth/email-verification/resend`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'ana@example.com' }) });
  assert.equal(response.status, 202);
  assert.ok(tokens[0].invalidatedAt instanceof Date);
  assert.equal(tokens.length, 2);
  assert.ok(tokenFromLastEmail());
});

test('mantiene protecciÃ³n de origen y CSRF para operaciones con cookie', async () => {
  const badOrigin = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } });
  assert.equal(badOrigin.status, 403);
  const rejected = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { origin: 'http://localhost:4200', cookie: 'padel_session=fake; padel_csrf=expected', 'x-csrf-token': 'different' }
  });
  assert.equal(rejected.status, 403);
  const accepted = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { origin: 'http://localhost:4200', cookie: 'padel_session=fake; padel_csrf=expected', 'x-csrf-token': 'expected' }
  });
  assert.equal(accepted.status, 204);
});

test('cliente existente agrega email sobre el mismo ID sin alterar rol ni bloqueo', async () => {
  const passwordHash = await bcrypt.hash('clave-vieja', 4);
  const user = { id: 44, firstName: 'Admin', lastName: 'Club', phone: '3576000000', email: null, emailVerifiedAt: null, passwordHash, role: 'ADMIN', active: true, isBlocked: true, securityVersion: 5 };
  users.push(user);
  const response = await fetch(`${baseUrl}/api/auth/legacy-access`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ phone: '5493576000000', password: 'clave-vieja', email: 'admin@example.com' }) });
  assert.equal(response.status, 202); assert.equal(users[0].id, 44); assert.equal(users[0].role, 'ADMIN'); assert.equal(users[0].isBlocked, true); assert.equal(users[0].email, 'admin@example.com'); assert.equal(users[0].passwordHash, passwordHash);
});

test('no permite apropiarse de otra cuenta por coincidencia de teléfono o email', async () => {
  const passwordHash = await bcrypt.hash('clave-vieja', 4);
  users.push({ id: 1, phone: '3576000000', email: null, emailVerifiedAt: null, passwordHash, role: 'CLIENT', active: true, isBlocked: false }, { id: 2, phone: '3510000000', email: 'ocupado@example.com', emailVerifiedAt: new Date(), passwordHash, role: 'CLIENT', active: true, isBlocked: false });
  let response = await fetch(`${baseUrl}/api/auth/legacy-access`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ phone: '3576000000', password: 'incorrecta', email: 'nuevo@example.com' }) });
  assert.equal(response.status, 401); assert.equal(users[0].email, null);
  response = await fetch(`${baseUrl}/api/auth/legacy-access`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ phone: '3576000000', password: 'clave-vieja', email: 'ocupado@example.com' }) });
  assert.equal(response.status, 409); assert.equal(users[0].email, null);
});

test('recuperación responde genéricamente y revoca sesiones al consumir el enlace', async () => {
  const oldHash = await bcrypt.hash('clave-vieja', 4);
  users.push({ id: 7, email: 'ana@example.com', emailVerifiedAt: new Date(), passwordHash: oldHash, role: 'CLIENT', active: true, isBlocked: false, securityVersion: 2 });
  const known = await fetch(`${baseUrl}/api/auth/password-reset-requests`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'ana@example.com' }) });
  const raw = tokenFromLastEmail();
  const unknown = await fetch(`${baseUrl}/api/auth/password-reset-requests`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ email: 'nadie@example.com' }) });
  assert.equal(known.status, 202); assert.equal(unknown.status, 202); assert.deepEqual(await known.json(), await unknown.json());
  const reset = await fetch(`${baseUrl}/api/auth/password-reset`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ token: raw, password: 'clave-nueva-segura' }) });
  assert.equal(reset.status, 200); assert.equal(users[0].securityVersion, 3); assert.equal(await bcrypt.compare('clave-nueva-segura', users[0].passwordHash), true);
});

test('las rutas antiguas de aprobación y recuperación administrativa ya no existen', async () => {
  const authorization = `Bearer ${jwt.sign({ userId: 1, role: 'SUPERADMIN', scope: 'full' }, config.jwtSecret)}`;
  const headers = { ...jsonHeaders, authorization };
  const oldVerify = await fetch(`${baseUrl}/api/admin/users/7/verify`, { method: 'PATCH', headers, body: '{}' });
  const oldRecovery = await fetch(`${baseUrl}/api/admin/password-reset-requests/x/authorize`, { method: 'PATCH', headers, body: '{}' });
  assert.equal(oldVerify.status, 404); assert.equal(oldRecovery.status, 404);
});

test('los JWT del login telefÃ³nico anterior quedan revocados', async () => {
  const legacyToken = jwt.sign({ userId: 7, role: 'CLIENT' }, config.jwtSecret);
  const response = await fetch(`${baseUrl}/api/bookings/my`, { headers: { authorization: `Bearer ${legacyToken}` } });
  assert.equal(response.status, 401);
  assert.equal((await response.json() as any).code, 'LEGACY_SESSION_REVOKED');
});

test('sin proveedor de correo no activa cuentas ni finge un envÃ­o exitoso', async () => {
  const previous = { ...config.email };
  Object.assign(config.email, { provider: 'disabled', configured: false });
  try {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ firstName: 'Ana', lastName: 'PÃ©rez', email: 'ana@example.com', phone: '3576000000', password: 'frase-larga-segura' })
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json() as any).code, 'EMAIL_NOT_CONFIGURED');
    assert.equal(users.length, 0);
    assert.equal(tokens.length, 0);
  } finally {
    Object.assign(config.email, previous);
  }
});
