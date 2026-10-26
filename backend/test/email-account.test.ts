import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/prisma/client.js';

const db = prisma as any;
let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let user: any;
let verificationToken: any;
let consumed = false;
const token = 'A'.repeat(43);
const headers = (id = 17) => ({
  'content-type': 'application/json', origin: 'http://localhost:4200',
  authorization: `Bearer ${jwt.sign({ userId: id, role: 'CLIENT' }, config.jwtSecret)}`
});

before(async () => new Promise<void>(resolve => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Sin puerto de prueba');
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  });
}));
after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

beforeEach(async () => {
  consumed = false;
  user = {
    id: 17, firstName: 'Ana', lastName: 'Pérez', phone: '3515551234', email: null,
    passwordHash: await bcrypt.hash('clave-antigua-123', 4), role: 'CLIENT',
    legacyAccount: true, emailVerifiedAt: null, bookingApprovedAt: new Date(),
    active: true, isBlocked: false, securityVersion: 0
  };
  db.user.findFirst = async ({ where }: any) => where.legacyAccount && !user.emailVerifiedAt ? user : null;
  db.user.findUnique = async ({ where }: any) => where.id ? user : where.email === user.email ? user : null;
  db.user.update = async ({ data }: any) => { user = { ...user, ...data }; return user; };
  db.emailToken.deleteMany = async () => ({ count: 0 });
  db.emailToken.create = async ({ data }: any) => ({ id: 'verify-17', ...data });
  db.emailToken.delete = async () => ({});
  verificationToken = {
    id: 'verify-17', userId: 17, email: 'ana@ejemplo.com', purpose: 'VERIFY',
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 60_000), usedAt: null
  };
  db.emailToken.findUnique = async () => verificationToken;
  db.emailToken.findFirst = async () => verificationToken;
  db.emailToken.updateMany = async () => { if (consumed) return { count: 0 }; consumed = true; return { count: 1 }; };
  db.$transaction = async (work: any) => work({ user: db.user, emailToken: db.emailToken, passwordResetRequest: { updateMany: async () => ({ count: 0 }) } });
});

test('cliente anterior vincula email con la contraseña existente y conserva el usuario', async () => {
  const rejected = await fetch(`${baseUrl}/api/auth/email-verification/request`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ email: 'ana@ejemplo.com', password: 'incorrecta' })
  });
  assert.equal(rejected.status, 401);
  assert.equal(user.email, null);

  const requested = await fetch(`${baseUrl}/api/auth/email-verification/request`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ email: 'Ana@Ejemplo.com', password: 'clave-antigua-123' })
  });
  assert.equal(requested.status, 200);
  assert.equal(user.id, 17);
  assert.equal(user.email, 'ana@ejemplo.com');
  assert.ok(user.bookingApprovedAt);
});

test('confirmar email consume el enlace una vez y cierra el login anterior', async () => {
  user.email = 'ana@ejemplo.com';
  const first = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' }, body: JSON.stringify({ token })
  });
  assert.equal(first.status, 200);
  assert.ok(user.emailVerifiedAt);
  const second = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' }, body: JSON.stringify({ token })
  });
  assert.equal(second.status, 400);
  const oldLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ phone: '3515551234', password: 'clave-antigua-123' })
  });
  assert.equal(oldLogin.status, 401);
  const emailLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ email: 'ana@ejemplo.com', password: 'clave-antigua-123' })
  });
  assert.equal(emailLogin.status, 200);
});

test('el código de email admite un error y se confirma una sola vez', async () => {
  let emailOutput = '';
  const previousInfo = console.info;
  console.info = (...parts: unknown[]) => { emailOutput += parts.join(' '); };
  try {
    db.emailToken.create = async ({ data }: any) => {
      verificationToken = { ...data, usedAt: null, attempts: 0 };
      return verificationToken;
    };
    db.emailToken.findFirst = async () => verificationToken;
    db.emailToken.updateMany = async ({ data }: any) => {
      if (data.attempts) { verificationToken.attempts++; return { count: 1 }; }
      if (verificationToken.usedAt) return { count: 0 };
      verificationToken.usedAt = new Date(); return { count: 1 };
    };
    const requested = await fetch(`${baseUrl}/api/auth/email-verification/request`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ email: 'ana@ejemplo.com', password: 'clave-antigua-123' })
    });
    assert.equal(requested.status, 200);
    const code = emailOutput.match(/es: (\d{6})/)?.[1];
    assert.ok(code);
    assert.notEqual(verificationToken.tokenHash, code);
    const incorrect = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
      body: JSON.stringify({ email: 'ana@ejemplo.com', code: code === '000000' ? '111111' : '000000' })
    });
    assert.equal(incorrect.status, 400);
    assert.equal(verificationToken.attempts, 1);
    const confirmed = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
      body: JSON.stringify({ email: 'ana@ejemplo.com', code })
    });
    assert.equal(confirmed.status, 200);
    assert.ok(user.emailVerifiedAt);
    const replay = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
      body: JSON.stringify({ email: 'ana@ejemplo.com', code })
    });
    assert.equal(replay.status, 400);
  } finally { console.info = previousInfo; }
});

test('el código se bloquea tras cinco errores y no acepta uno vencido', async () => {
  user.email = 'ana@ejemplo.com';
  verificationToken = {
    id: 'code-17', userId: 17, email: user.email, purpose: 'VERIFY',
    tokenHash: '0'.repeat(64), attempts: 0, usedAt: null,
    expiresAt: new Date(Date.now() + 60_000)
  };
  db.emailToken.findFirst = async () => verificationToken;
  db.emailToken.updateMany = async ({ data }: any) => {
    if (data.attempts) verificationToken.attempts++;
    return { count: 1 };
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
      body: JSON.stringify({ email: user.email, code: '123456' })
    });
    assert.equal(response.status, 400);
  }
  assert.equal(verificationToken.attempts, 5);
  const blocked = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ email: user.email, code: '123456' })
  });
  assert.equal(blocked.status, 400);
  assert.equal(verificationToken.attempts, 5);
  verificationToken.attempts = 0;
  verificationToken.expiresAt = new Date(Date.now() - 1000);
  db.emailToken.findFirst = async () => null;
  const expired = await fetch(`${baseUrl}/api/auth/email-verification/confirm`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
    body: JSON.stringify({ email: user.email, code: '123456' })
  });
  assert.equal(expired.status, 400);
});

test('recuperar contraseña con código consume el código y cambia la clave', async () => {
  user.email = 'ana@ejemplo.com';
  user.emailVerifiedAt = new Date();
  let emailOutput = '';
  const previousInfo = console.info;
  console.info = (...parts: unknown[]) => { emailOutput += parts.join(' '); };
  try {
    db.emailToken.create = async ({ data }: any) => {
      verificationToken = { ...data, usedAt: null, attempts: 0 };
      return verificationToken;
    };
    db.emailToken.findFirst = async () => verificationToken;
    db.emailToken.updateMany = async ({ data }: any) => {
      if (data.attempts) { verificationToken.attempts++; return { count: 1 }; }
      if (verificationToken.usedAt) return { count: 0 };
      verificationToken.usedAt = new Date(); return { count: 1 };
    };
    const requested = await fetch(`${baseUrl}/api/auth/email-password-reset/request`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
      body: JSON.stringify({ email: user.email })
    });
    assert.equal(requested.status, 202);
    const code = emailOutput.match(/es: (\d{6})/)?.[1];
    assert.ok(code);
    const oldHash = user.passwordHash;
    const confirmed = await fetch(`${baseUrl}/api/auth/email-password-reset/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
      body: JSON.stringify({ email: user.email, code, password: 'clave-nueva-123' })
    });
    assert.equal(confirmed.status, 200);
    assert.notEqual(user.passwordHash, oldHash);
    assert.equal(await bcrypt.compare('clave-nueva-123', user.passwordHash), true);
    const replay = await fetch(`${baseUrl}/api/auth/email-password-reset/confirm`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' },
      body: JSON.stringify({ email: user.email, code, password: 'otra-clave-123' })
    });
    assert.equal(replay.status, 400);
  } finally { console.info = previousInfo; }
});
