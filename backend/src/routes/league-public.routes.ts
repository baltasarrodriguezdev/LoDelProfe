import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { getLeaguePayload } from '../services/league.service.js';

const router = Router();

router.get('/active', asyncHandler(async (_req, res) => res.json(await getLeaguePayload())));
router.get('/active/standings', asyncHandler(async (_req, res) => res.json((await getLeaguePayload()).standings)));
router.get('/active/matches', asyncHandler(async (_req, res) => res.json((await getLeaguePayload()).matches)));
router.get('/active/bracket', asyncHandler(async (_req, res) => res.json((await getLeaguePayload()).bracket)));
router.get('/active/rules', asyncHandler(async (_req, res) => {
  const payload = await getLeaguePayload();
  res.json({ league: payload.league, rules: payload.rules });
}));

export default router;
