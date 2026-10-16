import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AccountTokenPurpose, Role, UserStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { localArgentinaPhone, normalizeArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';
import { consumeAccountToken, issueAccountToken } from './account-token.service.js';
import { assertEmailDeliveryConfigured } from './email.service.js';
import { writeAudit } from './audit.service.js';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
const canonicalPhone = (value: string) => normalizeArgentinaPhone(value)!;
const storedPhone = (e164Phone: string) => localArgentinaPhone(e164Phone);

const publicUser = ({
  passwordHash: _, securityVersion: __, verificationCode: ___,
  phoneVerifiedById: ____, phoneVerificationMethod: _____,
  ...user
}: any) => ({
  ...user,
  emailVerified: Boolean(user.emailVerifiedAt),
  status: user.emailVerifiedAt ? UserStatus.VERIFIED : UserStatus.PENDING_VERIFICATION
});

function session(user: { id: number; role: Role; passwordHash: string; [key: string]: unknown }) {
  const scope = user.emailVerifiedAt ? 'full' : 'email_verification';
  return {
    token: jwt.sign(
      { userId: user.id, role: user.role, sessionVersion: Number(user.securityVersion ?? 0), scope },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    ),
    user: publicUser(user)
  };
}

export async function register(data: { firstName: string; lastName: string; email: string; phone: string; password: string }) {
  assertEmailDeliveryConfigured();
  const e164 = canonicalPhone(data.phone);
  const email = normalizeEmail(data.email);
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) throw new HttpError(409, 'Ese email ya está registrado.', 'EMAIL_ALREADY_REGISTERED');
  if (await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(e164) } } })) {
    throw new HttpError(409, 'Ese teléfono pertenece a un cliente existente. Actualizá tu acceso sin crear otra cuenta.', 'LEGACY_ACCOUNT_EXISTS');
  }
  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email,
      phone: storedPhone(e164),
      passwordHash: await bcrypt.hash(data.password, 12),
      phoneVerified: false,
      status: UserStatus.PENDING_VERIFICATION,
      isBlocked: false,
      active: true,
      verificationCode: null
    }
  });
  await writeAudit({ actorId: user.id, action: 'USER_REGISTERED', entityType: 'USER', entityId: user.id });
  await issueEmailVerification(user.id, email, true);
  return session(user);
}

export async function login(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    throw new HttpError(401, 'Email o contraseña incorrectos.', 'INVALID_CREDENTIALS');
  }
  if (!user.active) throw new HttpError(403, 'La cuenta no está activa.', 'CUSTOMER_INACTIVE');
  if (user.isBlocked) throw new HttpError(403, 'Tu cuenta está bloqueada. Comunicate con la cancha.', 'CUSTOMER_BLOCKED');
  if (!user.emailVerifiedAt) throw new HttpError(403, 'Primero tenés que confirmar tu email.', 'EMAIL_NOT_VERIFIED');
  return session(user);
}

export async function migrateLegacyAccess(data: { phone: string; password: string; email: string }) {
  assertEmailDeliveryConfigured();
  const e164 = canonicalPhone(data.phone);
  const email = normalizeEmail(data.email);
  const user = await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(e164) } } });
  if (!user || !await bcrypt.compare(data.password, user.passwordHash)) {
    throw new HttpError(401, 'Teléfono o contraseña incorrectos.', 'INVALID_LEGACY_CREDENTIALS');
  }
  const owner = await prisma.user.findUnique({ where: { email } });
  if (owner && owner.id !== user.id) throw new HttpError(409, 'Ese email ya está registrado.', 'EMAIL_ALREADY_REGISTERED');
  if (user.emailVerifiedAt) throw new HttpError(409, 'Esta cuenta ya actualizó su acceso. Ingresá con email.', 'ACCESS_ALREADY_MIGRATED');
  await prisma.user.update({ where: { id: user.id }, data: { email } });
  await writeAudit({ actorId: user.id, action: 'USER_ACCESS_MIGRATED', entityType: 'USER', entityId: user.id });
  await issueEmailVerification(user.id, email, true);
  return { message: 'Te enviamos un enlace para confirmar tu email.' };
}

export async function issueEmailVerification(userId: number, email: string, force = false) {
  await issueAccountToken({ userId, email, purpose: AccountTokenPurpose.EMAIL_VERIFICATION, force });
}

export async function resendEmailVerification(emailInput: string) {
  assertEmailDeliveryConfigured();
  const email = normalizeEmail(emailInput);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerifiedAt && user.active && !user.isBlocked) {
    try {
      await issueEmailVerification(user.id, email);
    } catch (error) {
      if (!(error instanceof HttpError) || error.code !== 'EMAIL_RESEND_COOLDOWN') throw error;
    }
  }
  return { message: 'Si la cuenta está pendiente, enviamos un nuevo enlace de confirmación.' };
}

export async function confirmEmail(token: string) {
  const verifiedAt = new Date();
  const userId = await consumeAccountToken({
    token,
    purpose: AccountTokenPurpose.EMAIL_VERIFICATION,
    apply: async (tx, record) => {
      const updated = await tx.user.updateMany({
        where: { id: record.userId, email: record.targetEmail, emailVerifiedAt: null },
        data: {
          emailVerifiedAt: verifiedAt,
          accessMigratedAt: verifiedAt,
          status: UserStatus.VERIFIED,
          securityVersion: { increment: 1 }
        }
      });
      if (!updated.count) throw new HttpError(400, 'El enlace ya no corresponde al email vigente.', 'INVALID_OR_EXPIRED_TOKEN');
      await tx.accountToken.updateMany({
        where: { userId: record.userId, purpose: AccountTokenPurpose.EMAIL_VERIFICATION, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: verifiedAt }
      });
      await writeAudit({ actorId: record.userId, action: 'USER_EMAIL_VERIFIED', entityType: 'USER', entityId: record.userId }, tx);
      return record.userId;
    }
  });
  return { userId, message: 'Email confirmado. Ya podés ingresar.' };
}

export async function me(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  return publicUser(user);
}
