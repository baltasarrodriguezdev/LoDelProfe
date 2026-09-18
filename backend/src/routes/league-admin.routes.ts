import { Router } from 'express';
import { LeagueMatchStatus, LeagueSeasonStatus, LeagueStage, Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { prisma } from '../prisma/client.js';
import { HttpError } from '../utils/http-error.js';
import { writeAudit } from '../services/audit.service.js';
import {
  confirmLeagueMatchResult,
  createLeaguePair,
  generateLeagueFixture,
  getLeaguePayload,
  listLeagues,
  resetLeagueMatchResult,
  saveLeagueMatchResult,
  updateLeaguePair
} from '../services/league.service.js';
import { publishLeagueChange } from '../realtime/events.js';
import { validateLeagueResult } from '../domain/league-rules.js';
import {
  getInstagramManifest,
  INSTAGRAM_FORMATS,
  INSTAGRAM_TEMPLATES,
  renderInstagramPng,
  renderInstagramZip,
  type InstagramSelection
} from '../services/instagram-content.service.js';

const router = Router();
router.use(authenticate, authorize(Role.ADMIN, Role.SUPERADMIN));

const id = (value: unknown) => z.coerce.number().int().positive().parse(value);
const nullableText = (max = 2000) => z.string().trim().max(max).nullable().optional();
const leagueFields = {
  name: z.string().trim().min(3).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  seasonYear: z.number().int().min(2020).max(2100),
  status: z.nativeEnum(LeagueSeasonStatus),
  currentStage: z.nativeEnum(LeagueStage),
  courtId: z.number().int().positive().nullable().optional(),
  timezone: z.string().trim().min(3).max(80).default('America/Argentina/Cordoba'),
  registrationFee: z.number().nonnegative().nullable().optional(),
  firstPrize: nullableText(255),
  secondPrize: nullableText(255),
  ballAvailabilityNote: nullableText(255),
  scheduleNote: nullableText(),
  activeFrom: z.string().date().nullable().optional(),
  activeUntil: z.string().date().nullable().optional()
};
const createLeagueSchema = z.object(leagueFields).strict();
const updateLeagueSchema = createLeagueSchema.partial();
const pairSchema = z.object({
  zoneId: z.number().int().positive(),
  seedNumber: z.number().int().min(1).max(8),
  firstPlayer: z.string().trim().min(1).max(120),
  secondPlayer: z.string().trim().min(1).max(120),
  active: z.boolean().optional()
}).strict();
const rulesSchema = z.object({
  straightSetsWinPoints: z.number().int().min(0).max(20),
  threeSetsWinPoints: z.number().int().min(0).max(20),
  threeSetsLossPoints: z.number().int().min(0).max(20),
  straightSetsLossPoints: z.number().int().min(0).max(20),
  gamesPositiveDefinition: nullableText(),
  multiPairTieRule: nullableText(),
  walkoverRule: nullableText(),
  retirementRule: nullableText(),
  incompleteMatchRule: nullableText(),
  reschedulingRule: nullableText(),
  sixAllTiebreakRule: nullableText()
}).strict();
const setSchema = z.object({ homeGames: z.number().int().min(0).max(7), awayGames: z.number().int().min(0).max(7) }).strict();
const instagramSelectionSchema = z.object({
  template: z.enum(INSTAGRAM_TEMPLATES),
  format: z.enum(INSTAGRAM_FORMATS),
  zoneId: z.coerce.number().int().positive().optional(),
  matchday: z.coerce.number().int().positive().optional(),
  matchId: z.coerce.number().int().positive().optional(),
  scheduledDate: z.string().date().optional()
}).strict();

function instagramSelection(query: unknown): InstagramSelection {
  const value = query as Record<string, unknown>;
  return instagramSelectionSchema.parse({
    template: value.template,
    format: value.format,
    zoneId: value.zoneId,
    matchday: value.matchday,
    matchId: value.matchId,
    scheduledDate: value.scheduledDate
  });
}

function dateOnly(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : value === null ? null : undefined;
}

async function assertLeague(leagueId: number) {
  const league = await prisma.leagueSeason.findUnique({ where: { id: leagueId } });
  if (!league) throw new HttpError(404, 'Liga no encontrada.');
  return league;
}

async function ensureOnlyActive(leagueId: number, status?: LeagueSeasonStatus) {
  if (status !== LeagueSeasonStatus.ACTIVE) return;
  const active = await prisma.leagueSeason.findFirst({ where: { status: 'ACTIVE', NOT: { id: leagueId } } });
  if (active) throw new HttpError(409, `Cerrá primero la temporada activa “${active.name}”.`);
}

router.get('/', asyncHandler(async (_req, res) => res.json(await listLeagues())));
router.get('/:leagueId', asyncHandler(async (req, res) => res.json(await getLeaguePayload(id(req.params.leagueId)))));

router.get('/:leagueId/instagram/manifest', asyncHandler(async (req, res) => {
  const payload = await getLeaguePayload(id(req.params.leagueId));
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.json(getInstagramManifest(payload, instagramSelection(req.query)));
}));

router.get('/:leagueId/instagram/render', asyncHandler(async (req, res) => {
  const page = z.coerce.number().int().min(0).default(0).parse(req.query.page);
  const download = req.query.download === '1';
  const payload = await getLeaguePayload(id(req.params.leagueId));
  const rendered = await renderInstagramPng(payload, instagramSelection(req.query), page);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${rendered.page.fileName}"`);
  res.setHeader('Content-Length', String(rendered.buffer.length));
  res.send(rendered.buffer);
}));

router.get('/:leagueId/instagram/carousel.zip', asyncHandler(async (req, res) => {
  const payload = await getLeaguePayload(id(req.params.leagueId));
  const rendered = await renderInstagramZip(payload, instagramSelection(req.query));
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${rendered.fileName}"`);
  res.setHeader('Content-Length', String(rendered.buffer.length));
  res.send(rendered.buffer);
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = createLeagueSchema.parse(req.body);
  await ensureOnlyActive(0, data.status);
  const duplicate = await prisma.leagueSeason.findUnique({ where: { slug: data.slug } });
  if (duplicate) throw new HttpError(409, 'Ya existe una liga con ese identificador.');
  const league = await prisma.$transaction(async tx => {
    const created = await tx.leagueSeason.create({
      data: {
        ...data,
        activeFrom: dateOnly(data.activeFrom),
        activeUntil: dateOnly(data.activeUntil),
        bestOfSets: 3,
        fullThirdSet: true,
        allPairsAdvance: true,
        zones: { create: [
          { code: 'A', name: 'Zona A', regularDay: 'LUNES', displayOrder: 0 },
          { code: 'B', name: 'Zona B', regularDay: 'JUEVES', displayOrder: 1 }
        ] },
        rules: { create: { straightSetsWinPoints: 3, threeSetsWinPoints: 2, threeSetsLossPoints: 1, straightSetsLossPoints: 0 } }
      }
    });
    await writeAudit({ actorId: req.auth!.userId, action: 'LEAGUE_CREATED', entityType: 'LEAGUE', entityId: created.id }, tx);
    return created;
  });
  await publishLeagueChange(league.id);
  res.status(201).json(await getLeaguePayload(league.id));
}));

router.patch('/:leagueId', asyncHandler(async (req, res) => {
  const leagueId = id(req.params.leagueId);
  await assertLeague(leagueId);
  const data = updateLeagueSchema.parse(req.body);
  await ensureOnlyActive(leagueId, data.status);
  const updated = await prisma.leagueSeason.update({
    where: { id: leagueId },
    data: { ...data, activeFrom: dateOnly(data.activeFrom), activeUntil: dateOnly(data.activeUntil) }
  });
  await writeAudit({ actorId: req.auth!.userId, action: 'LEAGUE_UPDATED', entityType: 'LEAGUE', entityId: leagueId, details: data });
  await publishLeagueChange(leagueId);
  res.json(updated);
}));

router.post('/:leagueId/pairs', asyncHandler(async (req, res) => {
  const leagueId = id(req.params.leagueId);
  await assertLeague(leagueId);
  const pair = await createLeaguePair(leagueId, pairSchema.parse(req.body), req.auth!.userId);
  await publishLeagueChange(leagueId);
  res.status(201).json(pair);
}));

router.patch('/:leagueId/pairs/:pairId', asyncHandler(async (req, res) => {
  const leagueId = id(req.params.leagueId);
  const pair = await updateLeaguePair(leagueId, id(req.params.pairId), pairSchema.parse(req.body), req.auth!.userId);
  await publishLeagueChange(leagueId);
  res.json(pair);
}));

router.post('/:leagueId/fixture/generate', asyncHandler(async (req, res) => {
  const leagueId = id(req.params.leagueId);
  const data = z.object({
    dates: z.record(z.string(), z.array(z.string().date()).length(7)).optional()
  }).strict().parse(req.body ?? {});
  await generateLeagueFixture(leagueId, req.auth!.userId, data.dates);
  await publishLeagueChange(leagueId);
  res.json(await getLeaguePayload(leagueId));
}));

router.patch('/:leagueId/matches/:matchId', asyncHandler(async (req, res) => {
  const leagueId = id(req.params.leagueId);
  const matchId = id(req.params.matchId);
  const data = z.object({
    scheduledDate: z.string().date().nullable().optional(),
    scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    status: z.nativeEnum(LeagueMatchStatus).optional(),
    rescheduleNote: nullableText(),
    homePairId: z.number().int().positive().nullable().optional(),
    awayPairId: z.number().int().positive().nullable().optional()
  }).strict().parse(req.body);
  const match = await prisma.leagueMatch.findFirst({ where: { id: matchId, leagueId }, include: { sets: true } });
  if (!match) throw new HttpError(404, 'Partido no encontrado.');
  const homePairId = data.homePairId === undefined ? match.homePairId : data.homePairId;
  const awayPairId = data.awayPairId === undefined ? match.awayPairId : data.awayPairId;
  if (homePairId && awayPairId && homePairId === awayPairId) throw new HttpError(400, 'Una pareja no puede enfrentarse a sí misma.');
  const assignedIds = [homePairId, awayPairId].filter((value): value is number => Boolean(value));
  if (assignedIds.length) {
    const count = await prisma.leaguePair.count({ where: { leagueId, id: { in: assignedIds } } });
    if (count !== new Set(assignedIds).size) throw new HttpError(400, 'Una pareja asignada no pertenece a esta temporada.');
  }
  if (data.status === 'FINISHED') validateLeagueResult(match.sets);
  const updated = await prisma.leagueMatch.update({
    where: { id: matchId },
    data: { ...data, scheduledDate: dateOnly(data.scheduledDate), updatedById: req.auth!.userId }
  });
  await writeAudit({ actorId: req.auth!.userId, action: 'LEAGUE_MATCH_UPDATED', entityType: 'LEAGUE_MATCH', entityId: matchId, details: data });
  await publishLeagueChange(leagueId, matchId);
  res.json(updated);
}));

router.put('/:leagueId/matches/:matchId/result', asyncHandler(async (req, res) => {
  const leagueId = id(req.params.leagueId);
  const matchId = id(req.params.matchId);
  const data = z.object({ sets: z.array(setSchema).min(2).max(3), correctionConfirmed: z.boolean().default(false) }).strict().parse(req.body);
  const match = await prisma.leagueMatch.findFirst({ where: { id: matchId, leagueId } });
  if (!match) throw new HttpError(404, 'Partido no encontrado.');
  const payload = await saveLeagueMatchResult(matchId, data.sets, req.auth!.userId, data.correctionConfirmed);
  await publishLeagueChange(leagueId, matchId);
  res.json(payload);
}));

router.post('/:leagueId/matches/:matchId/result/reset', asyncHandler(async (req, res) => {
  const leagueId = id(req.params.leagueId);
  const matchId = id(req.params.matchId);
  const data = z.object({ correctionConfirmed: z.boolean().default(false) }).strict().parse(req.body);
  const match = await prisma.leagueMatch.findFirst({ where: { id: matchId, leagueId } });
  if (!match) throw new HttpError(404, 'Partido no encontrado.');
  const payload = await resetLeagueMatchResult(matchId, req.auth!.userId, data.correctionConfirmed);
  await publishLeagueChange(leagueId, matchId);
  res.json(payload);
}));

router.post('/:leagueId/matches/:matchId/confirm', asyncHandler(async (req, res) => {
  const leagueId = id(req.params.leagueId);
  const matchId = id(req.params.matchId);
  const match = await prisma.leagueMatch.findFirst({ where: { id: matchId, leagueId } });
  if (!match) throw new HttpError(404, 'Partido no encontrado.');
  const payload = await confirmLeagueMatchResult(matchId, req.auth!.userId);
  await publishLeagueChange(leagueId, matchId);
  res.json(payload);
}));

router.put('/:leagueId/rules', asyncHandler(async (req, res) => {
  const leagueId = id(req.params.leagueId);
  await assertLeague(leagueId);
  const data = rulesSchema.parse(req.body);
  const rules = await prisma.leagueRuleSettings.upsert({
    where: { leagueId },
    update: { ...data, updatedById: req.auth!.userId },
    create: { leagueId, ...data, updatedById: req.auth!.userId }
  });
  await writeAudit({ actorId: req.auth!.userId, action: 'LEAGUE_RULES_UPDATED', entityType: 'LEAGUE', entityId: leagueId, details: data });
  await publishLeagueChange(leagueId);
  res.json(rules);
}));

export default router;
