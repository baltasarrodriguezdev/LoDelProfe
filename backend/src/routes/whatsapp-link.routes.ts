import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { confirmWhatsappLink, createWhatsappLinkChallenge, whatsappLinkStatus } from '../services/whatsapp-link.service.js';

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(async (req, res) => res.json(await whatsappLinkStatus(req.auth!.userId))));
router.post('/challenges', asyncHandler(async (req, res) => res.status(201).json(await createWhatsappLinkChallenge(req.auth!.userId))));
router.post('/confirm', asyncHandler(async (req, res) => res.json(await confirmWhatsappLink(req.auth!.userId))));
export default router;
