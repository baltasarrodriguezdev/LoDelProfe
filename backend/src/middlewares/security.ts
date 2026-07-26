import type { RequestHandler } from 'express';
import { randomBytes } from 'crypto';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const csrfExemptPaths = new Set([
  '/auth/login', '/api/auth/login', '/auth/register', '/api/auth/register',
  '/auth/password-reset-requests', '/api/auth/password-reset-requests',
  '/auth/password-reset', '/api/auth/password-reset'
]);

export function cookieValue(header: string | undefined, name: string) {
  return header?.split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(name + '='))
    ?.slice(name.length + 1);
}

export function createCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
  );
  if (config.production) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
};

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (!unsafeMethods.has(req.method)) return next();
  if (csrfExemptPaths.has(req.path)) return next();

  const authCookie = cookieValue(req.headers.cookie, config.authCookieName);
  if (!authCookie) return next();

  const csrfCookie = cookieValue(req.headers.cookie, config.csrfCookieName);
  const csrfHeader = req.get('x-csrf-token');
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return next(new HttpError(403, 'Token CSRF inválido'));
  }

  next();
};

export function rateLimit(options: { windowMs: number; max: number; key?: (req: Parameters<RequestHandler>[0]) => string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, _res, next) => {
    const now = Date.now();
    const key = options.key?.(req) ?? req.ip ?? 'unknown';
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count++;
    if (current.count > options.max) {
      return next(new HttpError(429, 'Demasiados intentos. Probá nuevamente en unos minutos.'));
    }

    next();
  };
}
