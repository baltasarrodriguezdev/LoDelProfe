import bcrypt from 'bcrypt';
import { AccountTokenPurpose } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { consumeAccountToken, issueAccountToken } from './account-token.service.js';
import { assertEmailDeliveryConfigured, sendEmail } from './email.service.js';
import { HttpError } from '../utils/http-error.js';
import { writeAudit } from './audit.service.js';

const genericRequestMessage = 'Si el email corresponde a una cuenta habilitada, vas a recibir instrucciones para recuperar el acceso.';

export async function requestPasswordReset(emailInput: string) {
  assertEmailDeliveryConfigured();
  const startedAt = Date.now();
  const email = emailInput.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.active && !user.isBlocked && user.emailVerifiedAt) {
    try {
      await issueAccountToken({ userId: user.id, email, purpose: AccountTokenPurpose.PASSWORD_RESET });
    } catch (error) {
      // La cadencia de reenvÃ­o no debe revelar si el email pertenece a una cuenta.
      if (!(error instanceof HttpError) || error.code !== 'EMAIL_RESEND_COOLDOWN') throw error;
    }
  }
  const remaining = 250 - (Date.now() - startedAt);
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
  return { message: genericRequestMessage };
}

export async function resetPassword(token: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await consumeAccountToken({
    token,
    purpose: AccountTokenPurpose.PASSWORD_RESET,
    apply: async (tx, record) => {
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash, securityVersion: { increment: 1 } } });
      await tx.accountToken.updateMany({
        where: { userId: record.userId, purpose: AccountTokenPurpose.PASSWORD_RESET, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: new Date() }
      });
      await writeAudit({ actorId: record.userId, action: 'USER_PASSWORD_RESET', entityType: 'USER', entityId: record.userId }, tx);
      return { email: record.targetEmail };
    }
  });
  try {
    await sendEmail({
      to: result.email,
      subject: 'Tu contraseña fue actualizada · Lo del Profe',
      text: 'La contraseña de tu cuenta de Lo del Profe fue actualizada. Si no fuiste vos, contactá inmediatamente a la cancha.',
      html: '<p>La contraseña de tu cuenta de Lo del Profe fue actualizada.</p><p>Si no fuiste vos, contactá inmediatamente a la cancha.</p>'
    });
  } catch (error) {
    console.error('[email] no pudo enviarse el aviso de contraseña actualizada', { code: error instanceof Error ? error.name : 'unknown' });
  }
  return { message: 'Contraseña actualizada. Ya podés ingresar con tu nueva clave.' };
}
