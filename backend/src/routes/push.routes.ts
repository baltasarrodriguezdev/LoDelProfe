import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import {
  pushPublicKey,
  removePushSubscription,
  savePushSubscription
} from '../services/push-notification.service.js';

const router = Router();
router.use(authenticate, authorize(Role.ADMIN, Role.SUPERADMIN));

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255)
  })
});

function requirePushConfiguration() {
  const publicKey = pushPublicKey();
  if (!publicKey) throw new HttpError(503, 'Las notificaciones todavía no están configuradas en el servidor.');
  return publicKey;
}

router.get('/public-key', (req, res, next) => {
  try {
    res.json({ publicKey: requirePushConfiguration() });
  } catch (error) {
    next(error);
  }
});

router.post('/subscriptions', asyncHandler(async (req, res) => {
  requirePushConfiguration();
  const subscription = subscriptionSchema.parse(req.body);
  const saved = await savePushSubscription(req.auth!.userId, subscription, req.headers['user-agent']);
  res.status(201).json(saved);
}));

router.delete('/subscriptions', asyncHandler(async (req, res) => {
  requirePushConfiguration();
  const { endpoint } = z.object({ endpoint: z.string().url().max(2048) }).parse(req.body);
  await removePushSubscription(req.auth!.userId, endpoint);
  res.status(204).end();
}));

export default router;
