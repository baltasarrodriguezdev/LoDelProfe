import { Router, Response } from 'express';
import { z } from 'zod';
import * as auth from '../services/auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { authenticate } from '../middlewares/auth.js';
import { config } from '../config.js';
import { ARGENTINA_PHONE_ERROR, normalizeArgentinaPhone } from '../utils/argentina-phone.js';

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
  phone: phoneSchema,
  password: z.string(required('una contraseña')).min(8, 'La contraseña debe tener al menos 8 caracteres')
});

const router = Router();
const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'lax' as const, path: '/', maxAge: config.authCookieMaxAgeMs };
const establish = (res: Response, result: { token: string; user: unknown }, status = 200) =>
  res.status(status).cookie(config.authCookieName, result.token, cookieOptions).json({ user: result.user });

router.post('/register', asyncHandler(async (req, res) => {
  const data = registrationSchema.parse(req.body);
  establish(res, await auth.register(data), 201);
}));
router.post('/login', asyncHandler(async (req, res) => {
  const data = z.object({ phone: phoneSchema, password: z.string(required('tu contraseña')).min(1, 'Ingresá tu contraseña') }).parse(req.body);
  establish(res, await auth.login(data.phone, data.password));
}));
router.post('/logout', (_req, res) => res.clearCookie(config.authCookieName, { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' }).status(204).end());
router.get('/me', authenticate, asyncHandler(async (req, res) => res.json(await auth.me(req.auth!.userId))));

export default router;
