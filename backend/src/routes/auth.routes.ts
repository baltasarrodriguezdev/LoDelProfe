import { Router, Response } from 'express';
import { z } from 'zod';
import * as auth from '../services/auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { authenticate } from '../middlewares/auth.js';
import { createCsrfToken, rateLimit } from '../middlewares/security.js';
import { config } from '../config.js';
import { ARGENTINA_PHONE_ERROR, localArgentinaPhone, normalizeArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';
import * as passwordReset from '../services/password-reset.service.js';
import { publishUserChange } from '../realtime/events.js';
import { EmailTokenPurpose } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { consumeEmailToken, ensureEmailAvailable, findEmailCode, issueEmailCode, normalizeEmail } from '../services/email.service.js';
import { HttpError } from '../utils/http-error.js';
import bcrypt from 'bcrypt';

const required = (field: string) => ({ required_error: `Ingresá ${field}`, invalid_type_error: `Ingresá ${field}` });
const phoneSchema = z.string(required('tu teléfono')).transform((value, context) => {
  const normalized = normalizeArgentinaPhone(value);
  if (!normalized) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: ARGENTINA_PHONE_ERROR });
    return z.NEVER;
  }
  return normalized;
});
const registrationSchema = z.object({
  firstName: z.string(required('tu nombre')).trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string(required('tu apellido')).trim().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string(required('tu email')).trim().email('Ingresá un email válido.').max(255),
  password: z.string(required('una contraseña')).min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'La contraseña es demasiado larga')
});

const router = Router();
const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'lax' as const, path: '/', maxAge: config.authCookieMaxAgeMs };
const csrfCookieOptions = {
  httpOnly: false,
  secure: config.production,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: config.authCookieMaxAgeMs,
  ...(config.csrfCookieDomain ? { domain: config.csrfCookieDomain } : {})
};
const clearCookieOptions = { httpOnly: true, secure: config.production, sameSite: 'lax' as const, path: '/' };
const clearCsrfCookieOptions = {
  httpOnly: false,
  secure: config.production,
  sameSite: 'lax' as const,
  path: '/',
  ...(config.csrfCookieDomain ? { domain: config.csrfCookieDomain } : {})
};
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  key: req => `${req.ip ?? 'unknown'}:${String(req.body?.email ?? req.body?.phone ?? '').trim().toLowerCase()}`
});
const recoveryRequestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  key: req => `${req.ip ?? 'unknown'}:${String(req.body?.email ?? req.body?.phone ?? '').trim().toLowerCase()}`
});
const emailCodeRequestRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  key: req => `${req.ip ?? 'unknown'}:${req.auth?.userId ?? 'guest'}:${String(req.body?.email ?? '').trim().toLowerCase()}`
});
const recoveryAttemptRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: req => `${req.ip ?? 'unknown'}:${String(req.body?.email ?? req.body?.token ?? '').trim().toLowerCase().slice(0, 100)}`
});
const establish = (res: Response, result: { token: string; user: unknown }, status = 200) =>
  res.status(status)
    .cookie(config.authCookieName, result.token, cookieOptions)
    .cookie(config.csrfCookieName, createCsrfToken(), csrfCookieOptions)
    .json({ user: result.user });

router.post('/register', authRateLimit, asyncHandler(async (req, res) => {
  const data = registrationSchema.parse(req.body);
  const result = await auth.register(data);
  const userId = (result.user as { id: number }).id;
  await publishUserChange('USER_CREATED', userId);
  establish(res, result, 201);
}));
router.post('/login', authRateLimit, asyncHandler(async (req, res) => {
  const data = z.object({ email: z.string().optional(), phone: z.string().optional(), password: z.string(required('tu contraseña')).min(1, 'Ingresá tu contraseña') }).parse(req.body);
  establish(res, await auth.login(data.email || data.phone || '', data.password));
}));
router.post('/email-verification/request', authenticate, emailCodeRequestRateLimit, asyncHandler(async (req, res) => {
  const data = z.object({ email: z.string().email(), password: z.string().optional() }).parse(req.body);
  res.json(await auth.requestEmailVerification(req.auth!.userId, data.email, data.password));
}));
router.post('/email-verification/confirm', authRateLimit, asyncHandler(async (req, res) => {
  const data = z.object({ token: z.string().optional(), email: z.string().email().optional(), code: z.string().regex(/^\d{6}$/).optional() })
    .refine(value => Boolean(value.token || (value.email && value.code)), 'Ingresá el email y el código.').parse(req.body);
  const row = data.token
    ? await consumeEmailToken(data.token, EmailTokenPurpose.VERIFY)
    : await findEmailCode(data.email!, EmailTokenPurpose.VERIFY, data.code!);
  await prisma.$transaction(async tx => {
    const consumed = await tx.emailToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() }, ...(data.token ? {} : { attempts: { lt: 5 } }) }, data: { usedAt: new Date() } });
    if (!consumed.count) throw new HttpError(400, 'El enlace es inválido o venció.');
    const owner = await tx.user.findUnique({ where: { id: row.userId } });
    if (!owner || owner.email !== row.email || owner.emailVerifiedAt) throw new HttpError(400, 'El enlace ya no corresponde a este email.');
    await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
    await tx.passwordResetRequest.updateMany({
      where: { userId: row.userId, status: { in: ['PENDING', 'AUTHORIZED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), tokenHash: null }
    });
  });
  await publishUserChange('USER_UPDATED', row.userId);
  res.json({ message: 'Email confirmado. Ya podés continuar.' });
}));
router.post('/email-password-reset/request', recoveryRequestRateLimit, asyncHandler(async (req, res) => {
  ensureEmailAvailable();
  const data = z.object({ email: z.string().email() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(data.email) } });
  if (user?.active && !user.isBlocked && user.emailVerifiedAt) {
    try {
      await issueEmailCode(user.id, user.email!, EmailTokenPurpose.RESET_PASSWORD);
    } catch (error) {
      console.error('[auth] no se pudo enviar el código de recuperación', { userId: user.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  res.status(202).json({ message: 'Si el email corresponde a una cuenta, recibirás un código para cambiar la contraseña.' });
}));
router.post('/email-password-reset/confirm', recoveryAttemptRateLimit, asyncHandler(async (req, res) => {
  const data = z.object({ token: z.string().optional(), email: z.string().email().optional(), code: z.string().regex(/^\d{6}$/).optional(), password: z.string().min(8).max(72) })
    .refine(value => Boolean(value.token || (value.email && value.code)), 'Ingresá el email y el código.').parse(req.body);
  const row = data.token
    ? await consumeEmailToken(data.token, EmailTokenPurpose.RESET_PASSWORD)
    : await findEmailCode(data.email!, EmailTokenPurpose.RESET_PASSWORD, data.code!);
  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.$transaction(async tx => {
    const consumed = await tx.emailToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() }, ...(data.token ? {} : { attempts: { lt: 5 } }) }, data: { usedAt: new Date() } });
    if (!consumed.count) throw new HttpError(400, 'El enlace es inválido o venció.');
    const owner = await tx.user.findUnique({ where: { id: row.userId } });
    if (!owner || owner.email !== row.email || !owner.emailVerifiedAt || !owner.active || owner.isBlocked) throw new HttpError(400, 'El enlace ya no es válido.');
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, securityVersion: { increment: 1 } } });
  });
  res.clearCookie(config.authCookieName, clearCookieOptions).clearCookie(config.csrfCookieName, clearCsrfCookieOptions).json({ message: 'Contraseña actualizada. Ingresá con tu email y la nueva contraseña.' });
}));
router.post('/password-reset-requests', recoveryRequestRateLimit, asyncHandler(async (req, res) => {
  const data = z.object({ phone: phoneSchema }).parse(req.body);
  res.status(202).json(await passwordReset.requestPasswordReset(data.phone));
}));
router.post('/password-reset', recoveryAttemptRateLimit, asyncHandler(async (req, res) => {
  const data = z.object({
    token: z.string().min(1),
    password: z.string(required('una contraseña')).min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'La contraseña es demasiado larga')
  }).parse(req.body);
  const result = await passwordReset.resetPassword(data.token, data.password);
  res.clearCookie(config.authCookieName, clearCookieOptions)
    .clearCookie(config.csrfCookieName, clearCsrfCookieOptions)
    .json(result);
}));
router.post('/logout', (_req, res) => res
  .clearCookie(config.authCookieName, clearCookieOptions)
  .clearCookie(config.csrfCookieName, clearCsrfCookieOptions)
  .status(204).end());
router.get('/me', authenticate, asyncHandler(async (req, res) => res.json(await auth.me(req.auth!.userId))));
router.patch('/phone', authenticate, asyncHandler(async (req, res) => {
  const data = z.object({ phone: phoneSchema, password: z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || !user.active || user.isBlocked || !user.emailVerifiedAt) throw new HttpError(403, 'La cuenta no está habilitada.');
  if (!await bcrypt.compare(data.password, user.passwordHash)) throw new HttpError(401, 'La contraseña actual es incorrecta.');
  const candidates = storedPhoneCandidates(data.phone);
  const phone = localArgentinaPhone(data.phone);
  const owner = await prisma.user.findFirst({ where: { phone: { in: candidates } } });
  if (owner && owner.id !== user.id) throw new HttpError(409, 'Ese teléfono ya está registrado.');
  if (user.phone === phone) throw new HttpError(409, 'Ese ya es el teléfono de tu cuenta.');
  await prisma.$transaction(async tx => {
    await tx.bookingRequest.updateMany({ where: { userId: user.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    await tx.user.update({ where: { id: user.id }, data: {
      phone, phoneVerified: false, phoneVerifiedAt: null, phoneVerifiedById: null,
      phoneVerificationMethod: null, bookingApprovedAt: null, bookingApprovalMethod: null,
      status: 'PENDING_VERIFICATION', verificationCode: null
    } });
  });
  await publishUserChange('USER_UPDATED', user.id);
  res.json({ message: 'Teléfono actualizado. La cancha comprobará este número en tu próxima solicitud.' });
}));

export default router;
