import { AccountTokenPurpose, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { prisma } from '../prisma/client.js';
import { HttpError } from '../utils/http-error.js';
import { assertEmailDeliveryConfigured, sendEmail } from './email.service.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function verificationMessage(email: string, token: string) {
  const url = `${config.publicAppUrl}/confirmar-email#token=${token}`;
  return {
    to: email,
    subject: 'Confirmá tu email · Lo del Profe',
    text: `Confirmá tu email para usar Lo del Profe. Abrí este enlace: ${url}\n\nEl enlace vence en ${config.emailVerificationTtlMinutes} minutos y funciona una sola vez.`,
    html: `<p>Confirmá tu email para usar Lo del Profe.</p><p><a href="${url}">Confirmar mi email</a></p><p>El enlace vence en ${config.emailVerificationTtlMinutes} minutos y funciona una sola vez.</p>`
  };
}

function resetMessage(email: string, token: string) {
  const url = `${config.publicAppUrl}/restablecer-contrasena#token=${token}`;
  return {
    to: email,
    subject: 'Restablecé tu contraseña · Lo del Profe',
    text: `Abrí este enlace para elegir una contraseña nueva: ${url}\n\nEl enlace vence en ${config.passwordResetTtlMinutes} minutos y funciona una sola vez.`,
    html: `<p>Recibimos una solicitud para cambiar tu contraseña.</p><p><a href="${url}">Elegir una contraseña nueva</a></p><p>El enlace vence en ${config.passwordResetTtlMinutes} minutos y funciona una sola vez.</p>`
  };
}

export async function issueAccountToken(input: {
  userId: number;
  email: string;
  purpose: AccountTokenPurpose;
  force?: boolean;
}) {
  assertEmailDeliveryConfigured();
  const now = new Date();
  const cooldownStart = new Date(now.getTime() - config.emailResendCooldownSeconds * 1000);
  const latest = await prisma.accountToken.findFirst({
    where: { userId: input.userId, purpose: input.purpose, consumedAt: null, invalidatedAt: null },
    orderBy: { createdAt: 'desc' }
  });
  if (!input.force && latest?.createdAt && latest.createdAt > cooldownStart) {
    throw new HttpError(429, 'Esperá un momento antes de pedir otro email.', 'EMAIL_RESEND_COOLDOWN');
  }

  const token = randomBytes(32).toString('base64url');
  const ttl = input.purpose === AccountTokenPurpose.EMAIL_VERIFICATION
    ? config.emailVerificationTtlMinutes
    : config.passwordResetTtlMinutes;
  await prisma.$transaction(async tx => {
    if (typeof (tx as Prisma.TransactionClient & { $queryRaw?: unknown }).$queryRaw === 'function') {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${input.userId} FOR UPDATE`);
    }
    await tx.accountToken.updateMany({
      where: { userId: input.userId, purpose: input.purpose, consumedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now }
    });
    await tx.accountToken.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        tokenHash: hashToken(token),
        targetEmail: input.email,
        expiresAt: new Date(now.getTime() + ttl * 60_000)
      }
    });
  });

  await sendEmail(input.purpose === AccountTokenPurpose.EMAIL_VERIFICATION
    ? verificationMessage(input.email, token)
    : resetMessage(input.email, token));
}

export async function consumeAccountToken<T>(input: {
  token: string;
  purpose: AccountTokenPurpose;
  apply: (tx: Prisma.TransactionClient, record: { id: string; userId: number; targetEmail: string }) => Promise<T>;
}) {
  if (!tokenPattern.test(input.token)) throw invalidToken();
  const now = new Date();
  return prisma.$transaction(async tx => {
    const record = await tx.accountToken.findFirst({
      where: {
        tokenHash: hashToken(input.token),
        purpose: input.purpose,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now }
      },
      select: { id: true, userId: true, targetEmail: true }
    });
    if (!record) throw invalidToken();
    const consumed = await tx.accountToken.updateMany({
      where: { id: record.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now }
    });
    if (!consumed.count) throw invalidToken();
    return input.apply(tx, record);
  });
}

export function invalidToken() {
  return new HttpError(400, 'El enlace es inválido, ya fue usado o venció.', 'INVALID_OR_EXPIRED_TOKEN');
}
