import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { localArgentinaPhone, normalizeArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';

const canonicalPhone = (value: string) => normalizeArgentinaPhone(value)!;
const storedPhone = (e164Phone: string) => localArgentinaPhone(e164Phone);
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

export async function register(data: { firstName: string; lastName: string; phone: string; password: string }) {
  const e164 = canonicalPhone(data.phone);
  const phone = storedPhone(e164);
  if (await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(e164) } } })) {
    throw new HttpError(409, 'Ese teléfono ya está registrado');
  }
  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone,
      passwordHash: await bcrypt.hash(data.password, 12),
      phoneVerified: false,
      status: UserStatus.PENDING_VERIFICATION,
      isBlocked: false,
      active: true,
      verificationCode: `VAL-${randomBytes(4).toString('hex').toUpperCase()}`
    }
  });
  return session(user);
}

export async function login(input: string, password: string) {
  const e164 = canonicalPhone(input);
  const user = await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(e164) } } });
  if (!user || !user.active || !await bcrypt.compare(password, user.passwordHash)) {
    throw new HttpError(401, 'Teléfono o contraseña incorrectos');
  }
  if (user.isBlocked) {
    throw new HttpError(403, 'Tu cuenta está bloqueada. Comunicate con la cancha.');
  }
  return session(user);
}

export async function me(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  return publicUser(user);
}
