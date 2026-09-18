import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceKnockoutWinner,
  calculateGamesPositive,
  calculateStandings,
  generateSevenMatchdays,
  pointsForResult,
  SUMA_12_KNOCKOUT,
  validateLeagueResult
} from '../src/domain/league-rules.js';

const confirmedRules = { straightSetsWinPoints: 3, threeSetsWinPoints: 2, threeSetsLossPoints: 1, straightSetsLossPoints: 0 };

test('calcula los puntajes confirmados para victorias en dos y tres sets', () => {
  const straight = validateLeagueResult([{ homeGames: 6, awayGames: 2 }, { homeGames: 6, awayGames: 4 }]);
  assert.deepEqual(pointsForResult(straight, confirmedRules), { homePoints: 3, awayPoints: 0 });
  const three = validateLeagueResult([{ homeGames: 6, awayGames: 4 }, { homeGames: 3, awayGames: 6 }, { homeGames: 7, awayGames: 5 }]);
  assert.deepEqual(pointsForResult(three, confirmedRules), { homePoints: 2, awayPoints: 1 });
});

test('una derrota 0–2 otorga 0 puntos a la pareja perdedora', () => {
  const summary = validateLeagueResult([{ homeGames: 6, awayGames: 0 }, { homeGames: 6, awayGames: 1 }]);
  const points = pointsForResult(summary, confirmedRules);
  assert.equal(points.homePoints, 3);
  assert.equal(points.awayPoints, 0);
  const table = calculateStandings(
    [{ id: 1, displayName: 'A - B', seedNumber: 1 }, { id: 2, displayName: 'C - D', seedNumber: 2 }],
    [{ homePairId: 1, awayPairId: 2, official: true, status: 'FINISHED', sets: [{ homeGames: 6, awayGames: 0 }, { homeGames: 6, awayGames: 1 }] }],
    confirmedRules
  );
  assert.equal(table.rows.find(row => row.pairId === 2)?.points, 0);
});

test('una derrota 1–2 otorga 1 punto a la pareja perdedora', () => {
  const summary = validateLeagueResult([
    { homeGames: 6, awayGames: 3 },
    { homeGames: 4, awayGames: 6 },
    { homeGames: 6, awayGames: 2 }
  ]);
  assert.deepEqual(pointsForResult(summary, confirmedRules), { homePoints: 2, awayPoints: 1 });
});

test('deriva sets, games y diferencias desde resultados oficiales', () => {
  const table = calculateStandings(
    [{ id: 1, displayName: 'A - B', seedNumber: 1 }, { id: 2, displayName: 'C - D', seedNumber: 2 }],
    [{ homePairId: 1, awayPairId: 2, official: true, status: 'FINISHED', sets: [{ homeGames: 6, awayGames: 4 }, { homeGames: 3, awayGames: 6 }, { homeGames: 7, awayGames: 5 }] }],
    confirmedRules
  );
  const home = table.rows.find(row => row.pairId === 1)!;
  assert.deepEqual({ played: home.played, sf: home.setsFor, sc: home.setsAgainst, ds: home.setDifference, gf: home.gamesFor, gc: home.gamesAgainst, dg: home.gameDifference, points: home.points },
    { played: 1, sf: 2, sc: 1, ds: 1, gf: 16, gc: 15, dg: 1, points: 2 });
});

test('calcula games positivos como games a favor menos games en contra', () => {
  assert.equal(calculateGamesPositive(42, 35), 7);
  assert.equal(calculateGamesPositive(31, 38), -7);
  assert.equal(calculateGamesPositive(36, 36), 0);
});

test('actualiza las posiciones únicamente después de confirmar el partido', () => {
  const pairs = [{ id: 1, displayName: 'A - B', seedNumber: 1 }, { id: 2, displayName: 'C - D', seedNumber: 2 }];
  const draft = { homePairId: 1, awayPairId: 2, official: false, status: 'FINISHED', sets: [{ homeGames: 6, awayGames: 2 }, { homeGames: 6, awayGames: 3 }] };
  assert.equal(calculateStandings(pairs, [draft], confirmedRules).rows.find(row => row.pairId === 1)?.played, 0);
  const confirmed = calculateStandings(pairs, [{ ...draft, official: true }], confirmedRules);
  assert.equal(confirmed.rows.find(row => row.pairId === 1)?.played, 1);
  assert.equal(confirmed.rows.find(row => row.pairId === 1)?.points, 3);
});

test('recalcula toda la tabla cuando se modifica un resultado oficial', () => {
  const pairs = [{ id: 1, displayName: 'A - B', seedNumber: 1 }, { id: 2, displayName: 'C - D', seedNumber: 2 }];
  const original = calculateStandings(pairs, [{
    homePairId: 1, awayPairId: 2, official: true, status: 'FINISHED',
    sets: [{ homeGames: 6, awayGames: 2 }, { homeGames: 6, awayGames: 4 }]
  }], confirmedRules);
  const corrected = calculateStandings(pairs, [{
    homePairId: 1, awayPairId: 2, official: true, status: 'FINISHED',
    sets: [{ homeGames: 4, awayGames: 6 }, { homeGames: 6, awayGames: 3 }, { homeGames: 5, awayGames: 7 }]
  }], confirmedRules);
  assert.deepEqual(original.rows.map(row => [row.pairId, row.won, row.lost, row.points]), [[1, 1, 0, 3], [2, 0, 1, 0]]);
  assert.deepEqual(corrected.rows.map(row => [row.pairId, row.won, row.lost, row.points]), [[2, 1, 0, 2], [1, 0, 1, 1]]);
});

test('ordena por puntos y luego por el partido entre sí sin saltar criterios', () => {
  const pairs = [1, 2, 3].map(id => ({ id, displayName: `Pareja ${id}`, seedNumber: id }));
  const matches = [
    { homePairId: 1, awayPairId: 2, official: true, status: 'FINISHED', sets: [{ homeGames: 6, awayGames: 2 }, { homeGames: 6, awayGames: 2 }] },
    { homePairId: 2, awayPairId: 3, official: true, status: 'FINISHED', sets: [{ homeGames: 6, awayGames: 1 }, { homeGames: 6, awayGames: 1 }] }
  ];
  const table = calculateStandings(pairs, matches, confirmedRules);
  assert.equal(table.rows[0].pairId, 1);
  assert.equal(table.rows[1].pairId, 2);
  assert.deepEqual(table.rows.slice(0, 2).map(row => row.points), [3, 3]);
});

test('si todavía no jugaron entre sí asigna posiciones usando el sorteo original como último criterio', () => {
  const pairs = [{ id: 1, displayName: 'Nombre muy largo uno', seedNumber: 1 }, { id: 2, displayName: 'Nombre muy largo dos', seedNumber: 2 }];
  const table = calculateStandings(pairs, [], confirmedRules);
  assert.equal(table.rankingComplete, true);
  assert.deepEqual(table.rows.map(row => [row.pairId, row.position, row.rankingPending]), [[1, 1, false], [2, 2, false]]);
  assert.deepEqual(table.warnings, []);
});

test('completa el desempate por sets a favor, games a favor y games positivos', () => {
  const pairs = [1, 2, 3, 4].map(id => ({ id, displayName: `Pareja ${id}`, seedNumber: id }));
  const result = (homePairId: number, awayPairId: number, sets: Array<{ homeGames: number; awayGames: number }>) => ({
    homePairId, awayPairId, official: true, status: 'FINISHED', sets
  });
  const straight = (winner: number, loser: number, homeGames = 6, awayGames = 2) => result(winner, loser, [
    { homeGames, awayGames }, { homeGames, awayGames }
  ]);

  const setsTable = calculateStandings(pairs, [
    straight(1, 3), straight(4, 1), straight(2, 3),
    result(4, 2, [{ homeGames: 6, awayGames: 4 }, { homeGames: 3, awayGames: 6 }, { homeGames: 6, awayGames: 2 }])
  ], { ...confirmedRules, threeSetsLossPoints: 0 });
  assert.ok(setsTable.rows.findIndex(row => row.pairId === 2) < setsTable.rows.findIndex(row => row.pairId === 1));

  const gamesForTable = calculateStandings(pairs, [straight(1, 3, 6, 4), straight(2, 4, 7, 5)], confirmedRules);
  assert.ok(gamesForTable.rows.findIndex(row => row.pairId === 2) < gamesForTable.rows.findIndex(row => row.pairId === 1));

  const positiveGamesTable = calculateStandings(pairs, [straight(1, 3, 6, 0), straight(2, 4, 6, 4)], confirmedRules);
  assert.ok(positiveGamesTable.rows.findIndex(row => row.pairId === 1) < positiveGamesTable.rows.findIndex(row => row.pairId === 2));
  assert.deepEqual(positiveGamesTable.rows.map(row => row.position).sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.ok(positiveGamesTable.rows.every(row => !row.rankingPending));
});

test('genera siete fechas sin enfrentamientos duplicados', () => {
  const rounds = generateSevenMatchdays([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(rounds.length, 7);
  assert.ok(rounds.every(round => round.matches.length === 4));
  const meetings = rounds.flatMap(round => round.matches.map(match => [match.homeSeed, match.awaySeed].sort((a, b) => a - b).join('-')));
  assert.equal(meetings.length, 28);
  assert.equal(new Set(meetings).size, 28);
});

test('define exactamente los cruces de octavos confirmados', () => {
  assert.deepEqual(SUMA_12_KNOCKOUT.slice(0, 8).map(match => [match.code, match.home, match.away]), [
    ['P1', '1.º Zona A', '8.º Zona B'], ['P2', '4.º Zona B', '5.º Zona A'],
    ['P3', '3.º Zona A', '6.º Zona B'], ['P4', '2.º Zona B', '7.º Zona A'],
    ['P5', '1.º Zona B', '8.º Zona A'], ['P6', '4.º Zona A', '5.º Zona B'],
    ['P7', '3.º Zona B', '6.º Zona A'], ['P8', '2.º Zona A', '7.º Zona B']
  ]);
});

test('avanza automáticamente al ganador al slot eliminatorio indicado', () => {
  const target = advanceKnockoutWinner(
    { homePairId: 10, awayPairId: 20, sets: [{ homeGames: 4, awayGames: 6 }, { homeGames: 6, awayGames: 3 }, { homeGames: 5, awayGames: 7 }], nextSlot: 'AWAY' },
    { homePairId: 30, awayPairId: null }
  );
  assert.deepEqual(target, { homePairId: 30, awayPairId: 20 });
});

test('rechaza resultados incompletos, sets imposibles y super tie-break', () => {
  assert.throws(() => validateLeagueResult([{ homeGames: 6, awayGames: 4 }]), /dos o tres sets/i);
  assert.throws(() => validateLeagueResult([{ homeGames: 6, awayGames: 5 }, { homeGames: 6, awayGames: 2 }]), /marcador válido/i);
  assert.throws(() => validateLeagueResult([{ homeGames: 6, awayGames: 4 }, { homeGames: 4, awayGames: 6 }, { homeGames: 10, awayGames: 8 }]), /marcador válido/i);
});
