export type LeagueTab = 'summary' | 'zones' | 'matches' | 'standings' | 'bracket';

export type LeaguePair = {
  id: number;
  seedNumber: number;
  displayName: string;
  firstPlayer: { id: number; displayName: string };
  secondPlayer: { id: number; displayName: string };
};

export type LeagueZone = {
  id: number;
  code: string;
  name: string;
  regularDay: string;
  pairs: LeaguePair[];
};

export type LeagueSet = { setNumber: number; homeGames: number; awayGames: number };

export type LeagueMatch = {
  id: number;
  code: string;
  stage: string;
  matchday: number | null;
  zone: { id: number; code: string; name: string } | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  status: string;
  official: boolean;
  officialAt: string | null;
  homePair: { id: number; displayName: string; seedNumber: number } | null;
  awayPair: { id: number; displayName: string; seedNumber: number } | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  sets: LeagueSet[];
  result: { homeSets: number; awaySets: number; homeGames: number; awayGames: number; winnerSide: 'HOME' | 'AWAY'; wentToThreeSets: boolean; homePoints: number | null; awayPoints: number | null } | null;
  scoringPending: boolean;
  rescheduleNote: string | null;
  updatedAt: string;
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

export type LeaguePayload = {
  league: {
    id: number;
    slug: string;
    name: string;
    seasonYear: number;
    status: string;
    currentStage: string;
    court: { id: number; name: string } | null;
    timezone: string;
    bestOfSets: number;
    fullThirdSet: boolean;
    allPairsAdvance: boolean;
    registrationFee: number | null;
    firstPrize: string | null;
    secondPrize: string | null;
    ballAvailabilityNote: string | null;
    scheduleNote: string | null;
    activeFrom: string | null;
    activeUntil: string | null;
    createdAt: string;
    updatedAt: string;
  };
  zones: LeagueZone[];
  matches: LeagueMatch[];
  standings: Array<{ zone: { id: number; code: string; name: string }; rows: StandingRow[]; warnings: string[]; rankingComplete: boolean }>;
  bracket: Array<{ stage: string; matches: LeagueMatch[] }>;
  summary: { nextMatchday: { number: number; zone: { id: number; code: string; name: string }; date: string } | null; upcomingMatches: LeagueMatch[]; latestResults: LeagueMatch[] };
  rules: {
    scoring: Record<string, unknown> & { straightSetsWinPoints: number; threeSetsWinPoints: number; threeSetsLossPoints: number; straightSetsLossPoints: number | null };
    tieBreakCriteria: string[];
    pending: string[];
  };
};
