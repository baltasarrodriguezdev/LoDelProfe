import type { InstagramLeaguePayload } from '../../src/services/instagram-content.service.js';

export function instagramTestPayload(): InstagramLeaguePayload {
  const zoneA = {
    id: 1, code: 'A', name: 'Zona A', regularDay: 'LUNES',
    pairs: [
      'Rodríguez Teruel del Valle - Fernández de la Fuente',
      'Moriconi - Baroni', 'Prunesti - Britos', 'Grella - Scaglia',
      'Vaca - Vaca', 'Lencina - Giordano', 'López - Gariglio', 'Auger - Martínez'
    ].map((displayName, index) => ({ id: index + 1, seedNumber: index + 1, displayName }))
  };
  const zoneB = {
    id: 2, code: 'B', name: 'Zona B', regularDay: 'JUEVES',
    pairs: [
      'Gregorio - Colombo', 'Demichelis - Demichelis', 'Bustos - Pereyra', 'Rodríguez Teruel - Ponce',
      'Semperez - Sánchez', 'Vaca - Arrieta', 'Vaca - Vega', 'González - González'
    ].map((displayName, index) => ({ id: index + 9, seedNumber: index + 1, displayName }))
  };
  const groupMatches = [zoneA, zoneB].flatMap((zone, zoneIndex) => [0, 1, 2, 3].map((slot) => {
    const homePair = zone.pairs[slot * 2];
    const awayPair = zone.pairs[slot * 2 + 1];
    const finished = zoneIndex === 0;
    const sets = finished
      ? slot % 2 === 0
        ? [{ setNumber: 1, homeGames: 6, awayGames: 4 }, { setNumber: 2, homeGames: 3, awayGames: 6 }, { setNumber: 3, homeGames: 6, awayGames: 2 }]
        : [{ setNumber: 1, homeGames: 2, awayGames: 6 }, { setNumber: 2, homeGames: 4, awayGames: 6 }]
      : [];
    return {
      id: zoneIndex * 10 + slot + 1,
      code: `${zone.code}-F1-M${slot + 1}`,
      stage: 'GROUP_STAGE', matchday: 1,
      zone: { id: zone.id, code: zone.code, name: zone.name },
      scheduledDate: zoneIndex === 0 ? '2026-08-17' : '2026-08-20',
      scheduledTime: ['19:00', '20:15', '21:30', '22:45'][slot],
      status: finished ? 'FINISHED' : slot === 2 ? 'RESCHEDULED' : 'SCHEDULED',
      official: finished,
      homePair, awayPair, homePlaceholder: null, awayPlaceholder: null, sets,
      result: finished ? { winnerSide: (slot % 2 === 0 ? 'HOME' : 'AWAY') as 'HOME' | 'AWAY' } : null
    };
  }));
  const knockoutPairs = [...zoneA.pairs, ...zoneB.pairs];
  const knockoutStructure = [
    ['ROUND_OF_16', 8], ['QUARTERFINAL', 4], ['SEMIFINAL', 2], ['FINAL', 1]
  ] as const;
  let knockoutId = 100;
  const bracket = knockoutStructure.map(([stage, count], stageIndex) => ({
    stage,
    matches: Array.from({ length: count }, (_, index) => {
      const homePair = knockoutPairs[(index * 2) % knockoutPairs.length];
      const awayPair = knockoutPairs[(index * 2 + 1) % knockoutPairs.length];
      return {
        id: knockoutId++, code: `${stage[0]}${index + 1}`, stage, matchday: null, zone: null,
        scheduledDate: stage === 'FINAL' ? '2026-10-10' : '2026-10-03', scheduledTime: `${String(14 + index).padStart(2, '0')}:00`,
        status: stageIndex < 2 || stage === 'FINAL' ? 'FINISHED' : index === 0 ? 'SCHEDULED' : 'PENDING',
        official: stageIndex < 2 || stage === 'FINAL', homePair, awayPair,
        homePlaceholder: null, awayPlaceholder: null,
        sets: stageIndex < 2 || stage === 'FINAL' ? [{ setNumber: 1, homeGames: 6, awayGames: 4 }, { setNumber: 2, homeGames: 7, awayGames: 5 }] : [],
        result: stageIndex < 2 || stage === 'FINAL' ? { winnerSide: 'HOME' as const } : null
      };
    })
  }));
  const standings = [zoneA, zoneB].map(zone => ({
    zone: { id: zone.id, code: zone.code, name: zone.name },
    rows: zone.pairs.map((pair, index) => ({
      pairId: pair.id, pair: pair.displayName, position: index + 1, played: 7,
      won: 7 - index, lost: index, points: Math.max(0, 21 - index * 2), setsFor: 14 - index, gamesFor: 80 - index * 4, rankingPending: false
    })),
    warnings: [], rankingComplete: true
  }));
  const knockoutMatches = bracket.flatMap(group => group.matches);
  return {
    league: { id: 1, slug: 'liga-suma-12-2026', name: 'Liga Suma 12', seasonYear: 2026, court: { id: 1, name: 'Lo del Profe' }, updatedAt: '2026-08-14T12:00:00.000Z' },
    zones: [zoneA, zoneB],
    matches: [...groupMatches, ...knockoutMatches],
    standings,
    bracket
  };
}
