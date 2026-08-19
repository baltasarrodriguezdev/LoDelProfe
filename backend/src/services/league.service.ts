import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prisma/client.js';
import { HttpError } from '../utils/http-error.js';
import {
  calculateStandings,
  generateSevenMatchdays,
  pointsForResult,
  SUMA_12_KNOCKOUT,
  validateLeagueResult,
  type LeagueScoringRules,
  type LeagueSetInput
} from '../domain/league-rules.js';
import { writeAudit } from './audit.service.js';

const leagueInclude = {
  court: { select: { id: true, name: true } },
  rules: true,
  zones: {
    orderBy: { displayOrder: 'asc' as const },
    include: {
      pairs: {
        where: { active: true },
        orderBy: { seedNumber: 'asc' as const },
        include: { firstPlayer: true, secondPlayer: true }
      }
    }
  },
  matches: {
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }, { code: 'asc' }],
    include: {
      zone: { select: { id: true, code: true, name: true } },
      homePair: { select: { id: true, displayName: true, seedNumber: true } },
      awayPair: { select: { id: true, displayName: true, seedNumber: true } },
      sets: { orderBy: { setNumber: 'asc' as const } }
    }
  }
} satisfies Prisma.LeagueSeasonInclude;

function dateString(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function rulesFrom(league: any): LeagueScoringRules {
  return {
    straightSetsWinPoints: Number(league.rules?.straightSetsWinPoints ?? 3),
    threeSetsWinPoints: Number(league.rules?.threeSetsWinPoints ?? 2),
    threeSetsLossPoints: Number(league.rules?.threeSetsLossPoints ?? 1),
    straightSetsLossPoints: Number(league.rules?.straightSetsLossPoints ?? 0)
  };
}

function serializedMatch(match: any, scoring: LeagueScoringRules) {
  let result = null;
  let scoringPending = false;
  if (match.sets?.length) {
    try {
      const summary = validateLeagueResult(match.sets);
      const points = pointsForResult(summary, scoring);
      result = { ...summary, ...points };
    } catch {
      // Los borradores incompletos no se exponen como resultados válidos.
    }
  }
  return {
    id: match.id,
    code: match.code,
    stage: match.stage,
    matchday: match.matchday,
    zone: match.zone,
    scheduledDate: dateString(match.scheduledDate),
    scheduledTime: match.scheduledTime,
    status: match.status,
    official: match.official,
    officialAt: match.officialAt,
    homePair: match.homePair,
    awayPair: match.awayPair,
    homePlaceholder: match.homePlaceholder,
    awayPlaceholder: match.awayPlaceholder,
    sets: match.sets?.map((set: any) => ({ setNumber: set.setNumber, homeGames: set.homeGames, awayGames: set.awayGames })) ?? [],
    result,
    scoringPending,
    rescheduleNote: match.rescheduleNote,
    updatedAt: match.updatedAt
  };
}

export function standingsForLeague(league: any) {
  const scoring = rulesFrom(league);
  return league.zones.map((zone: any) => ({
    zone: { id: zone.id, code: zone.code, name: zone.name },
    ...calculateStandings(
      zone.pairs.map((pair: any) => ({ id: pair.id, displayName: pair.displayName, seedNumber: pair.seedNumber })),
      league.matches
        .filter((match: any) => match.zoneId === zone.id && match.stage === 'GROUP_STAGE')
        .map((match: any) => ({
          homePairId: match.homePairId,
          awayPairId: match.awayPairId,
          official: match.official,
          status: match.status,
          sets: match.sets
        })),
      scoring
    )
  }));
}

function pendingRules(league: any) {
  const rules = league.rules ?? {};
  const pending = [
    [!rules.gamesPositiveDefinition, 'Definición de “games positivos”.'],
    [!rules.multiPairTieRule, 'Desempate entre tres o más parejas.'],
    [!rules.walkoverRule, 'Walkover o ausencia.'],
    [!rules.retirementRule, 'Abandono por lesión.'],
    [!rules.incompleteMatchRule, 'Partido inconcluso.'],
    [!rules.reschedulingRule, 'Criterio formal para reprogramaciones.'],
    [!rules.sixAllTiebreakRule, 'Regla de tie-break en 6–6.']
  ] as const;
  return pending.filter(([isPending]) => isPending).map(([, label]) => label);
}

export async function getLeaguePayload(leagueId?: number) {
  const league = leagueId
    ? await prisma.leagueSeason.findUnique({ where: { id: leagueId }, include: leagueInclude })
    : await prisma.leagueSeason.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: [{ seasonYear: 'desc' }, { id: 'desc' }],
        include: leagueInclude
      });
  if (!league) throw new HttpError(404, 'No hay una liga activa publicada.');
  const scoring = rulesFrom(league);
  const matches = league.matches.map(match => serializedMatch(match, scoring));
  const standings = standingsForLeague(league);
  const datedUpcoming = matches
    .filter(match => !match.official && ['SCHEDULED', 'LIVE', 'RESCHEDULED', 'PENDING'].includes(match.status))
    .filter(match => match.scheduledDate)
    .sort((a, b) => `${a.scheduledDate}T${a.scheduledTime ?? '99:99'}`.localeCompare(`${b.scheduledDate}T${b.scheduledTime ?? '99:99'}`));
  const latestResults = matches
    .filter(match => match.official && match.status === 'FINISHED')
    .sort((a, b) => `${b.scheduledDate ?? ''}T${b.scheduledTime ?? ''}`.localeCompare(`${a.scheduledDate ?? ''}T${a.scheduledTime ?? ''}`))
    .slice(0, 4);
  const nextGroupMatch = datedUpcoming.find(match => match.stage === 'GROUP_STAGE');
  return {
    league: {
      id: league.id,
      slug: league.slug,
      name: league.name,
      seasonYear: league.seasonYear,
      status: league.status,
      currentStage: league.currentStage,
      court: league.court,
      timezone: league.timezone,
      bestOfSets: league.bestOfSets,
      fullThirdSet: league.fullThirdSet,
      allPairsAdvance: league.allPairsAdvance,
      registrationFee: league.registrationFee == null ? null : Number(league.registrationFee),
      firstPrize: league.firstPrize,
      secondPrize: league.secondPrize,
      ballAvailabilityNote: league.ballAvailabilityNote,
      scheduleNote: league.scheduleNote,
      activeFrom: dateString(league.activeFrom),
      activeUntil: dateString(league.activeUntil),
      createdAt: league.createdAt,
      updatedAt: league.updatedAt
    },
    zones: league.zones.map(zone => ({
      id: zone.id,
      code: zone.code,
      name: zone.name,
      regularDay: zone.regularDay,
      pairs: zone.pairs.map(pair => ({
        id: pair.id,
        seedNumber: pair.seedNumber,
        displayName: pair.displayName,
        firstPlayer: { id: pair.firstPlayer.id, displayName: pair.firstPlayer.displayName },
        secondPlayer: { id: pair.secondPlayer.id, displayName: pair.secondPlayer.displayName }
      }))
    })),
    matches,
    standings,
    bracket: ['ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'].map(stage => ({
      stage,
      matches: matches.filter(match => match.stage === stage)
    })),
    summary: {
      nextMatchday: nextGroupMatch ? { number: nextGroupMatch.matchday, zone: nextGroupMatch.zone, date: nextGroupMatch.scheduledDate } : null,
      upcomingMatches: datedUpcoming.slice(0, 6),
      latestResults
    },
    rules: {
      scoring: { ...league.rules, ...scoring },
      tieBreakCriteria: ['Puntos', 'Partido entre sí', 'Sets a favor', 'Games a favor', 'Games positivos', 'Sorteo'],
      pending: pendingRules(league)
    }
  };
}

export async function listLeagues() {
  return prisma.leagueSeason.findMany({
    orderBy: [{ seasonYear: 'desc' }, { id: 'desc' }],
    include: { _count: { select: { pairs: true, matches: true } } }
  });
}

export type LeaguePairInput = { zoneId: number; seedNumber: number; firstPlayer: string; secondPlayer: string; active?: boolean };

function pairDisplayName(input: Pick<LeaguePairInput, 'firstPlayer' | 'secondPlayer'>) {
  return `${input.firstPlayer.trim()} - ${input.secondPlayer.trim()}`;
}

async function assertZone(client: any, leagueId: number, zoneId: number) {
  const zone = await client.leagueZone.findFirst({ where: { id: zoneId, leagueId } });
  if (!zone) throw new HttpError(400, 'La zona no pertenece a esta temporada.');
  return zone;
}

export async function createLeaguePair(leagueId: number, input: LeaguePairInput, actorId: number) {
  return prisma.$transaction(async tx => {
    await assertZone(tx, leagueId, input.zoneId);
    const displayName = pairDisplayName(input);
    const duplicate = await tx.leaguePair.findFirst({ where: { leagueId, displayName } });
    if (duplicate) throw new HttpError(409, 'La pareja ya está registrada en esta temporada.');
    const occupied = await tx.leaguePair.findFirst({ where: { zoneId: input.zoneId, seedNumber: input.seedNumber } });
    if (occupied) throw new HttpError(409, 'Ese número ya está asignado en la zona.');
    const firstPlayer = await tx.leaguePlayer.create({ data: { leagueId, displayName: input.firstPlayer.trim() } });
    const secondPlayer = await tx.leaguePlayer.create({ data: { leagueId, displayName: input.secondPlayer.trim() } });
    const pair = await tx.leaguePair.create({
      data: { leagueId, zoneId: input.zoneId, seedNumber: input.seedNumber, displayName, firstPlayerId: firstPlayer.id, secondPlayerId: secondPlayer.id, active: input.active ?? true }
    });
    await writeAudit({ actorId, action: 'LEAGUE_PAIR_CREATED', entityType: 'LEAGUE_PAIR', entityId: pair.id }, tx);
    return pair;
  });
}

export async function updateLeaguePair(leagueId: number, pairId: number, input: LeaguePairInput, actorId: number) {
  return prisma.$transaction(async tx => {
    const pair = await tx.leaguePair.findFirst({ where: { id: pairId, leagueId } });
    if (!pair) throw new HttpError(404, 'Pareja no encontrada.');
    await assertZone(tx, leagueId, input.zoneId);
    const displayName = pairDisplayName(input);
    const duplicate = await tx.leaguePair.findFirst({ where: { leagueId, displayName, NOT: { id: pairId } } });
    if (duplicate) throw new HttpError(409, 'La pareja ya está registrada en esta temporada.');
    const occupied = await tx.leaguePair.findFirst({ where: { zoneId: input.zoneId, seedNumber: input.seedNumber, NOT: { id: pairId } } });
    if (occupied) {
      await tx.leaguePair.update({ where: { id: pair.id }, data: { seedNumber: 1000 + pair.id } });
      await tx.leaguePair.update({ where: { id: occupied.id }, data: { zoneId: pair.zoneId, seedNumber: pair.seedNumber } });
    }
    await Promise.all([
      tx.leaguePlayer.update({ where: { id: pair.firstPlayerId }, data: { displayName: input.firstPlayer.trim() } }),
      tx.leaguePlayer.update({ where: { id: pair.secondPlayerId }, data: { displayName: input.secondPlayer.trim() } })
    ]);
    const updated = await tx.leaguePair.update({
      where: { id: pair.id },
      data: { zoneId: input.zoneId, seedNumber: input.seedNumber, displayName, active: input.active ?? true }
    });
    await writeAudit({ actorId, action: 'LEAGUE_PAIR_UPDATED', entityType: 'LEAGUE_PAIR', entityId: pair.id, details: { zoneId: input.zoneId, seedNumber: input.seedNumber } }, tx);
    return updated;
  });
}

export async function generateLeagueFixture(leagueId: number, actorId: number, dates?: Record<string, string[]>) {
  const league = await prisma.leagueSeason.findUnique({
    where: { id: leagueId },
    include: { zones: { include: { pairs: { where: { active: true }, orderBy: { seedNumber: 'asc' } } } } }
  });
  if (!league) throw new HttpError(404, 'Liga no encontrada.');
  for (const zone of league.zones) {
    const rounds = generateSevenMatchdays(zone.pairs.map(pair => pair.seedNumber));
    const pairs = new Map(zone.pairs.map(pair => [pair.seedNumber, pair]));
    for (const round of rounds) {
      for (const [slot, match] of round.matches.entries()) {
        const code = `${zone.code}-F${round.matchday}-M${slot + 1}`;
        const scheduledDate = dates?.[zone.code]?.[round.matchday - 1]
          ? new Date(`${dates[zone.code][round.matchday - 1]}T00:00:00.000Z`)
          : null;
        await prisma.leagueMatch.upsert({
          where: { leagueId_code: { leagueId, code } },
          update: { zoneId: zone.id, matchday: round.matchday, ...(scheduledDate ? { scheduledDate } : {}), scheduledTime: match.time, homePairId: pairs.get(match.homeSeed)!.id, awayPairId: pairs.get(match.awaySeed)!.id },
          create: { leagueId, zoneId: zone.id, stage: 'GROUP_STAGE', matchday: round.matchday, code, scheduledDate, scheduledTime: match.time, homePairId: pairs.get(match.homeSeed)!.id, awayPairId: pairs.get(match.awaySeed)!.id }
        });
      }
    }
  }
  const knockoutIds = new Map<string, number>();
  for (const match of SUMA_12_KNOCKOUT) {
    const scheduledDate = league.seasonYear === 2026 && match.date ? new Date(`${match.date}T00:00:00.000Z`) : null;
    const saved = await prisma.leagueMatch.upsert({
      where: { leagueId_code: { leagueId, code: match.code } },
      update: { stage: match.stage, scheduledTime: match.time, homePlaceholder: match.home, awayPlaceholder: match.away },
      create: { leagueId, stage: match.stage, code: match.code, scheduledDate, scheduledTime: match.time, status: 'PENDING', homePlaceholder: match.home, awayPlaceholder: match.away }
    });
    knockoutIds.set(match.code, saved.id);
  }
  for (const match of SUMA_12_KNOCKOUT) {
    await prisma.leagueMatch.update({
      where: { id: knockoutIds.get(match.code)! },
      data: { nextMatchId: match.nextCode ? knockoutIds.get(match.nextCode)! : null, nextSlot: match.nextSlot }
    });
  }
  await writeAudit({ actorId, action: 'LEAGUE_FIXTURE_GENERATED', entityType: 'LEAGUE', entityId: leagueId });
}

function winnerPairId(match: any) {
  const summary = validateLeagueResult(match.sets);
  return summary.winnerSide === 'HOME' ? match.homePairId : match.awayPairId;
}

const r16Seeds: Record<string, { home: [string, number]; away: [string, number] }> = {
  P1: { home: ['A', 1], away: ['B', 8] }, P2: { home: ['B', 4], away: ['A', 5] },
  P3: { home: ['A', 3], away: ['B', 6] }, P4: { home: ['B', 2], away: ['A', 7] },
  P5: { home: ['B', 1], away: ['A', 8] }, P6: { home: ['A', 4], away: ['B', 5] },
  P7: { home: ['B', 3], away: ['A', 6] }, P8: { home: ['A', 2], away: ['B', 7] }
};

export async function reconcileLeagueBracket(leagueId: number, client: PrismaClient = prisma) {
  const league = await client.leagueSeason.findUnique({ where: { id: leagueId }, include: leagueInclude });
  if (!league) throw new HttpError(404, 'Liga no encontrada.');
  const groupMatches = league.matches.filter(match => match.stage === 'GROUP_STAGE');
  const groupsComplete = groupMatches.length === 56 && groupMatches.every(match => match.official && match.status === 'FINISHED');
  const standings = standingsForLeague(league);
  const canRank = groupsComplete && standings.every((zone: any) => zone.rankingComplete && zone.rows.every((row: any) => row.position));
  if (canRank) {
    const byZonePosition = new Map<string, number>();
    for (const zone of standings) for (const row of zone.rows) byZonePosition.set(`${zone.zone.code}-${row.position}`, row.pairId);
    for (const [code, seeds] of Object.entries(r16Seeds)) {
      const match = league.matches.find(item => item.code === code)!;
      await client.leagueMatch.update({
        where: { id: match.id },
        data: {
          homePairId: byZonePosition.get(`${seeds.home[0]}-${seeds.home[1]}`),
          awayPairId: byZonePosition.get(`${seeds.away[0]}-${seeds.away[1]}`),
          status: match.status === 'PENDING' ? 'SCHEDULED' : match.status
        }
      });
    }
  } else {
    for (const match of league.matches.filter(item => item.stage === 'ROUND_OF_16' && !item.official && !item.sets.length)) {
      await client.leagueMatch.update({ where: { id: match.id }, data: { homePairId: null, awayPairId: null, status: 'PENDING' } });
    }
  }

  const knockout = league.matches.filter(match => match.stage !== 'GROUP_STAGE');
  for (const source of knockout.filter(match => match.official && match.status === 'FINISHED')) {
    if (!source.nextMatchId || !source.nextSlot) continue;
    const winnerId = winnerPairId(source);
    const target = knockout.find(match => match.id === source.nextMatchId);
    if (!target) continue;
    const existingId = source.nextSlot === 'HOME' ? target.homePairId : target.awayPairId;
    if (existingId && existingId !== winnerId && (target.official || target.sets.length)) {
      throw new HttpError(409, `No se puede cambiar ${source.code}: ${target.code} ya tiene un resultado cargado.`);
    }
    await client.leagueMatch.update({
      where: { id: target.id },
      data: {
        ...(source.nextSlot === 'HOME' ? { homePairId: winnerId } : { awayPairId: winnerId }),
        status: (source.nextSlot === 'HOME' ? Boolean(target.awayPairId) : Boolean(target.homePairId)) && target.status === 'PENDING' ? 'SCHEDULED' : target.status
      }
    });
  }

  const completeStage = (stage: string) => {
    const matches = league.matches.filter(match => match.stage === stage);
    return matches.length > 0 && matches.every(match => match.official && match.status === 'FINISHED');
  };
  const currentStage = !groupsComplete ? 'GROUP_STAGE'
    : !completeStage('ROUND_OF_16') ? 'ROUND_OF_16'
      : !completeStage('QUARTERFINAL') ? 'QUARTERFINAL'
        : !completeStage('SEMIFINAL') ? 'SEMIFINAL' : 'FINAL';
  if (league.status !== 'CLOSED') await client.leagueSeason.update({ where: { id: leagueId }, data: { currentStage } });
}

export async function saveLeagueMatchResult(matchId: number, sets: LeagueSetInput[], actorId: number, correctionConfirmed = false) {
  validateLeagueResult(sets);
  const existing = await prisma.leagueMatch.findUnique({
    where: { id: matchId },
    include: { sets: true, nextMatch: { include: { sets: true } } }
  });
  if (!existing) throw new HttpError(404, 'Partido no encontrado.');
  if (!existing.homePairId || !existing.awayPairId || existing.homePairId === existing.awayPairId) {
    throw new HttpError(409, 'El partido debe tener dos parejas distintas antes de cargar el resultado.');
  }
  if (existing.official && !correctionConfirmed) {
    throw new HttpError(409, 'Este resultado ya es oficial. Confirmá expresamente la corrección.', 'RESULT_CORRECTION_CONFIRMATION_REQUIRED');
  }
  if (existing.official && existing.nextMatch && (existing.nextMatch.official || existing.nextMatch.sets.length)) {
    throw new HttpError(409, `No se puede corregir porque ${existing.nextMatch.code} ya tiene un resultado cargado.`);
  }
  if (existing.official && existing.stage === 'GROUP_STAGE') {
    const startedKnockout = await prisma.leagueMatch.count({
      where: { leagueId: existing.leagueId, stage: { not: 'GROUP_STAGE' }, OR: [{ official: true }, { sets: { some: {} } }] }
    });
    if (startedKnockout) throw new HttpError(409, 'No se puede corregir la fase de zonas porque las eliminatorias ya tienen resultados cargados.');
  }
  await prisma.$transaction(async tx => {
    await tx.leagueMatchSet.deleteMany({ where: { matchId } });
    await tx.leagueMatch.update({
      where: { id: matchId },
      data: {
        status: 'FINISHED',
        official: false,
        officialAt: null,
        updatedById: actorId,
        sets: { create: sets.map((set, index) => ({ setNumber: index + 1, homeGames: set.homeGames, awayGames: set.awayGames })) }
      }
    });
    await writeAudit({ actorId, action: existing.official ? 'LEAGUE_RESULT_CORRECTED' : 'LEAGUE_RESULT_SAVED', entityType: 'LEAGUE_MATCH', entityId: matchId, details: { sets } }, tx);
    if (existing.official && existing.nextMatchId && existing.nextSlot) {
      await tx.leagueMatch.update({
        where: { id: existing.nextMatchId },
        data: { ...(existing.nextSlot === 'HOME' ? { homePairId: null } : { awayPairId: null }), status: 'PENDING' }
      });
    }
  });
  await reconcileLeagueBracket(existing.leagueId);
  return getLeaguePayload(existing.leagueId);
}

export async function resetLeagueMatchResult(matchId: number, actorId: number, correctionConfirmed = false) {
  const existing = await prisma.leagueMatch.findUnique({
    where: { id: matchId },
    include: { sets: true, nextMatch: { include: { sets: true } } }
  });
  if (!existing) throw new HttpError(404, 'Partido no encontrado.');
  if (!existing.sets.length && !existing.official) return getLeaguePayload(existing.leagueId);
  if (existing.official && !correctionConfirmed) {
    throw new HttpError(409, 'Este resultado ya es oficial. Confirmá expresamente que querés quitarlo.', 'RESULT_CORRECTION_CONFIRMATION_REQUIRED');
  }
  if (existing.official && existing.nextMatch && (existing.nextMatch.official || existing.nextMatch.sets.length)) {
    throw new HttpError(409, `No se puede quitar el resultado porque ${existing.nextMatch.code} ya tiene un resultado cargado.`);
  }
  if (existing.official && existing.stage === 'GROUP_STAGE') {
    const startedKnockout = await prisma.leagueMatch.count({
      where: { leagueId: existing.leagueId, stage: { not: 'GROUP_STAGE' }, OR: [{ official: true }, { sets: { some: {} } }] }
    });
    if (startedKnockout) throw new HttpError(409, 'No se puede quitar el resultado de zonas porque las eliminatorias ya tienen resultados cargados.');
  }
  await prisma.$transaction(async tx => {
    await tx.leagueMatchSet.deleteMany({ where: { matchId } });
    await tx.leagueMatch.update({
      where: { id: matchId },
      data: {
        status: existing.scheduledDate && existing.scheduledTime ? 'SCHEDULED' : 'PENDING',
        official: false,
        officialAt: null,
        updatedById: actorId
      }
    });
    await writeAudit({
      actorId,
      action: 'LEAGUE_RESULT_RESET',
      entityType: 'LEAGUE_MATCH',
      entityId: matchId,
      details: { previousSets: existing.sets, wasOfficial: existing.official }
    }, tx);
    if (existing.official && existing.nextMatchId && existing.nextSlot) {
      await tx.leagueMatch.update({
        where: { id: existing.nextMatchId },
        data: { ...(existing.nextSlot === 'HOME' ? { homePairId: null } : { awayPairId: null }), status: 'PENDING' }
      });
    }
  });
  await reconcileLeagueBracket(existing.leagueId);
  return getLeaguePayload(existing.leagueId);
}

export async function confirmLeagueMatchResult(matchId: number, actorId: number) {
  const match = await prisma.leagueMatch.findUnique({ where: { id: matchId }, include: { sets: { orderBy: { setNumber: 'asc' } } } });
  if (!match) throw new HttpError(404, 'Partido no encontrado.');
  if (!match.homePairId || !match.awayPairId || match.homePairId === match.awayPairId) throw new HttpError(409, 'El partido no tiene dos parejas válidas.');
  validateLeagueResult(match.sets);
  await prisma.$transaction(async tx => {
    await tx.leagueMatch.update({ where: { id: matchId }, data: { status: 'FINISHED', official: true, officialAt: new Date(), updatedById: actorId } });
    await writeAudit({ actorId, action: 'LEAGUE_RESULT_CONFIRMED', entityType: 'LEAGUE_MATCH', entityId: matchId }, tx);
  });
  await reconcileLeagueBracket(match.leagueId);
  return getLeaguePayload(match.leagueId);
}

export function knockoutTemplateData() {
  return SUMA_12_KNOCKOUT;
}
