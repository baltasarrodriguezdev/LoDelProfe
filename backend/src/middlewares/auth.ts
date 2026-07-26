import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { prisma } from '../prisma/client.js';

const cookieValue = (header: string | undefined, name: string) => header
  ?.split(';')
  .map(value => value.trim())
  .find(value => value.startsWith(name + '='))
  ?.slice(name.length + 1);

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = cookieValue(req.headers.cookie, config.authCookieName)
    ?? req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return next(new HttpError(401, 'Se requiere autenticación'));
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: number; role: Role; sessionVersion?: number };
    if (payload.sessionVersion !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { active: true, isBlocked: true, securityVersion: true, role: true }
      });
      if (!user || !user.active || user.isBlocked || Number(user.securityVersion ?? 0) !== payload.sessionVersion) {
        return next(new HttpError(401, 'La sesión ya no es válida'));
      }
      payload.role = user.role;
    }
    req.auth = payload;
    next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    next(new HttpError(401, 'Token inválido o vencido'));
  }
};

export const authorize = (...roles: Role[]): RequestHandler => (req, _res, next) => req.auth && roles.includes(req.auth.role)
  ? next()
  : next(new HttpError(403, 'No tenés permisos para esta acción'));
