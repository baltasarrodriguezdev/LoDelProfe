import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

export const authenticateBot: RequestHandler = (req, _res, next) => {
  const supplied = req.get('x-api-key') ?? '';
  if (!config.botApiKey || !supplied || !timingSafeEqual(digest(supplied), digest(config.botApiKey))) {
    return next(new HttpError(401, 'No autorizado.', 'BOT_UNAUTHORIZED'));
  }
  next();
};
