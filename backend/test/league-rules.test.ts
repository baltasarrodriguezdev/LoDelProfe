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

test('mantiene pendiente el puntaje de la derrota 0–2 cuando no está definido', () => {
  const summary = validateLeagueResult([{ homeGames: 6, awayGames: 0 }, { homeGames: 6, awayGames: 1 }]);
  const points = pointsForResult(summary, { ...confirmedRules, straightSetsLossPoints: null });
  assert.equal(points.homePoints, 3);
  assert.equal(points.awayPoints, null);
  const table = calculateStandings(
    [{ id: 1, displayName: 'A - B', seedNumber: 1 }, { id: 2, displayName: 'C - D', seedNumber: 2 }],
    [{ homePairId: 1, awayPairId: 2, official: true, status: 'FINISHED', sets: [{ homeGames: 6, awayGames: 0 }, { homeGames: 6, awayGames: 1 }] }],
    { ...confirmedRules, straightSetsLossPoints: null }
  );
  assert.equal(table.rows.find(row => row.pairId === 2)?.points, null);
  assert.equal(table.rankingComplete, false);
  assert.match(table.warnings.join(' '), /pendiente de definición/i);
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
