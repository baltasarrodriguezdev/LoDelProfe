import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PasswordResetStatus } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { storedPhoneCandidates } from '../utils/argentina-phone.js';
import { publishAdminChange, publishUserChange } from '../realtime/events.js';

const genericRequestMessage = 'Si el teléfono corresponde a una cuenta habilitada, la solicitud aparecerá en administración.';
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const whatsappPhone = (stored: string) => {
  const local = stored.replace(/\D/g, '').replace(/^549?/, '');
  return `549${local}`;
};

export async function requestPasswordReset(e164Phone: string) {
  const startedAt = Date.now();
  const user = await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(e164Phone) } } });
  let changed = false;

  if (user?.active && !user.isBlocked && user.phoneVerified) {
    const existing = await prisma.passwordResetRequest.findFirst({
      where: { userId: user.id, status: { in: [PasswordResetStatus.PENDING, PasswordResetStatus.AUTHORIZED] } },
      orderBy: { requestedAt: 'desc' }
    });
    const stillUsable = existing?.status === PasswordResetStatus.PENDING
      || (existing?.status === PasswordResetStatus.AUTHORIZED && existing.expiresAt && existing.expiresAt > new Date());
    if (!stillUsable) {
      if (existing) {
        await prisma.passwordResetRequest.update({
          where: { id: existing.id },
          data: { status: existing.status === PasswordResetStatus.AUTHORIZED ? PasswordResetStatus.EXPIRED : PasswordResetStatus.CANCELLED }
        });
      }
      await prisma.passwordResetRequest.create({ data: { userId: user.id } });
      changed = true;
    }
  }

  const remaining = 250 - (Date.now() - startedAt);
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
  if (changed) await publishAdminChange('PASSWORD_RESET_CHANGED', 'PASSWORD_RESETS');
  return { message: genericRequestMessage };
}

export async function listPendingPasswordResets() {
  return prisma.passwordResetRequest.findMany({
    where: { status: PasswordResetStatus.PENDING },
    include: { user: { omit: { passwordHash: true, securityVersion: true } } },
    orderBy: { requestedAt: 'asc' }
  });
}

export async function authorizePasswordReset(id: string, adminId: number) {
  const request = await prisma.passwordResetRequest.findUnique({
    where: { id },
    include: { user: true }
  });
  if (!request || request.status !== PasswordResetStatus.PENDING) {
    throw new HttpError(409, 'La solicitud ya no está pendiente.');
  }
  if (!request.user.active || request.user.isBlocked || !request.user.phoneVerified) {
    throw new HttpError(409, 'La cuenta no está habilitada para recuperar la contraseña.');
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.passwordResetTtlMinutes * 60_000);
  const authorized = await prisma.passwordResetRequest.updateMany({
    where: { id, status: PasswordResetStatus.PENDING },
    data: {
      status: PasswordResetStatus.AUTHORIZED,
      tokenHash: tokenHash(token),
      authorizedAt: new Date(),
      authorizedById: adminId,
      expiresAt
    }
  });
  if (!authorized.count) throw new HttpError(409, 'La solicitud ya no está pendiente.');

  await publishAdminChange('PASSWORD_RESET_CHANGED', 'PASSWORD_RESETS');
  const resetUrl = `${config.publicAppUrl}/restablecer-contrasena#token=${token}`;
  const message = `Hola ${request.user.firstName}. Autorizamos tu solicitud para cambiar la contraseña de Lo del Profe.\n\nAbrí este enlace personal antes de ${expiresAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: config.timezone })}:\n${resetUrl}\n\nEl enlace funciona una sola vez. Si no hiciste esta solicitud, ignorá el mensaje y avisale a la cancha.`;
  return {
    id,
    expiresAt,
    whatsappUrl: `https://wa.me/${whatsappPhone(request.user.phone)}?text=${encodeURIComponent(message)}`
  };
}

export async function cancelPasswordReset(id: string) {
  const updated = await prisma.passwordResetRequest.updateMany({
    where: { id, status: PasswordResetStatus.PENDING },
    data: { status: PasswordResetStatus.CANCELLED, cancelledAt: new Date() }
  });
  if (!updated.count) throw new HttpError(409, 'La solicitud ya no está pendiente.');
  await publishAdminChange('PASSWORD_RESET_CHANGED', 'PASSWORD_RESETS');
  return { message: 'Solicitud de recuperación cancelada.' };
}

export async function resetPassword(token: string, password: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(400, 'El enlace es inválido o ya venció.');
  const request = await prisma.passwordResetRequest.findFirst({
    where: { tokenHash: tokenHash(token), status: PasswordResetStatus.AUTHORIZED, expiresAt: { gt: new Date() } }
  });
  if (!request) throw new HttpError(400, 'El enlace es inválido o ya venció.');

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async tx => {
    const consumed = await tx.passwordResetRequest.updateMany({
      where: { id: request.id, status: PasswordResetStatus.AUTHORIZED, expiresAt: { gt: new Date() } },
      data: { status: PasswordResetStatus.USED, usedAt: new Date(), tokenHash: null }
    });
    if (!consumed.count) throw new HttpError(400, 'El enlace es inválido o ya venció.');
    await tx.user.update({
      where: { id: request.userId },
      data: { passwordHash, securityVersion: { increment: 1 } }
    });
  });
  await Promise.all([
    publishAdminChange('PASSWORD_RESET_CHANGED', 'PASSWORD_RESETS'),
    publishUserChange('USER_UPDATED', request.userId)
  ]);
  return { message: 'Contraseña actualizada. Ya podés ingresar con tu nueva clave.' };
}
