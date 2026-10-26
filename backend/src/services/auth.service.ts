import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { normalizeArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';
import { assertEmail, ensureEmailAvailable, issueEmailCode, normalizeEmail } from './email.service.js';
import { EmailTokenPurpose } from '@prisma/client';

const publicUser = ({ passwordHash: _, securityVersion: __, ...user }: any) => ({
  ...user,
  status: user.phoneVerified === true ? UserStatus.VERIFIED : UserStatus.PENDING_VERIFICATION
});

function session(user: { id: number; role: Role; passwordHash: string; [key: string]: unknown }) {
  return {
    token: jwt.sign({ userId: user.id, role: user.role, sessionVersion: Number(user.securityVersion ?? 0) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }),
    user: publicUser(user)
  };
}

export async function register(data: { firstName: string; lastName: string; email: string; password: string }) {
  ensureEmailAvailable();
  const email = assertEmail(data.email);
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'Ese email ya está registrado');
  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email,
      passwordHash: await bcrypt.hash(data.password, 12),
      phoneVerified: false,
      status: UserStatus.PENDING_VERIFICATION,
      isBlocked: false,
      active: true
    }
  });
  try {
    await issueEmailCode(user.id, email, EmailTokenPurpose.VERIFY);
  } catch (error) {
    console.error('[auth] cuenta creada; el email inicial no pudo enviarse', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
  }
  return session(user);
}

export async function login(input: string, password: string) {
  const email = input.includes('@') ? normalizeEmail(input) : null;
  const phone = email ? null : normalizeArgentinaPhone(input);
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : phone ? await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(phone) }, legacyAccount: true, emailVerifiedAt: null } }) : null;
  if (!user || !user.active || !await bcrypt.compare(password, user.passwordHash)) {
    throw new HttpError(401, 'Email, teléfono o contraseña incorrectos');
  }
  if (user.isBlocked) {
    throw new HttpError(403, 'Tu cuenta está bloqueada. Comunicate con la cancha.');
  }
  return session(user);
}

export async function requestEmailVerification(userId: number, value: string, password?: string) {
  ensureEmailAvailable();
  const email = assertEmail(value);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active || user.isBlocked) throw new HttpError(403, 'La cuenta no está habilitada.');
  if (user.emailVerifiedAt) throw new HttpError(409, 'El email ya está confirmado.');
  if (user.legacyAccount && email !== user.email && (!password || !await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Ingresá tu contraseña actual para vincular el email.');
  }
  const owner = await prisma.user.findUnique({ where: { email } });
  if (owner && owner.id !== userId) throw new HttpError(409, 'Ese email ya está registrado');
  await prisma.user.update({ where: { id: userId }, data: { email } });
  await issueEmailCode(userId, email, EmailTokenPurpose.VERIFY);
  return { message: 'Te enviamos un código de 6 dígitos. Vence en 10 minutos.' };
}

export async function me(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  return publicUser(user);
}
