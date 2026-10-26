import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { EmailTokenPurpose } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const codeHash = (id: string, purpose: EmailTokenPurpose, code: string) =>
  createHmac('sha256', config.jwtSecret).update(`${id}:${purpose}:${code}`).digest('hex');
const codeError = () => new HttpError(400, 'El código es incorrecto o venció. Pedí uno nuevo si lo necesitás.');
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ensureEmailAvailable() {
  if (config.production && (!config.resendApiKey || !config.emailFrom)) {
    throw new HttpError(503, 'El correo todavía no está configurado. Intentá más tarde.');
  }
}

export function assertEmail(value: string) {
  const email = normalizeEmail(value);
  if (email.length > 255 || !validEmail.test(email)) throw new HttpError(400, 'Ingresá un email válido.');
  return email;
}

async function sendEmail(to: string, subject: string, text: string, idempotencyKey: string) {
  if (!config.resendApiKey || !config.emailFrom) {
    ensureEmailAvailable();
    console.info(`[email:development] ${subject} -> ${to}\n${text}`);
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({ from: config.emailFrom, to: [to], subject, text }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    console.error('[email] error del proveedor', response.status);
    throw new HttpError(503, 'No pudimos enviar el correo. Intentá nuevamente.');
  }
}

export async function issueEmailToken(userId: number, emailValue: string, purpose: EmailTokenPurpose) {
  const email = assertEmail(emailValue);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (purpose === EmailTokenPurpose.VERIFY ? 24 * 60 : config.passwordResetTtlMinutes) * 60_000);
  const row = await prisma.emailToken.create({ data: { userId, email, purpose, tokenHash: hash(token), expiresAt } });
  const path = purpose === EmailTokenPurpose.VERIFY ? 'confirmar-email' : 'restablecer-contrasena';
  const url = `${config.publicAppUrl}/${path}#token=${token}`;
  const subject = purpose === EmailTokenPurpose.VERIFY ? 'Confirmá tu email en Lo del Profe' : 'Recuperá tu contraseña de Lo del Profe';
  const text = `Hola. Abrí este enlace para ${purpose === EmailTokenPurpose.VERIFY ? 'confirmar tu email' : 'cambiar tu contraseña'}:\n${url}\n\nVence el ${expiresAt.toLocaleString('es-AR', { timeZone: config.timezone })}. Si no lo solicitaste, ignorá este mensaje.`;
  try {
    await sendEmail(email, subject, text, row.id);
  } catch (error) {
    await prisma.emailToken.delete({ where: { id: row.id } });
    throw error;
  }
}

export async function consumeEmailToken(token: string, purpose: EmailTokenPurpose) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(400, 'El enlace es inválido o venció.');
  const row = await prisma.emailToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= new Date()) throw new HttpError(400, 'El enlace es inválido o venció.');
  return row;
}

export async function issueEmailCode(userId: number, emailValue: string, purpose: EmailTokenPurpose) {
  const email = assertEmail(emailValue);
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  const id = randomUUID();
  const row = await prisma.emailToken.create({ data: { id, userId, email, purpose, tokenHash: codeHash(id, purpose, code), expiresAt } });
  const subject = purpose === EmailTokenPurpose.VERIFY ? 'Confirmá tu email en Lo del Profe' : 'Recuperá tu contraseña de Lo del Profe';
  const message = purpose === EmailTokenPurpose.VERIFY ? 'confirmar el email de tu cuenta' : 'recuperar tu contraseña';
  const content = `Tu código para ${message} en Lo del Profe es: ${code}\n\nIngresalo en la página. Vence en 10 minutos y se puede usar una sola vez. Si no lo solicitaste, ignorá este mensaje.`;
  try {
    await sendEmail(email, subject, content, row.id);
  } catch (error) {
    await prisma.emailToken.delete({ where: { id: row.id } });
    throw error;
  }
}

export async function findEmailCode(emailValue: string, purpose: EmailTokenPurpose, code: string) {
  const email = assertEmail(emailValue);
  if (!/^\d{6}$/.test(code)) throw codeError();
  const row = await prisma.emailToken.findFirst({
    where: { email, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' }
  });
  if (!row || row.attempts >= 5) throw codeError();
  const actual = Buffer.from(codeHash(row.id, purpose, code), 'hex');
  const expected = Buffer.from(row.tokenHash, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    await prisma.emailToken.updateMany({ where: { id: row.id, usedAt: null, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
    throw codeError();
  }
  return row;
}
