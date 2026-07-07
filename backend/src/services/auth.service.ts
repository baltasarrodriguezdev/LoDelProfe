import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { normalizeArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';
import { smsVerification } from './sms-verification.service.js';

const canonicalPhone = (value: string) => normalizeArgentinaPhone(value)!;
const storedPhone = (e164Phone: string) => e164Phone.slice(1);
const publicUser = ({ passwordHash: _, ...user }: any) => user;
function session(user: { id: number; role: Role; passwordHash: string; [key: string]: unknown }) {
  return {
    token: jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }),
    user: publicUser(user)
  };
}

export async function startRegistration(data: { firstName: string; lastName: string; phone: string; password: string }) {
  const e164 = canonicalPhone(data.phone);
  const phone = storedPhone(e164);
  if (await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(e164) } } })) {
    throw new HttpError(409, 'Ya existe una cuenta con ese teléfono.');
  }
  const previous = await prisma.pendingRegistration.findUnique({ where: { phone } });
  if (previous && previous.updatedAt > new Date(Date.now() - 60_000)) {
    throw new HttpError(429, 'Esperá un minuto antes de solicitar otro código.');
  }
  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.pendingRegistration.upsert({
    where: { phone },
    update: { firstName: data.firstName, lastName: data.lastName, passwordHash, expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0 },
    create: { firstName: data.firstName, lastName: data.lastName, phone, passwordHash, expiresAt: new Date(Date.now() + 10 * 60_000) }
  });
  try {
    await smsVerification.send(e164);
  } catch (error) {
    await prisma.pendingRegistration.deleteMany({ where: { phone } });
    throw error;
  }
  return { verificationRequired: true, phone: e164 };
}

export async function completeRegistration(input: string, code: string) {
  const e164 = canonicalPhone(input);
  const phone = storedPhone(e164);
  const pending = await prisma.pendingRegistration.findUnique({ where: { phone } });
  if (!pending || pending.expiresAt < new Date()) throw new HttpError(400, 'La verificación venció. Solicitá un código nuevo.');
  if (pending.attempts >= 5) throw new HttpError(429, 'Superaste la cantidad de intentos. Solicitá un código nuevo.');
  const approved = await smsVerification.check(e164, code);
  if (!approved) {
    await prisma.pendingRegistration.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, 'El código ingresado es incorrecto.');
  }
  return prisma.$transaction(async transaction => {
    if (await transaction.user.findFirst({ where: { phone: { in: storedPhoneCandidates(e164) } } })) {
      throw new HttpError(409, 'Ya existe una cuenta con ese teléfono.');
    }
    const user = await transaction.user.create({ data: { firstName: pending.firstName, lastName: pending.lastName, phone, passwordHash: pending.passwordHash } });
    await transaction.pendingRegistration.delete({ where: { phone } });
    return session(user);
  });
}

export async function login(input: string, password: string) {
  const e164 = canonicalPhone(input);
  const user = await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(e164) } } });
  if (!user || !user.active || !await bcrypt.compare(password, user.passwordHash)) {
    throw new HttpError(401, 'Teléfono o contraseña incorrectos');
  }
  return session(user);
}

export async function me(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  return publicUser(user);
}
