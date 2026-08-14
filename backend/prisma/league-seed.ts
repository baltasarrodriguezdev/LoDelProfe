import type { PrismaClient } from '@prisma/client';
import { GAMES_POSITIVE_DEFINITION, SUMA_12_FIXTURE_PATTERN, SUMA_12_KNOCKOUT, SUMA_12_MATCH_TIMES } from '../src/domain/league-rules.js';

const zonePairs = {
  A: [
    ['Gaitan', 'Gonzalez'],
    ['Moriconi', 'Baroni'],
    ['Prunesti', 'Britos'],
    ['Grella', 'Scaglia'],
    ['Vaca', 'Vaca'],
    ['Lencina', 'Giordano'],
    ['Lopez', 'Gariglio'],
    ['Auger', 'Martinez']
  ],
  B: [
    ['Gregorio', 'Colombo'],
    ['Demichelis', 'Demichelis'],
    ['Bustos', 'Pereyra'],
    ['Rodriguez Teruel', 'Ponce'],
    ['Semperez', 'Sanchez'],
    ['Vaca', 'Arrieta'],
    ['Vaca', 'Vega'],
    ['Gonzalez', 'Gonzalez']
  ]
} as const;

const matchdayDates = {
  A: ['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'],
  B: ['2026-08-20', '2026-08-27', '2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24', '2026-10-01']
} as const;

function dateOnly(value: string | null) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function seedSuma12League(prisma: PrismaClient, courtId = 1) {
  const league = await prisma.leagueSeason.upsert({
    where: { slug: 'liga-suma-12-2026' },
    update: {
      name: 'Liga Suma 12',
      seasonYear: 2026,
      status: 'ACTIVE',
      courtId,
      timezone: 'America/Argentina/Cordoba',
      bestOfSets: 3,
      fullThirdSet: true,
      allPairsAdvance: true,
      registrationFee: 60000,
      firstPrize: 'Efectivo + Trofeos',
      secondPrize: 'Efectivo + Trofeos',
      ballAvailabilityNote: 'Las pelotas estarán a disposición en la cantina.',
      scheduleNote: 'Zona A normalmente los lunes y Zona B normalmente los jueves, desde las 19:00. Avisar con anterioridad si existe un inconveniente de día u horario.',
      activeFrom: dateOnly('2026-08-17')
    },
    create: {
      slug: 'liga-suma-12-2026',
      name: 'Liga Suma 12',
      seasonYear: 2026,
      status: 'ACTIVE',
      currentStage: 'GROUP_STAGE',
      courtId,
      timezone: 'America/Argentina/Cordoba',
      bestOfSets: 3,
      fullThirdSet: true,
      allPairsAdvance: true,
      registrationFee: 60000,
      firstPrize: 'Efectivo + Trofeos',
      secondPrize: 'Efectivo + Trofeos',
      ballAvailabilityNote: 'Las pelotas estarán a disposición en la cantina.',
      scheduleNote: 'Zona A normalmente los lunes y Zona B normalmente los jueves, desde las 19:00. Avisar con anterioridad si existe un inconveniente de día u horario.',
      activeFrom: dateOnly('2026-08-17')
    }
  });

  await prisma.leagueRuleSettings.upsert({
    where: { leagueId: league.id },
    update: {
      straightSetsWinPoints: 3,
      threeSetsWinPoints: 2,
      threeSetsLossPoints: 1,
      straightSetsLossPoints: 0,
      gamesPositiveDefinition: GAMES_POSITIVE_DEFINITION
    },
    create: {
      leagueId: league.id,
      straightSetsWinPoints: 3,
      threeSetsWinPoints: 2,
      threeSetsLossPoints: 1,
      straightSetsLossPoints: 0,
      gamesPositiveDefinition: GAMES_POSITIVE_DEFINITION
    }
  });

  const zones: Record<'A' | 'B', { id: number }> = {} as Record<'A' | 'B', { id: number }>;
  for (const [displayOrder, code] of (['A', 'B'] as const).entries()) {
    zones[code] = await prisma.leagueZone.upsert({
      where: { leagueId_code: { leagueId: league.id, code } },
      update: { name: `Zona ${code}`, regularDay: code === 'A' ? 'LUNES' : 'JUEVES', displayOrder },
      create: { leagueId: league.id, code, name: `Zona ${code}`, regularDay: code === 'A' ? 'LUNES' : 'JUEVES', displayOrder }
    });
  }

  const pairsByZoneAndSeed = new Map<string, { id: number }>();
  for (const code of ['A', 'B'] as const) {
    for (const [index, names] of zonePairs[code].entries()) {
      const seedNumber = index + 1;
      const displayName = `${names[0]} - ${names[1]}`;
      const existing = await prisma.leaguePair.findUnique({
        where: { leagueId_displayName: { leagueId: league.id, displayName } }
      });
      let pair;
      if (existing) {
        pair = await prisma.leaguePair.update({
          where: { id: existing.id },
          data: { zoneId: zones[code].id, seedNumber, active: true }
        });
        await Promise.all([
          prisma.leaguePlayer.update({ where: { id: existing.firstPlayerId }, data: { displayName: names[0] } }),
          prisma.leaguePlayer.update({ where: { id: existing.secondPlayerId }, data: { displayName: names[1] } })
        ]);
      } else {
        const firstPlayer = await prisma.leaguePlayer.create({ data: { leagueId: league.id, displayName: names[0] } });
        const secondPlayer = await prisma.leaguePlayer.create({ data: { leagueId: league.id, displayName: names[1] } });
        pair = await prisma.leaguePair.create({
          data: {
            leagueId: league.id,
            zoneId: zones[code].id,
            seedNumber,
            displayName,
            firstPlayerId: firstPlayer.id,
            secondPlayerId: secondPlayer.id
          }
        });
      }
      pairsByZoneAndSeed.set(`${code}-${seedNumber}`, pair);
    }
  }

  for (const code of ['A', 'B'] as const) {
    for (const [roundIndex, round] of SUMA_12_FIXTURE_PATTERN.entries()) {
      for (const [slot, [homeSeed, awaySeed]] of round.entries()) {
        const matchday = roundIndex + 1;
        const matchCode = `${code}-F${matchday}-M${slot + 1}`;
        await prisma.leagueMatch.upsert({
          where: { leagueId_code: { leagueId: league.id, code: matchCode } },
          update: {
            zoneId: zones[code].id,
            stage: 'GROUP_STAGE',
            matchday,
            scheduledDate: dateOnly(matchdayDates[code][roundIndex]),
            scheduledTime: SUMA_12_MATCH_TIMES[slot],
            homePairId: pairsByZoneAndSeed.get(`${code}-${homeSeed}`)!.id,
            awayPairId: pairsByZoneAndSeed.get(`${code}-${awaySeed}`)!.id
          },
          create: {
            leagueId: league.id,
            zoneId: zones[code].id,
            stage: 'GROUP_STAGE',
            matchday,
            code: matchCode,
            scheduledDate: dateOnly(matchdayDates[code][roundIndex]),
            scheduledTime: SUMA_12_MATCH_TIMES[slot],
            status: 'SCHEDULED',
            homePairId: pairsByZoneAndSeed.get(`${code}-${homeSeed}`)!.id,
            awayPairId: pairsByZoneAndSeed.get(`${code}-${awaySeed}`)!.id
          }
        });
      }
    }
  }

  const knockoutIds = new Map<string, number>();
  for (const match of SUMA_12_KNOCKOUT) {
    const saved = await prisma.leagueMatch.upsert({
      where: { leagueId_code: { leagueId: league.id, code: match.code } },
      update: {
        stage: match.stage,
        scheduledDate: dateOnly(match.date),
        scheduledTime: match.time,
        homePlaceholder: match.home,
        awayPlaceholder: match.away
      },
      create: {
        leagueId: league.id,
        stage: match.stage,
        code: match.code,
        scheduledDate: dateOnly(match.date),
        scheduledTime: match.time,
        status: 'PENDING',
        homePlaceholder: match.home,
        awayPlaceholder: match.away
      }
    });
    knockoutIds.set(match.code, saved.id);
  }
  for (const match of SUMA_12_KNOCKOUT) {
    await prisma.leagueMatch.update({
      where: { id: knockoutIds.get(match.code)! },
      data: {
        nextMatchId: match.nextCode ? knockoutIds.get(match.nextCode)! : null,
        nextSlot: match.nextSlot
      }
    });
  }

  return league;
}
