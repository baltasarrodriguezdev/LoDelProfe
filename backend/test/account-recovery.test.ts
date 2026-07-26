import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma/client.js';
import { config } from '../src/config.js';

const db = prisma as any;
let server: ReturnType<typeof app.listen>;
let baseUrl = '';
const adminHeaders = () => ({
  authorization: `Bearer ${jwt.sign({ userId: 2, role: 'SUPERADMIN' }, config.jwtSecret)}`,
  'content-type': 'application/json',
  origin: 'http://localhost:4200'
});

before(async () => new Promise<void>(resolve => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de test');
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  });
}));
after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test('la solicitud de recuperación no revela si el teléfono existe', async () => {
  let createdFor: number | null = null;
  db.passwordResetRequest.findFirst = async () => null;
  db.passwordResetRequest.create = async ({ data }: any) => { createdFor = data.userId; return { id: 'reset-1', ...data }; };
  db.user.findFirst = async () => ({ id: 17, active: true, isBlocked: false, phoneVerified: true, status: 'VERIFIED' });
  const known = await fetch(`${baseUrl}/api/auth/password-reset-requests`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' }, body: JSON.stringify({ phone: '3576524440' }) });
  db.user.findFirst = async () => null;
  const unknown = await fetch(`${baseUrl}/api/auth/password-reset-requests`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' }, body: JSON.stringify({ phone: '3511112222' }) });
  assert.equal(known.status, 202); assert.equal(unknown.status, 202); assert.equal(createdFor, 17);
  assert.deepEqual(await known.json(), await unknown.json());
});

test('verificación manual exige el mismo remitente y el código correcto', async () => {
  db.auditLog.create = async ({ data }: any) => ({ id: 1n, ...data });
  let updateData: any;
  db.user.findUnique = async () => ({ id: 17, firstName: 'Ana', lastName: 'Pérez', phone: '3576524440', role: 'CLIENT', active: true, isBlocked: false, phoneVerified: false, status: 'PENDING_VERIFICATION', verificationCode: 'VAL-A1B2C3D4' });
  db.user.update = async ({ data }: any) => { updateData = data; return { id: 17, firstName: 'Ana', phone: '3576524440', ...data }; };
  const rejected = await fetch(`${baseUrl}/api/admin/users/17/verify`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ method: 'WHATSAPP_MANUAL', senderPhone: '3511112222', code: 'VAL-A1B2C3D4' }) });
  assert.equal(rejected.status, 400);
  const accepted = await fetch(`${baseUrl}/api/admin/users/17/verify`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ method: 'WHATSAPP_MANUAL', senderPhone: '+54 3576 524440', code: 'val-a1b2c3d4' }) });
  assert.equal(accepted.status, 200); assert.equal(updateData.phoneVerifiedById, 2); assert.equal(updateData.phoneVerificationMethod, 'WHATSAPP_MANUAL'); assert.equal(updateData.verificationCode, null);
  const body = await accepted.json() as any; assert.match(body.approvalWhatsappUrl, /^https:\/\/wa\.me\/5493576524440/);
});

test('autorización envía un token hasheado solamente al teléfono registrado', async () => {
  let saved: any;
  db.passwordResetRequest.findUnique = async () => ({ id: 'reset-1', status: 'PENDING', user: { id: 17, firstName: 'Ana', phone: '3576524440', active: true, isBlocked: false, phoneVerified: true, status: 'VERIFIED' } });
  db.passwordResetRequest.updateMany = async ({ data }: any) => { saved = data; return { count: 1 }; };
  const response = await fetch(`${baseUrl}/api/admin/password-reset-requests/reset-1/authorize`, { method: 'PATCH', headers: adminHeaders(), body: '{}' });
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  const url = new URL(body.whatsappUrl); assert.equal(url.pathname, '/5493576524440');
  const message = url.searchParams.get('text') ?? ''; const token = message.match(/#token=([A-Za-z0-9_-]{43})/)?.[1]; assert.ok(token);
  assert.equal(saved.tokenHash, createHash('sha256').update(token!).digest('hex')); assert.notEqual(saved.tokenHash, token); assert.equal(saved.authorizedById, 2);
});

test('el enlace se consume una vez e incrementa la versión de seguridad', async () => {
  const token = 'A'.repeat(43); let consumed = false; let userUpdate: any;
  db.passwordResetRequest.findFirst = async () => consumed ? null : ({ id: 'reset-1', userId: 17, status: 'AUTHORIZED', expiresAt: new Date(Date.now() + 60_000) });
  db.$transaction = async (work: any) => work({
    passwordResetRequest: { updateMany: async () => { consumed = true; return { count: 1 }; } },
    user: { update: async ({ data }: any) => { userUpdate = data; return { id: 17 }; } }
  });
  const first = await fetch(`${baseUrl}/api/auth/password-reset`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' }, body: JSON.stringify({ token, password: 'nueva-clave-segura' }) });
  assert.equal(first.status, 200); assert.deepEqual(userUpdate.securityVersion, { increment: 1 }); assert.notEqual(userUpdate.passwordHash, 'nueva-clave-segura');
  const second = await fetch(`${baseUrl}/api/auth/password-reset`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4200' }, body: JSON.stringify({ token, password: 'otra-clave-segura' }) });
  assert.equal(second.status, 400);
});
