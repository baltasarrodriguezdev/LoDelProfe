import { HttpError } from '../utils/http-error.js';

export type LeagueSetInput = { homeGames: number; awayGames: number };
export type LeagueResultSummary = {
  homeSets: number;
  awaySets: number;
  homeGames: number;
  awayGames: number;
  winnerSide: 'HOME' | 'AWAY';
  wentToThreeSets: boolean;
};

export type LeagueScoringRules = {
  straightSetsWinPoints: number;
  threeSetsWinPoints: number;
  threeSetsLossPoints: number;
  straightSetsLossPoints: number | null;
};

export type StandingsPair = {
  id: number;
  displayName: string;
  seedNumber: number;
};

export type StandingsMatch = {
  homePairId: number | null;
  awayPairId: number | null;
  official: boolean;
  status: string;
  sets: LeagueSetInput[];
};

export type StandingRow = {
  pairId: number;
  pair: string;
  seedNumber: number;
  position: number | null;
  played: number;
  setsFor: number;
  setsAgainst: number;
  setDifference: number;
  gamesFor: number;
  gamesAgainst: number;
  gameDifference: number;
  points: number | null;
  confirmedPoints: number;
  pendingPointsMatches: number;
  rankingPending: boolean;
};

export const GAMES_POSITIVE_DEFINITION = 'Games a favor − games en contra';

export function calculateGamesPositive(gamesFor: number, gamesAgainst: number) {
  return gamesFor - gamesAgainst;
}

export const SUMA_12_FIXTURE_PATTERN = [
  [[1, 2], [3, 4], [5, 6], [7, 8]],
  [[1, 8], [4, 5], [6, 7], [2, 3]],
  [[2, 4], [3, 5], [6, 8], [1, 7]],
  [[3, 8], [4, 7], [1, 5], [2, 6]],
  [[1, 4], [3, 6], [5, 7], [2, 8]],
  [[2, 7], [5, 8], [1, 3], [4, 6]],
  [[4, 8], [1, 6], [3, 7], [2, 5]]
] as const;

export const SUMA_12_MATCH_TIMES = ['19:00', '20:00', '21:00', '22:00'] as const;

export const SUMA_12_KNOCKOUT = [
  { code: 'P1', stage: 'ROUND_OF_16', date: '2026-10-03', time: '14:00', home: '1.º Zona A', away: '8.º Zona B', nextCode: 'C1', nextSlot: 'HOME' },
  { code: 'P2', stage: 'ROUND_OF_16', date: '2026-10-03', time: '15:00', home: '4.º Zona B', away: '5.º Zona A', nextCode: 'C1', nextSlot: 'AWAY' },
  { code: 'P3', stage: 'ROUND_OF_16', date: '2026-10-03', time: '16:00', home: '3.º Zona A', away: '6.º Zona B', nextCode: 'C2', nextSlot: 'HOME' },
  { code: 'P4', stage: 'ROUND_OF_16', date: '2026-10-03', time: '17:00', home: '2.º Zona B', away: '7.º Zona A', nextCode: 'C2', nextSlot: 'AWAY' },
  { code: 'P5', stage: 'ROUND_OF_16', date: '2026-10-03', time: '18:00', home: '1.º Zona B', away: '8.º Zona A', nextCode: 'C3', nextSlot: 'HOME' },
  { code: 'P6', stage: 'ROUND_OF_16', date: '2026-10-03', time: '19:00', home: '4.º Zona A', away: '5.º Zona B', nextCode: 'C3', nextSlot: 'AWAY' },
  { code: 'P7', stage: 'ROUND_OF_16', date: '2026-10-03', time: '20:00', home: '3.º Zona B', away: '6.º Zona A', nextCode: 'C4', nextSlot: 'HOME' },
  { code: 'P8', stage: 'ROUND_OF_16', date: '2026-10-03', time: '21:00', home: '2.º Zona A', away: '7.º Zona B', nextCode: 'C4', nextSlot: 'AWAY' },
  { code: 'C1', stage: 'QUARTERFINAL', date: '2026-10-04', time: '15:00', home: 'Ganador P1', away: 'Ganador P2', nextCode: 'S1', nextSlot: 'HOME' },
  { code: 'C2', stage: 'QUARTERFINAL', date: '2026-10-04', time: '16:00', home: 'Ganador P3', away: 'Ganador P4', nextCode: 'S1', nextSlot: 'AWAY' },
  { code: 'C3', stage: 'QUARTERFINAL', date: '2026-10-04', time: '17:00', home: 'Ganador P5', away: 'Ganador P6', nextCode: 'S2', nextSlot: 'HOME' },
  { code: 'C4', stage: 'QUARTERFINAL', date: '2026-10-04', time: '18:00', home: 'Ganador P7', away: 'Ganador P8', nextCode: 'S2', nextSlot: 'AWAY' },
  { code: 'S1', stage: 'SEMIFINAL', date: null, time: '19:00', home: 'Ganador C1', away: 'Ganador C2', nextCode: 'F1', nextSlot: 'HOME' },
  { code: 'S2', stage: 'SEMIFINAL', date: null, time: '20:00', home: 'Ganador C3', away: 'Ganador C4', nextCode: 'F1', nextSlot: 'AWAY' },
  { code: 'F1', stage: 'FINAL', date: null, time: '23:00', home: 'Ganador S1', away: 'Ganador S2', nextCode: null, nextSlot: null }
] as const;

export function generateSevenMatchdays(seedNumbers: readonly number[]) {
  if (seedNumbers.length !== 8 || new Set(seedNumbers).size !== 8) {
    throw new HttpError(409, 'Se necesitan exactamente ocho parejas distintas para generar las siete fechas.');
  }
  const bySeed = new Set(seedNumbers);
  if (SUMA_12_FIXTURE_PATTERN.some(round => round.some(pair => pair.some(seed => !bySeed.has(seed))))) {
    throw new HttpError(409, 'Las parejas deben estar numeradas del 1 al 8.');
  }
  return SUMA_12_FIXTURE_PATTERN.map((matches, index) => ({
    matchday: index + 1,
    matches: matches.map(([homeSeed, awaySeed], slot) => ({
      homeSeed,
      awaySeed,
      time: SUMA_12_MATCH_TIMES[slot]
    }))
  }));
}

function assertValidSet(set: LeagueSetInput, index: number) {
  if (!Number.isInteger(set.homeGames) || !Number.isInteger(set.awayGames) || set.homeGames < 0 || set.awayGames < 0) {
    throw new HttpError(400, `El set ${index + 1} tiene games inválidos.`);
  }
  if (set.homeGames === set.awayGames) throw new HttpError(400, `El set ${index + 1} no puede terminar empatado.`);
  const winner = Math.max(set.homeGames, set.awayGames);
  const loser = Math.min(set.homeGames, set.awayGames);
  const standard = winner === 6 && loser <= 4;
  const extended = winner === 7 && (loser === 5 || loser === 6);
  if (!standard && !extended) {
    throw new HttpError(400, `El set ${index + 1} no tiene un marcador válido de set completo.`);
  }
}

export function validateLeagueResult(sets: readonly LeagueSetInput[]): LeagueResultSummary {
  if (sets.length < 2 || sets.length > 3) {
    throw new HttpError(400, 'Un resultado definitivo debe contener dos o tres sets completos.');
  }
  sets.forEach(assertValidSet);
  let homeSets = 0;
  let awaySets = 0;
  let homeGames = 0;
  let awayGames = 0;
  sets.forEach((set, index) => {
    if (homeSets === 2 || awaySets === 2) {
      throw new HttpError(400, `El set ${index + 1} sobra porque el partido ya estaba definido.`);
    }
    if (set.homeGames > set.awayGames) homeSets++;
    else awaySets++;
    homeGames += set.homeGames;
    awayGames += set.awayGames;
  });
  if (homeSets !== 2 && awaySets !== 2) {
    throw new HttpError(400, 'El resultado no define una pareja ganadora al mejor de tres sets.');
  }
  if (sets.length === 2 && homeSets !== 2 && awaySets !== 2) {
    throw new HttpError(400, 'Un partido de dos sets debe tener la misma pareja ganadora en ambos.');
  }
  return {
    homeSets,
    awaySets,
    homeGames,
    awayGames,
    winnerSide: homeSets > awaySets ? 'HOME' : 'AWAY',
    wentToThreeSets: sets.length === 3
  };
}

export function pointsForResult(summary: LeagueResultSummary, rules: LeagueScoringRules) {
  const winnerPoints = summary.wentToThreeSets ? rules.threeSetsWinPoints : rules.straightSetsWinPoints;
  const loserPoints = summary.wentToThreeSets ? rules.threeSetsLossPoints : rules.straightSetsLossPoints;
  return summary.winnerSide === 'HOME'
    ? { homePoints: winnerPoints, awayPoints: loserPoints }
    : { homePoints: loserPoints, awayPoints: winnerPoints };
}

export function advanceKnockoutWinner(
  source: { homePairId: number | null; awayPairId: number | null; sets: LeagueSetInput[]; nextSlot: 'HOME' | 'AWAY' | null },
  target: { homePairId: number | null; awayPairId: number | null }
) {
  if (!source.homePairId || !source.awayPairId || !source.nextSlot) throw new HttpError(409, 'El cruce no está listo para avanzar.');
  const summary = validateLeagueResult(source.sets);
  const winnerId = summary.winnerSide === 'HOME' ? source.homePairId : source.awayPairId;
  return source.nextSlot === 'HOME'
    ? { ...target, homePairId: winnerId }
    : { ...target, awayPairId: winnerId };
}

export function calculateStandings(pairs: readonly StandingsPair[], matches: readonly StandingsMatch[], rules: LeagueScoringRules) {
  const rows = new Map<number, StandingRow>(pairs.map(pair => [pair.id, {
    pairId: pair.id,
    pair: pair.displayName,
    seedNumber: pair.seedNumber,
    position: null,
    played: 0,
    setsFor: 0,
    setsAgainst: 0,
    setDifference: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    gameDifference: 0,
    points: 0,
    confirmedPoints: 0,
    pendingPointsMatches: 0,
    rankingPending: false
  }]));
  const completed: Array<StandingsMatch & { summary: LeagueResultSummary }> = [];

  for (const match of matches) {
    if (!match.official || match.status !== 'FINISHED' || !match.homePairId || !match.awayPairId) continue;
    const home = rows.get(match.homePairId);
    const away = rows.get(match.awayPairId);
    if (!home || !away) continue;
    const summary = validateLeagueResult(match.sets);
    const points = pointsForResult(summary, rules);
    completed.push({ ...match, summary });
    home.played++;
    away.played++;
    home.setsFor += summary.homeSets;
    home.setsAgainst += summary.awaySets;
    away.setsFor += summary.awaySets;
    away.setsAgainst += summary.homeSets;
    home.gamesFor += summary.homeGames;
    home.gamesAgainst += summary.awayGames;
    away.gamesFor += summary.awayGames;
    away.gamesAgainst += summary.homeGames;
    if (points.homePoints == null) home.pendingPointsMatches++;
    else home.confirmedPoints += points.homePoints;
    if (points.awayPoints == null) away.pendingPointsMatches++;
    else away.confirmedPoints += points.awayPoints;
  }

  for (const row of rows.values()) {
    row.setDifference = row.setsFor - row.setsAgainst;
    row.gameDifference = calculateGamesPositive(row.gamesFor, row.gamesAgainst);
    row.points = row.pendingPointsMatches ? null : row.confirmedPoints;
  }

  const warnings: string[] = [];
  const ordered = [...rows.values()].sort((left, right) => {
    if (left.points == null && right.points == null) return left.seedNumber - right.seedNumber;
    if (left.points == null) return 1;
    if (right.points == null) return -1;
    return right.points - left.points || left.seedNumber - right.seedNumber;
  });

  if (ordered.some(row => row.points == null)) {
    warnings.push('Hay resultados 2–0 cuyo puntaje para la pareja perdedora sigue pendiente de definición. Las posiciones no pueden calcularse correctamente.');
    for (const row of ordered) row.rankingPending = true;
    return { rows: ordered, warnings, rankingComplete: false };
  }

  let cursor = 0;
  while (cursor < ordered.length) {
    const end = ordered.findIndex((row, index) => index > cursor && row.points !== ordered[cursor].points);
    const groupEnd = end === -1 ? ordered.length : end;
    const tied = ordered.slice(cursor, groupEnd);
    if (tied.length === 1) {
      tied[0].position = cursor + 1;
    } else if (tied.length === 2) {
      const headToHead = completed.find(match =>
        (match.homePairId === tied[0].pairId && match.awayPairId === tied[1].pairId)
        || (match.homePairId === tied[1].pairId && match.awayPairId === tied[0].pairId));
      if (headToHead) {
        const winnerId = headToHead.summary.winnerSide === 'HOME' ? headToHead.homePairId : headToHead.awayPairId;
        if (tied[1].pairId === winnerId) [ordered[cursor], ordered[cursor + 1]] = [ordered[cursor + 1], ordered[cursor]];
        ordered[cursor].position = cursor + 1;
        ordered[cursor + 1].position = cursor + 2;
      } else {
        tied.forEach(row => row.rankingPending = true);
        warnings.push(`El desempate entre ${tied[0].pair} y ${tied[1].pair} espera el partido entre sí; no se salteó ese criterio.`);
      }
    } else {
      tied.forEach(row => row.rankingPending = true);
      warnings.push(`Hay ${tied.length} parejas empatadas en ${tied[0].points} puntos y el reglamento no define cómo resolver empates múltiples.`);
    }
    cursor = groupEnd;
  }

  const unresolved = ordered.some(row => row.rankingPending);
  if (unresolved) warnings.push('El orden sigue pendiente: no se saltean criterios sin resolver ni se ejecuta un sorteo automáticamente.');
  return { rows: ordered, warnings: [...new Set(warnings)], rankingComplete: !unresolved };
}
