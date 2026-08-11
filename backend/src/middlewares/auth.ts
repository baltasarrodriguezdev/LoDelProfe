import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { prisma } from '../prisma/client.js';
import { cookieValue } from './security.js';

export type AuthenticatedSession = { userId: number; role: Role; sessionVersion?: number };

export async function resolveAuthenticatedSession(cookieHeader?: string, authorizationHeader?: string) {
  const token = cookieValue(cookieHeader, config.authCookieName)
    ?? authorizationHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  let payload: AuthenticatedSession;
  try {
    payload = jwt.verify(token, config.jwtSecret) as AuthenticatedSession;
  } catch {
    throw new HttpError(401, 'Token inválido o vencido');
  }

  if (payload.sessionVersion !== undefined) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { active: true, isBlocked: true, securityVersion: true, role: true }
    });
    if (!user || !user.active || user.isBlocked || Number(user.securityVersion ?? 0) !== payload.sessionVersion) {
      throw new HttpError(401, 'La sesión ya no es válida');
    }
    payload.role = user.role;
  }
  return payload;
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const payload = await resolveAuthenticatedSession(req.headers.cookie, req.headers.authorization);
    if (!payload) return next(new HttpError(401, 'Se requiere autenticación'));
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
