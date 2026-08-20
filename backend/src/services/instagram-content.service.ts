import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import JSZip from 'jszip';
import satori from 'satori';
import { HttpError } from '../utils/http-error.js';

export const INSTAGRAM_FORMATS = ['feed', 'story'] as const;
export const INSTAGRAM_TEMPLATES = [
  'zones',
  'next_matchday',
  'weekly_fixture',
  'today',
  'today_results',
  'individual_result',
  'matchday_results',
  'standings',
  'results_standings',
  'bracket',
  'champions'
] as const;

export type InstagramFormat = typeof INSTAGRAM_FORMATS[number];
export type InstagramTemplate = typeof INSTAGRAM_TEMPLATES[number];
export type InstagramSelection = {
  template: InstagramTemplate;
  format: InstagramFormat;
  zoneId?: number;
  matchday?: number;
  matchId?: number;
  scheduledDate?: string;
};

type Pair = { id: number; displayName: string; seedNumber: number };
type Zone = { id: number; code: string; name: string; regularDay?: string | null; pairs: Pair[] };
type Match = {
  id: number;
  code: string;
  stage: string;
  matchday: number | null;
  zone: { id: number; code: string; name: string } | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  status: string;
  official: boolean;
  homePair: Pair | null;
  awayPair: Pair | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  sets: Array<{ setNumber: number; homeGames: number; awayGames: number }>;
  result: { winnerSide: 'HOME' | 'AWAY' } | null;
};
type Standing = {
  pairId: number;
  pair: string;
  position: number;
  played: number;
  won: number;
  lost: number;
  points: number | null;
  setsFor: number;
  gamesFor: number;
  rankingPending: boolean;
};
export type InstagramLeaguePayload = {
  league: { id: number; slug: string; name: string; seasonYear: number; timezone?: string; court: { id: number; name: string } | null; updatedAt: string | Date };
  zones: Zone[];
  matches: Match[];
  standings: Array<{ zone: { id: number; code: string; name: string }; rows: Standing[]; warnings: string[]; rankingComplete: boolean }>;
  bracket: Array<{ stage: string; matches: Match[] }>;
};

type VNode = string | number | { type: string; props: Record<string, unknown> };
type RenderAssets = { logo: string };
type InternalPage = InstagramPageManifest & { scene: (assets: RenderAssets) => VNode };
export type InstagramPageManifest = { index: number; id: string; label: string; fileName: string; warnings: string[] };
export type InstagramManifest = {
  template: InstagramTemplate;
  format: InstagramFormat;
  width: number;
  height: number;
  description: string;
  zipFileName: string | null;
  sourceUpdatedAt: string;
  pages: InstagramPageManifest[];
};

const COLORS = {
  ink: '#14281b',
  dark: '#223526',
  green: '#536f43',
  olive: '#9a974f',
  lime: '#bedf32',
  cream: '#f5f1e5',
  paper: '#fffdf5',
  muted: '#aebaa8',
  line: '#6f806d'
};
const SITE = 'lodelprofe.com';
const ASSET_FILES = {
  nullFree: resolve(__dirname, '../../assets/instagram/Null_Free.otf'),
  manropeRegular: resolve(__dirname, '../../assets/instagram/Manrope-Regular.ttf'),
  manropeBold: resolve(__dirname, '../../assets/instagram/Manrope-Bold.ttf'),
  manropeExtraBold: resolve(__dirname, '../../assets/instagram/Manrope-ExtraBold.ttf'),
  logo: resolve(__dirname, '../../assets/instagram/lo-del-profe-stacked.png')
};
let assetsPromise: Promise<{ nullFree: Buffer; manropeRegular: Buffer; manropeBold: Buffer; manropeExtraBold: Buffer; logo: string }> | null = null;

function loadAssets() {
  assetsPromise ??= Promise.all([
    readFile(ASSET_FILES.nullFree),
    readFile(ASSET_FILES.manropeRegular),
    readFile(ASSET_FILES.manropeBold),
    readFile(ASSET_FILES.manropeExtraBold),
    readFile(ASSET_FILES.logo)
  ]).then(([nullFree, manropeRegular, manropeBold, manropeExtraBold, logo]) => ({
    nullFree,
    manropeRegular,
    manropeBold,
    manropeExtraBold,
    logo: `data:image/png;base64,${logo.toString('base64')}`
  }));
  return assetsPromise;
}

function h(type: string, props: Record<string, unknown> = {}, ...children: unknown[]): VNode {
  const flat = children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false);
  return { type, props: { ...props, children: flat.length <= 1 ? flat[0] : flat } };
}
const div = (style: Record<string, unknown>, ...children: unknown[]) => h('div', { style }, ...children);
const txt = (value: string | number, style: Record<string, unknown> = {}) => div({ display: 'flex', ...style }, String(value));

function dimensions(format: InstagramFormat) {
  return format === 'feed' ? { width: 1080, height: 1350 } : { width: 1080, height: 1920 };
}

function clean(value: unknown, fallback = 'Por definir') {
  const result = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return result || fallback;
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function leagueSlug(payload: InstagramLeaguePayload) {
  return clean(payload.league.name).toLowerCase().replace(/liga\s+suma\s+12/, 'liga-suma12').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatDate(value: string | null, compact = false) {
  if (!value) return 'Fecha a confirmar';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('es-AR', compact
    ? { day: '2-digit', month: '2-digit', year: 'numeric' }
    : { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

function statusLabel(status: string, official = false) {
  const labels: Record<string, string> = {
    SCHEDULED: 'Programado', LIVE: 'En juego', FINISHED: official ? 'Finalizado' : 'Sin confirmar',
    RESCHEDULED: 'Reprogramado', SUSPENDED: 'Suspendido', PENDING: 'Pendiente'
  };
  return labels[status] ?? clean(status);
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    ROUND_OF_16: 'Octavos', QUARTERFINAL: 'Cuartos', SEMIFINAL: 'Semifinales', FINAL: 'Final', GROUP_STAGE: 'Fase de zonas'
  };
  return labels[stage] ?? clean(stage);
}

function matchPair(match: Match, side: 'home' | 'away') {
  return clean(side === 'home' ? match.homePair?.displayName ?? match.homePlaceholder : match.awayPair?.displayName ?? match.awayPlaceholder);
}

function setScore(match: Match) {
  return match.sets.length
    ? match.sets.map(set => `${set.homeGames}–${set.awayGames}`).join(' · ')
    : statusLabel(match.status, match.official);
}

function venue(payload: InstagramLeaguePayload) {
  const name = clean(payload.league.court?.name, '');
  return name || null;
}

function zoneBy(payload: InstagramLeaguePayload, zoneId?: number) {
  const zone = zoneId ? payload.zones.find(item => item.id === zoneId) : payload.zones[0];
  if (!zone) throw new HttpError(400, 'La plantilla necesita una zona válida.');
  return zone;
}

function groupMatches(payload: InstagramLeaguePayload, zone: Zone, matchday: number) {
  const matches = payload.matches.filter(match => match.stage === 'GROUP_STAGE' && match.zone?.id === zone.id && match.matchday === matchday);
  if (!matches.length) throw new HttpError(409, `No hay partidos de la fecha ${matchday} para ${zone.name}.`);
  return matches;
}

function resolveMatchday(payload: InstagramLeaguePayload, zone: Zone, requested: number | undefined, purpose: 'upcoming' | 'results') {
  if (requested) return requested;
  const zoneMatches = payload.matches.filter(match => match.stage === 'GROUP_STAGE' && match.zone?.id === zone.id && match.matchday);
  const preferred = purpose === 'upcoming'
    ? zoneMatches.filter(match => !match.official && ['SCHEDULED', 'LIVE', 'RESCHEDULED', 'PENDING'].includes(match.status))
    : zoneMatches.filter(match => match.status === 'FINISHED' || match.official);
  const rounds = [...new Set((preferred.length ? preferred : zoneMatches).map(match => match.matchday!))].sort((a, b) => a - b);
  const value = purpose === 'results' ? rounds.at(-1) : rounds[0];
  if (!value) throw new HttpError(409, `No hay fechas disponibles para ${zone.name}.`);
  return value;
}

function matchdayDate(matches: Match[]) {
  return matches.find(match => match.scheduledDate)?.scheduledDate ?? null;
}

function resolveScheduledDate(payload: InstagramLeaguePayload, requested?: string) {
  const dates = [...new Set(payload.matches.map(match => match.scheduledDate).filter((date): date is string => Boolean(date)))].sort();
  if (requested) {
    if (!dates.includes(requested)) throw new HttpError(409, `No hay partidos programados para el ${formatDate(requested)}.`);
    return requested;
  }
  if (!dates.length) throw new HttpError(409, 'No hay partidos con día programado para preparar “Hoy juegan”.');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: payload.league.timezone ?? 'America/Argentina/Cordoba', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  return dates.find(date => date >= today) ?? dates.at(-1)!;
}

function matchesScheduledFor(payload: InstagramLeaguePayload, scheduledDate: string) {
  const matches = payload.matches
    .filter(match => match.scheduledDate === scheduledDate && match.status !== 'SUSPENDED')
    .sort((a, b) => `${a.scheduledTime ?? '99:99'}-${a.code}`.localeCompare(`${b.scheduledTime ?? '99:99'}-${b.code}`));
  if (!matches.length) throw new HttpError(409, `No hay partidos programados para el ${formatDate(scheduledDate)}.`);
  return matches;
}

function resolveResultsDate(payload: InstagramLeaguePayload, requested?: string) {
  const matchesWithResults = payload.matches.filter(match => match.status === 'FINISHED' && Boolean(match.result));
  const dates = [...new Set(matchesWithResults.map(match => match.scheduledDate).filter((date): date is string => Boolean(date)))].sort();
  if (requested) {
    if (!dates.includes(requested)) throw new HttpError(409, `No hay resultados cargados para el ${formatDate(requested)}.`);
    return requested;
  }
  if (!dates.length) throw new HttpError(409, 'No hay partidos finalizados con resultado para preparar “Resultados de hoy”.');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: payload.league.timezone ?? 'America/Argentina/Cordoba', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  return [...dates].reverse().find(date => date <= today) ?? dates.at(-1)!;
}

function resultsForScheduledDate(payload: InstagramLeaguePayload, scheduledDate: string) {
  const matches = payload.matches
    .filter(match => match.scheduledDate === scheduledDate && match.status === 'FINISHED' && Boolean(match.result))
    .sort((a, b) => `${a.scheduledTime ?? '99:99'}-${a.code}`.localeCompare(`${b.scheduledTime ?? '99:99'}-${b.code}`));
  if (!matches.length) throw new HttpError(409, `No hay resultados cargados para el ${formatDate(scheduledDate)}.`);
  return matches;
}

function longTextWarnings(values: string[], context: string, limit = 38) {
  const warnings: string[] = [];
  if (values.some(value => clean(value).length > limit)) warnings.push(`Se redujo la tipografía en ${context} para conservar nombres completos y legibles.`);
  if (values.some(value => clean(value).length > 72)) warnings.push(`Revisá ${context}: hay un nombre excepcionalmente largo próximo al límite de dos líneas.`);
  return warnings;
}

function pageWarnings(zone: Zone | null, matches: Match[] = [], standings: Standing[] = [], validateMatchdaySize = true) {
  const warnings: string[] = [];
  if (zone && zone.pairs.length !== 8) warnings.push(`${zone.name} tiene ${zone.pairs.length} parejas cargadas; el reglamento oficial prevé ocho.`);
  if (validateMatchdaySize && matches.length && matches.length !== 4 && matches.every(match => match.stage === 'GROUP_STAGE')) warnings.push(`La fecha contiene ${matches.length} partidos; el reglamento oficial prevé cuatro por zona.`);
  warnings.push(...longTextWarnings([
    ...(zone?.pairs.map(pair => pair.displayName) ?? []),
    ...matches.flatMap(match => [matchPair(match, 'home'), matchPair(match, 'away')]),
    ...standings.map(row => row.pair)
  ], 'la placa'));
  return [...new Set(warnings)];
}

function nameBlock(value: string, options: { width?: number | string; size?: number; minSize?: number; align?: 'left' | 'center' | 'right'; color?: string; weight?: number; maxLines?: number } = {}) {
  const text = clean(value);
  const size = text.length > 64 ? options.minSize ?? 22 : text.length > 44 ? Math.max(options.minSize ?? 22, (options.size ?? 34) - 8) : text.length > 30 ? (options.size ?? 34) - 4 : options.size ?? 34;
  return txt(text, {
    width: options.width ?? '100%',
    fontFamily: 'Manrope',
    fontSize: size,
    lineHeight: 1.12,
    fontWeight: options.weight ?? 800,
    color: options.color ?? COLORS.paper,
    textAlign: options.align ?? 'left',
    justifyContent: options.align === 'center' ? 'center' : options.align === 'right' ? 'flex-end' : 'flex-start',
    overflow: 'hidden',
    maxHeight: Math.round(size * 1.12 * (options.maxLines ?? 2))
  });
}

function brandFrame(format: InstagramFormat, assets: RenderAssets, options: { eyebrow: string; zone?: Zone | null; dark?: boolean }, body: VNode) {
  const { width, height } = dimensions(format);
  const background = options.dark === false ? COLORS.cream : COLORS.ink;
  const foreground = options.dark === false ? COLORS.ink : COLORS.paper;
  return div({
    width, height, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
    background, color: foreground, fontFamily: 'Manrope'
  },
  div({ position: 'absolute', width: 22, height: height - 120, left: 0, top: 60, background: COLORS.lime }),
  div({ position: 'absolute', width: 240, height: 240, border: `2px solid ${options.dark === false ? '#c9c6b9' : '#38503b'}`, right: -110, top: -90, transform: 'rotate(45deg)', opacity: .55 }),
  div({ position: 'absolute', top: 0, left: 0, width: '100%', height: 164, boxSizing: 'border-box', padding: '34px 64px 18px 76px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    div({ width: 710, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 25 },
      h('img', { src: assets.logo, style: { width: 180, height: 108, objectFit: 'contain' } }),
      div({ display: 'flex', flexDirection: 'column', gap: 5 },
        txt(clean(options.eyebrow).toUpperCase(), { fontSize: 20, fontWeight: 800, letterSpacing: 3.5, color: options.dark === false ? COLORS.green : COLORS.lime }),
        txt('LIGA SUMA 12', { fontFamily: 'Null Free', fontSize: 35, lineHeight: 1, color: foreground })
      )
    ),
    options.zone ? zonePill(options.zone) : txt(String(new Date().getFullYear()), { fontSize: 20, fontWeight: 800, color: options.dark === false ? COLORS.green : COLORS.muted })
  ),
  div({ position: 'absolute', top: 164, left: 0, display: 'flex', width: '100%', height: height - 248, boxSizing: 'border-box', padding: `24px 64px 26px 76px`, overflow: 'hidden' }, body),
  div({ position: 'absolute', left: 76, right: 64, bottom: 0, height: 84, boxSizing: 'border-box', background, borderTop: `2px solid ${options.dark === false ? '#d0ccbe' : COLORS.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    txt('LIGA SUMA 12', { fontSize: 17, fontWeight: 800, letterSpacing: 2.5, color: options.dark === false ? COLORS.green : COLORS.muted }),
    txt(SITE, { fontSize: 18, fontWeight: 800, color: options.dark === false ? COLORS.ink : COLORS.paper })
  ));
}

function zonePill(zone: Zone) {
  return div({ border: `2px solid ${COLORS.lime}`, borderRadius: 999, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 },
    div({ width: 10, height: 10, borderRadius: 999, background: COLORS.lime }),
    txt(clean(zone.name).toUpperCase(), { fontSize: 19, fontWeight: 800, letterSpacing: 1.8, color: COLORS.paper })
  );
}

function displayTitle(kicker: string, title: string, format: InstagramFormat, dark = true) {
  return div({ display: 'flex', flexDirection: 'column', gap: 14 },
    txt(clean(kicker).toUpperCase(), { fontSize: 21, fontWeight: 800, color: COLORS.lime, letterSpacing: 3 }),
    txt(clean(title), { fontFamily: 'Null Free', fontSize: format === 'story' ? 96 : 80, lineHeight: .92, color: dark ? COLORS.paper : COLORS.ink, maxWidth: 860 })
  );
}

function fixtureRows(matches: Match[], format: InstagramFormat, mode: 'fixture' | 'today' | 'results') {
  const rowHeight = Math.min(format === 'story' ? 236 : 176, Math.floor((format === 'story' ? 1100 : 710) / Math.max(matches.length, 1)));
  return div({ display: 'flex', flexDirection: 'column', gap: format === 'story' ? 20 : 14, width: '100%' },
    ...matches.map((match, index) => div({
      height: rowHeight, display: 'flex', alignItems: 'center', borderRadius: 20,
      background: index % 2 ? '#2b412e' : '#263b29', border: `1px solid ${COLORS.line}`, overflow: 'hidden'
    },
    div({ width: 126, height: '100%', background: index === 0 ? COLORS.lime : COLORS.green, color: index === 0 ? COLORS.ink : COLORS.paper, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 },
      txt(match.scheduledTime ?? 'A conf.', { fontSize: match.scheduledTime ? 31 : 20, fontWeight: 800 }),
      txt(mode === 'results'
        ? statusLabel(match.status, match.official).toUpperCase()
        : mode === 'today'
          ? `${match.zone?.name ?? stageLabel(match.stage)}${match.matchday ? ` · F${match.matchday}` : ''}`.toUpperCase()
          : `PARTIDO ${index + 1}`, { fontSize: mode === 'today' ? 10 : 12, fontWeight: 800, letterSpacing: mode === 'today' ? .5 : 1.2, textAlign: 'center', justifyContent: 'center', padding: '0 5px' })
    ),
    div({ flex: 1, padding: '16px 25px', display: 'flex', alignItems: 'center', gap: 18 },
      nameBlock(matchPair(match, 'home'), { width: '38%', size: format === 'story' ? 31 : 27, minSize: 20 }),
      div({ width: '22%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 },
        txt(mode === 'results' ? setScore(match) : 'VS', { fontSize: mode === 'results' ? 28 : 20, fontWeight: 800, color: mode === 'results' && match.sets.length ? COLORS.lime : COLORS.muted, textAlign: 'center', justifyContent: 'center' }),
        mode === 'results' && match.sets.length && !match.official ? txt('SIN CONFIRMAR', { fontSize: 10, fontWeight: 800, color: COLORS.olive, letterSpacing: 1, textAlign: 'center' }) : null
      ),
      nameBlock(matchPair(match, 'away'), { width: '38%', size: format === 'story' ? 31 : 27, minSize: 20, align: 'right' })
    ))));
}

function minimalFixtureRows(matches: Match[], format: InstagramFormat) {
  const rowHeight = Math.min(format === 'story' ? 270 : 185, Math.floor((format === 'story' ? 1120 : 740) / Math.max(matches.length, 1)));
  const contentWidth = format === 'story' ? 700 : 720;
  return div({ width: '100%', display: 'flex', justifyContent: 'center' },
    div({ width: contentWidth, display: 'flex', flexDirection: 'column' },
      ...matches.map((match, index) => div({
        width: '100%', height: rowHeight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      },
      div({ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: format === 'story' ? 14 : 9 },
        txt(match.scheduledTime ?? 'Horario a confirmar', {
          fontSize: match.scheduledTime ? (format === 'story' ? 32 : 27) : (format === 'story' ? 22 : 18),
          lineHeight: 1, fontWeight: 800, color: COLORS.lime, textAlign: 'center', justifyContent: 'center'
        }),
        nameBlock(matchPair(match, 'home'), { width: '100%', size: format === 'story' ? 35 : 29, minSize: format === 'story' ? 24 : 21, align: 'center', maxLines: 2 }),
        txt('VS', { fontSize: format === 'story' ? 18 : 15, lineHeight: 1, fontWeight: 800, color: COLORS.lime, letterSpacing: 1.5, textAlign: 'center', justifyContent: 'center' }),
        nameBlock(matchPair(match, 'away'), { width: '100%', size: format === 'story' ? 35 : 29, minSize: format === 'story' ? 24 : 21, align: 'center', maxLines: 2 })
      ),
      index < matches.length - 1 ? div({ width: format === 'story' ? 360 : 310, height: 1, flexShrink: 0, background: COLORS.olive, opacity: .72 }) : null
      ))
    )
  );
}

function minimalResultRows(matches: Match[], format: InstagramFormat) {
  const rowHeight = Math.min(format === 'story' ? 270 : 185, Math.floor((format === 'story' ? 1120 : 740) / Math.max(matches.length, 1)));
  const contentWidth = format === 'story' ? 700 : 720;
  return div({ width: '100%', display: 'flex', justifyContent: 'center' },
    div({ width: contentWidth, display: 'flex', flexDirection: 'column' },
      ...matches.map((match, index) => div({
        width: '100%', height: rowHeight, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      },
      div({ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: format === 'story' ? 14 : 9 },
        nameBlock(matchPair(match, 'home'), {
          width: '100%', size: format === 'story' ? 35 : 29, minSize: format === 'story' ? 24 : 21,
          align: 'center', maxLines: 2, weight: match.result?.winnerSide === 'HOME' ? 900 : 650,
          color: match.result?.winnerSide === 'HOME' ? COLORS.paper : COLORS.muted
        }),
        txt(setScore(match), {
          fontSize: format === 'story' ? 28 : 23, lineHeight: 1, fontWeight: 900, color: COLORS.lime,
          letterSpacing: 1.2, textAlign: 'center', justifyContent: 'center'
        }),
        nameBlock(matchPair(match, 'away'), {
          width: '100%', size: format === 'story' ? 35 : 29, minSize: format === 'story' ? 24 : 21,
          align: 'center', maxLines: 2, weight: match.result?.winnerSide === 'AWAY' ? 900 : 650,
          color: match.result?.winnerSide === 'AWAY' ? COLORS.paper : COLORS.muted
        })
      ),
      index < matches.length - 1 ? div({ width: format === 'story' ? 360 : 310, height: 1, flexShrink: 0, background: COLORS.olive, opacity: .72 }) : null
      ))
    )
  );
}

function coverScene(payload: InstagramLeaguePayload, format: InstagramFormat, assets: RenderAssets, kicker: string, title: string, subtitle: string, zone?: Zone | null) {
  return brandFrame(format, assets, { eyebrow: payload.league.name, zone }, div({ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', gap: 34 },
    displayTitle(kicker, title, format),
    div({ width: 180, height: 8, background: COLORS.lime }),
    txt(subtitle, { maxWidth: 780, fontSize: format === 'story' ? 38 : 32, lineHeight: 1.25, fontWeight: 650, color: COLORS.muted })
  ));
}

function zonesPage(payload: InstagramLeaguePayload, format: InstagramFormat, assets: RenderAssets, zone: Zone) {
  const rowHeight = format === 'story' ? 144 : 99;
  return brandFrame(format, assets, { eyebrow: 'Así quedaron las zonas', zone }, div({ width: '100%', display: 'flex', flexDirection: 'column', gap: 28 },
    div({ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' },
      displayTitle('Sorteo oficial', zone.name, format),
      txt(zone.regularDay ? `JUEGA LOS ${clean(zone.regularDay)}` : 'DÍA A CONFIRMAR', { fontSize: 18, fontWeight: 800, letterSpacing: 2, color: COLORS.lime, paddingBottom: 9 })
    ),
    div({ display: 'flex', flexDirection: 'column', width: '100%', borderTop: `2px solid ${COLORS.line}` },
      ...zone.pairs.map((pair, index) => div({ height: rowHeight, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${COLORS.line}` },
        div({ width: 92, display: 'flex', alignItems: 'center' },
          txt(String(index + 1).padStart(2, '0'), { width: 54, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', fontSize: 23, fontWeight: 900, color: index < 4 ? COLORS.ink : COLORS.paper, background: index < 4 ? COLORS.lime : COLORS.green })
        ),
        nameBlock(pair.displayName, { size: format === 'story' ? 38 : 31, minSize: 22 })
      ))
    )
  ));
}

function fixturePage(payload: InstagramLeaguePayload, format: InstagramFormat, assets: RenderAssets, zone: Zone | null, matchday: number | null, matches: Match[], today = false) {
  const date = matchdayDate(matches);
  return brandFrame(format, assets, { eyebrow: today ? 'Hoy juegan' : 'Próxima fecha', zone }, div({ width: '100%', display: 'flex', flexDirection: 'column', gap: format === 'story' ? 40 : 25 },
    div({ display: 'flex', flexDirection: today && format === 'story' ? 'column' : 'row', alignItems: today && format === 'story' ? 'stretch' : 'flex-end', justifyContent: 'space-between', gap: today && format === 'story' ? 14 : 20 },
      today
        ? div({ width: format === 'story' ? '100%' : 620, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 },
          txt('SEGUÍ LOS RESULTADOS', { fontSize: 21, fontWeight: 800, color: COLORS.lime, letterSpacing: 3 }),
          txt('Hoy juegan', { fontFamily: 'Null Free', fontSize: format === 'story' ? 82 : 80, lineHeight: .92, color: COLORS.paper, maxWidth: format === 'story' ? '100%' : 620, overflow: 'hidden' })
        )
        : displayTitle(`Fecha ${matchday}`, `Fecha ${matchday}`, format),
      div({ maxWidth: 260, flexShrink: 0, ...(today && format === 'story' ? { alignSelf: 'flex-end' } : {}), display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingBottom: 7, gap: 4 },
        txt(formatDate(date), { fontSize: 22, fontWeight: 800, color: COLORS.paper, textTransform: 'capitalize', textAlign: 'right' }),
        venue(payload) ? txt(venue(payload)!, { fontSize: 16, fontWeight: 700, color: COLORS.lime, textAlign: 'right' }) : null
      )
    ),
    minimalFixtureRows(matches, format),
    today ? txt(`Resultados y posiciones en ${SITE}`, { marginTop: 'auto', fontSize: 25, fontWeight: 800, color: COLORS.lime }) : null
  ));
}

function todayResultsPage(payload: InstagramLeaguePayload, format: InstagramFormat, assets: RenderAssets, zone: Zone | null, matches: Match[]) {
  const date = matchdayDate(matches);
  return brandFrame(format, assets, { eyebrow: 'Resultados de hoy', zone }, div({ width: '100%', display: 'flex', flexDirection: 'column', gap: format === 'story' ? 40 : 25 },
    div({ display: 'flex', flexDirection: format === 'story' ? 'column' : 'row', alignItems: format === 'story' ? 'stretch' : 'flex-end', justifyContent: 'space-between', gap: format === 'story' ? 14 : 20 },
      div({ width: format === 'story' ? '100%' : 700, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 },
        txt('MARCADORES FINALES', { fontSize: 21, fontWeight: 800, color: COLORS.lime, letterSpacing: 3 }),
        txt('Resultados de hoy', { fontFamily: 'Null Free', fontSize: format === 'story' ? 76 : 70, lineHeight: .92, color: COLORS.paper, maxWidth: '100%', overflow: 'hidden' })
      ),
      div({ maxWidth: 260, flexShrink: 0, ...(format === 'story' ? { alignSelf: 'flex-end' } : {}), display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingBottom: 7, gap: 4 },
        txt(formatDate(date), { fontSize: 22, fontWeight: 800, color: COLORS.paper, textTransform: 'capitalize', textAlign: 'right' }),
        venue(payload) ? txt(venue(payload)!, { fontSize: 16, fontWeight: 700, color: COLORS.lime, textAlign: 'right' }) : null
      )
    ),
    minimalResultRows(matches, format)
  ));
}

function resultsPage(payload: InstagramLeaguePayload, format: InstagramFormat, assets: RenderAssets, zone: Zone, matchday: number, matches: Match[]) {
  return brandFrame(format, assets, { eyebrow: 'Resultados de la fecha', zone }, div({ width: '100%', display: 'flex', flexDirection: 'column', gap: format === 'story' ? 38 : 24 },
    div({ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' },
      displayTitle(`Fecha ${matchday}`, 'Resultados', format),
      txt(formatDate(matchdayDate(matches)), { maxWidth: 260, fontSize: 21, fontWeight: 800, color: COLORS.muted, textAlign: 'right', textTransform: 'capitalize' })
    ),
    fixtureRows(matches, format, 'results')
  ));
}

function resultPage(payload: InstagramLeaguePayload, format: InstagramFormat, assets: RenderAssets, match: Match) {
  const zone = payload.zones.find(item => item.id === match.zone?.id) ?? null;
  const winner = match.result?.winnerSide === 'HOME' ? 'home' : 'away';
  const home = matchPair(match, 'home');
  const away = matchPair(match, 'away');
  const pairSize = format === 'story' ? 57 : 46;
  return brandFrame(format, assets, { eyebrow: `${zone?.name ?? stageLabel(match.stage)} · ${match.matchday ? `Fecha ${match.matchday}` : stageLabel(match.stage)}`, zone }, div({ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: format === 'story' ? 54 : 32 },
    div({ display: 'flex', justifyContent: 'center' },
      div({ padding: '11px 24px', borderRadius: 999, background: match.official ? COLORS.lime : COLORS.olive, color: COLORS.ink, display: 'flex' },
        txt(statusLabel(match.status, match.official).toUpperCase(), { fontSize: 18, fontWeight: 900, letterSpacing: 2 })
      )
    ),
    div({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: format === 'story' ? 32 : 20 },
      winner === 'home' ? txt('GANADORES', { fontSize: 17, fontWeight: 900, color: COLORS.lime, letterSpacing: 3 }) : null,
      nameBlock(home, { size: pairSize, minSize: 28, align: 'center', maxLines: 2 }),
      div({ width: 180, height: 2, background: COLORS.line }),
      txt(setScore(match), { fontFamily: 'Manrope', fontSize: format === 'story' ? 68 : 58, fontWeight: 900, color: COLORS.paper, textAlign: 'center', justifyContent: 'center' }),
      div({ width: 180, height: 2, background: COLORS.line }),
      nameBlock(away, { size: pairSize, minSize: 28, align: 'center', maxLines: 2 }),
      winner === 'away' ? txt('GANADORES', { fontSize: 17, fontWeight: 900, color: COLORS.lime, letterSpacing: 3 }) : null
    ),
    div({ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 },
      txt(formatDate(match.scheduledDate, true), { padding: '13px 18px', border: `1px solid ${COLORS.line}`, borderRadius: 10, fontSize: 18, fontWeight: 800 }),
      txt(match.scheduledTime ?? 'Hora a confirmar', { padding: '13px 18px', border: `1px solid ${COLORS.line}`, borderRadius: 10, fontSize: 18, fontWeight: 800 })
    )
  ));
}

function standingsPage(payload: InstagramLeaguePayload, format: InstagramFormat, assets: RenderAssets, zone: Zone, rows: Standing[]) {
  const rowHeight = Math.min(format === 'story' ? 132 : 91, Math.floor((format === 'story' ? 1130 : 730) / Math.max(rows.length, 1)));
  return brandFrame(format, assets, { eyebrow: 'Tabla de posiciones', zone }, div({ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 },
    displayTitle('Actualizada', 'Posiciones', format),
    div({ width: '100%', display: 'flex', flexDirection: 'column', borderTop: `2px solid ${COLORS.lime}` },
      div({ height: 50, display: 'flex', alignItems: 'center', color: COLORS.muted },
        txt('POS', { width: 72, fontSize: 14, fontWeight: 900 }), txt('PAREJA', { flex: 1, fontSize: 14, fontWeight: 900 }),
        ...['PJ', 'PG', 'PP', 'PTS'].map(label => txt(label, { width: label === 'PTS' ? 72 : 60, fontSize: 14, fontWeight: 900, justifyContent: 'center' }))
      ),
      ...rows.map((row, index) => div({ height: rowHeight, display: 'flex', alignItems: 'center', borderTop: `1px solid ${COLORS.line}`, background: index === 0 ? '#2b432e' : 'transparent' },
        div({ width: 72, display: 'flex', justifyContent: 'flex-start' }, txt(row.position, { width: 46, height: 46, borderRadius: 10, background: row.position === 1 ? COLORS.lime : COLORS.green, color: row.position === 1 ? COLORS.ink : COLORS.paper, fontFamily: 'Manrope', fontSize: 24, fontWeight: 900, alignItems: 'center', justifyContent: 'center' })),
        nameBlock(row.pair, { width: 'auto', size: format === 'story' ? 31 : 26, minSize: 19 }),
        div({ marginLeft: 'auto', display: 'flex' },
          txt(row.played, { width: 60, fontSize: 22, fontWeight: 700, justifyContent: 'center' }),
          txt(row.won, { width: 60, fontSize: 22, fontWeight: 700, justifyContent: 'center' }),
          txt(row.lost, { width: 60, fontSize: 22, fontWeight: 700, justifyContent: 'center' }),
          txt(row.points ?? '—', { width: 72, fontSize: 27, fontWeight: 900, color: COLORS.lime, justifyContent: 'center' })
        )
      ))
    )
  ));
}

function bracketPage(payload: InstagramLeaguePayload, format: InstagramFormat, assets: RenderAssets) {
  const stages = payload.bracket.filter(group => group.matches.length);
  return brandFrame(format, assets, { eyebrow: 'Cruces eliminatorios' }, div({ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 },
    displayTitle('Camino al título', 'Eliminatorias', format),
    div({ display: 'flex', flex: 1, alignItems: 'stretch', gap: 13, overflow: 'hidden' },
      ...stages.map((group, stageIndex) => div({ flex: 1, display: 'flex', flexDirection: 'column', gap: format === 'story' ? 10 : 6, justifyContent: 'center' },
        txt(stageLabel(group.stage).toUpperCase(), { height: format === 'story' ? 45 : 36, flexShrink: 0, borderBottom: `3px solid ${stageIndex === stages.length - 1 ? COLORS.lime : COLORS.green}`, fontSize: format === 'story' ? 17 : 15, fontWeight: 900, letterSpacing: 1.5, alignItems: 'center' }),
        ...group.matches.map(match => div({ height: format === 'story' ? 126 : 101, flexShrink: 0, padding: format === 'story' ? '9px 10px' : '5px 9px', borderRadius: 10, background: '#293f2c', border: `1px solid ${COLORS.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: format === 'story' ? 4 : 2, overflow: 'hidden' },
          txt(clean(match.code), { fontSize: format === 'story' ? 10 : 8, fontWeight: 900, color: COLORS.lime, letterSpacing: 1 }),
          txt(matchPair(match, 'home'), { fontSize: format === 'story' ? 16 : 13, lineHeight: 1.05, fontWeight: match.result?.winnerSide === 'HOME' ? 900 : 650, color: match.result?.winnerSide === 'HOME' ? COLORS.paper : COLORS.muted, maxHeight: format === 'story' ? 34 : 27, overflow: 'hidden' }),
          txt(match.sets.length ? setScore(match) : 'VS', { fontSize: format === 'story' ? 12 : 10, fontWeight: 900, color: COLORS.olive }),
          txt(matchPair(match, 'away'), { fontSize: format === 'story' ? 16 : 13, lineHeight: 1.05, fontWeight: match.result?.winnerSide === 'AWAY' ? 900 : 650, color: match.result?.winnerSide === 'AWAY' ? COLORS.paper : COLORS.muted, maxHeight: format === 'story' ? 34 : 27, overflow: 'hidden' }),
          txt(statusLabel(match.status, match.official).toUpperCase(), { fontSize: format === 'story' ? 9 : 8, fontWeight: 900, color: match.official ? COLORS.lime : COLORS.muted, letterSpacing: .8 })
        ))
      ))
    )
  ));
}

function championsPage(payload: InstagramLeaguePayload, format: InstagramFormat, assets: RenderAssets, final: Match) {
  const winner = final.result?.winnerSide === 'HOME' ? matchPair(final, 'home') : matchPair(final, 'away');
  return brandFrame(format, assets, { eyebrow: 'Liga Suma 12' }, div({ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: format === 'story' ? 48 : 30 },
    txt('CAMPEONES', { fontFamily: 'Null Free', fontSize: format === 'story' ? 122 : 103, lineHeight: .9, color: COLORS.lime, textAlign: 'center', justifyContent: 'center' }),
    div({ width: format === 'story' ? 760 : 700, height: format === 'story' ? 500 : 320, border: `2px solid ${COLORS.line}`, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c3220' },
      div({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13 },
        txt('FOTO DE CAMPEONES', { fontSize: 17, fontWeight: 900, color: COLORS.muted, letterSpacing: 2 }),
        txt('Espacio disponible cuando exista un asset real', { fontSize: 16, color: COLORS.line })
      )
    ),
    nameBlock(winner, { width: 840, size: format === 'story' ? 59 : 50, minSize: 30, align: 'center' }),
    txt(`FINAL · ${setScore(final)}`, { fontSize: 25, fontWeight: 900, color: COLORS.paper, letterSpacing: 1.4, textAlign: 'center', justifyContent: 'center' }),
    txt(`${formatDate(final.scheduledDate, true)} · ${final.scheduledTime ?? 'Horario a confirmar'}`, { fontSize: 19, fontWeight: 700, color: COLORS.muted })
  ));
}

function descriptionFor(payload: InstagramLeaguePayload, selection: InstagramSelection, zone: Zone | null, matchday: number | null, matches: Match[]) {
  const date = matchdayDate(matches);
  const place = venue(payload);
  const ending = `Toda la información de la Liga Suma 12 en ${SITE} #LoDelProfe #LigaSuma12`;
  if (selection.template === 'today') {
    return ['Hoy juegan por la Liga Suma 12.', date ? formatDate(date) : null, place, `Partidos, horarios y toda la información en ${SITE} #LoDelProfe #LigaSuma12`].filter(Boolean).join('\n');
  }
  if (selection.template === 'today_results') {
    return ['Resultados de hoy · Liga Suma 12.', date ? formatDate(date) : null, place, 'Estos fueron los marcadores de la jornada.', ending].filter(Boolean).join('\n');
  }
  if (['next_matchday', 'weekly_fixture'].includes(selection.template)) {
    return [`Liga Suma 12 · Fecha ${matchday ?? ''}`, zone ? `Estos son los partidos de la ${zone.name}.` : 'Estos son los partidos de la semana.', date ? formatDate(date) : null, place, `Seguí los resultados y posiciones en ${SITE} #LoDelProfe #LigaSuma12`].filter(Boolean).join('\n');
  }
  if (['matchday_results', 'results_standings'].includes(selection.template)) {
    return [`Finalizó la Fecha ${matchday ?? ''}${zone ? ` de la ${zone.name}` : ''}.`, 'Estos fueron los resultados y así quedó la tabla de posiciones.', ending].join('\n');
  }
  if (selection.template === 'standings') return [`Así está la tabla de posiciones${zone ? ` de la ${zone.name}` : ''}.`, ending].join('\n');
  if (selection.template === 'individual_result') return [`Resultado final · ${zone?.name ?? stageLabel(matches[0]?.stage ?? '')}`, matches[0] ? `${matchPair(matches[0], 'home')} ${setScore(matches[0])} ${matchPair(matches[0], 'away')}` : null, ending].filter(Boolean).join('\n');
  if (selection.template === 'champions') return [`Campeones de la Liga Suma 12.`, matches[0] ? `${matches[0].result?.winnerSide === 'HOME' ? matchPair(matches[0], 'home') : matchPair(matches[0], 'away')} se quedó con el título.` : null, ending].filter(Boolean).join('\n');
  if (selection.template === 'bracket') return ['Así continúan los cruces eliminatorios de la Liga Suma 12.', ending].join('\n');
  return ['Así quedaron las zonas de la Liga Suma 12.', ending].join('\n');
}

function manifestPage(index: number, id: string, label: string, fileName: string, warnings: string[], scene: InternalPage['scene']): InternalPage {
  return { index, id, label, fileName, warnings: [...new Set(warnings)], scene };
}

function individualName(payload: InstagramLeaguePayload, selection: InstagramSelection, zone: Zone | null, matchday: number | null, suffix: string) {
  const parts = [leagueSlug(payload), zone ? `zona-${slug(zone.code)}` : null, matchday ? `fecha-${matchday}` : null, suffix, selection.format].filter(Boolean);
  return `${parts.join('-')}.png`;
}

function buildPublication(payload: InstagramLeaguePayload, selection: InstagramSelection) {
  const pages: InternalPage[] = [];
  let selectedZone: Zone | null = null;
  let selectedMatchday: number | null = null;
  let selectedMatches: Match[] = [];
  const prefix = leagueSlug(payload);

  if (selection.template === 'zones') {
    pages.push(manifestPage(0, 'portada', 'Portada', '01-portada.png', [], assets => coverScene(payload, selection.format, assets, 'Sorteo oficial', 'Así quedaron las zonas', `${payload.zones.length} zonas · ${payload.zones.reduce((sum, zone) => sum + zone.pairs.length, 0)} parejas`)));
    payload.zones.forEach((zone, index) => pages.push(manifestPage(index + 1, `zona-${slug(zone.code)}`, zone.name, `${String(index + 2).padStart(2, '0')}-zona-${slug(zone.code)}.png`, pageWarnings(zone), assets => zonesPage(payload, selection.format, assets, zone))));
  }

  if (['next_matchday', 'matchday_results', 'standings', 'results_standings'].includes(selection.template)) {
    selectedZone = zoneBy(payload, selection.zoneId);
  }

  if (selection.template === 'next_matchday') {
    selectedMatchday = resolveMatchday(payload, selectedZone!, selection.matchday, 'upcoming');
    selectedMatches = groupMatches(payload, selectedZone!, selectedMatchday);
    const warnings = pageWarnings(selectedZone, selectedMatches);
    pages.push(manifestPage(0, selection.template, 'Próxima fecha', individualName(payload, selection, selectedZone, selectedMatchday, 'proxima'), warnings, assets => fixturePage(payload, selection.format, assets, selectedZone!, selectedMatchday!, selectedMatches)));
  }

  if (selection.template === 'today') {
    const scheduledDate = resolveScheduledDate(payload, selection.scheduledDate);
    selectedMatches = matchesScheduledFor(payload, scheduledDate);
    const zoneIds = [...new Set(selectedMatches.map(match => match.zone?.id).filter((id): id is number => Boolean(id)))];
    selectedZone = zoneIds.length === 1 ? payload.zones.find(zone => zone.id === zoneIds[0]) ?? null : null;
    const warnings = pageWarnings(selectedZone, selectedMatches, [], false);
    pages.push(manifestPage(0, 'today', 'Hoy juegan', `${prefix}-hoy-${scheduledDate}-${selection.format}.png`, warnings, assets => fixturePage(payload, selection.format, assets, selectedZone, null, selectedMatches, true)));
  }

  if (selection.template === 'today_results') {
    const scheduledDate = resolveResultsDate(payload, selection.scheduledDate);
    selectedMatches = resultsForScheduledDate(payload, scheduledDate);
    const zoneIds = [...new Set(selectedMatches.map(match => match.zone?.id).filter((id): id is number => Boolean(id)))];
    selectedZone = zoneIds.length === 1 ? payload.zones.find(zone => zone.id === zoneIds[0]) ?? null : null;
    const warnings = pageWarnings(selectedZone, selectedMatches, [], false);
    pages.push(manifestPage(0, 'today-results', 'Resultados de hoy', `${prefix}-resultados-hoy-${scheduledDate}-${selection.format}.png`, warnings, assets => todayResultsPage(payload, selection.format, assets, selectedZone, selectedMatches)));
  }

  if (selection.template === 'weekly_fixture') {
    const referenceZone = selection.zoneId ? zoneBy(payload, selection.zoneId) : payload.zones[0];
    selectedMatchday = resolveMatchday(payload, referenceZone, selection.matchday, 'upcoming');
    pages.push(manifestPage(0, 'portada', 'Portada', '01-portada.png', [], assets => coverScene(payload, selection.format, assets, `Fecha ${selectedMatchday}`, 'Esta semana', `${payload.zones.length} zonas · ${payload.zones.reduce((sum, zone) => sum + groupMatches(payload, zone, selectedMatchday!).length, 0)} partidos`)));
    payload.zones.forEach((zone, index) => {
      const matches = groupMatches(payload, zone, selectedMatchday!);
      pages.push(manifestPage(index + 1, `zona-${slug(zone.code)}`, zone.name, `${String(index + 2).padStart(2, '0')}-fecha-zona-${slug(zone.code)}.png`, pageWarnings(zone, matches), assets => fixturePage(payload, selection.format, assets, zone, selectedMatchday!, matches)));
    });
  }

  if (selection.template === 'individual_result') {
    const match = selection.matchId ? payload.matches.find(item => item.id === selection.matchId) : payload.matches.find(item => item.result);
    if (!match) throw new HttpError(409, 'No hay un partido con resultado disponible para esta placa.');
    if (!match.result) throw new HttpError(409, 'El partido todavía no tiene un resultado completo.');
    selectedMatches = [match];
    selectedZone = payload.zones.find(zone => zone.id === match.zone?.id) ?? null;
    selectedMatchday = match.matchday;
    const warnings = [...pageWarnings(selectedZone, [match]), ...(!match.official ? ['El resultado todavía no está confirmado; la placa lo identifica como borrador.'] : [])];
    pages.push(manifestPage(0, 'resultado', 'Resultado individual', individualName(payload, selection, selectedZone, selectedMatchday, 'resultado'), warnings, assets => resultPage(payload, selection.format, assets, match)));
  }

  if (selection.template === 'matchday_results' || selection.template === 'results_standings') {
    selectedMatchday = resolveMatchday(payload, selectedZone!, selection.matchday, 'results');
    selectedMatches = groupMatches(payload, selectedZone!, selectedMatchday);
    const table = payload.standings.find(item => item.zone.id === selectedZone!.id);
    if (selection.template === 'matchday_results') {
      pages.push(manifestPage(0, 'resultados', 'Resultados', individualName(payload, selection, selectedZone, selectedMatchday, 'resultados'), pageWarnings(selectedZone, selectedMatches), assets => resultsPage(payload, selection.format, assets, selectedZone!, selectedMatchday!, selectedMatches)));
    } else {
      if (!table) throw new HttpError(409, 'No hay tabla de posiciones disponible para la zona.');
      pages.push(manifestPage(0, 'portada', 'Portada', '01-portada.png', [], assets => coverScene(payload, selection.format, assets, `Fecha ${selectedMatchday}`, `${selectedZone!.name} · jornada completa`, 'Resultados y posiciones actualizadas', selectedZone)));
      pages.push(manifestPage(1, 'resultados', 'Resultados', '02-resultados.png', pageWarnings(selectedZone, selectedMatches), assets => resultsPage(payload, selection.format, assets, selectedZone!, selectedMatchday!, selectedMatches)));
      pages.push(manifestPage(2, 'posiciones', 'Posiciones', '03-posiciones.png', [...pageWarnings(selectedZone, [], table.rows), ...table.warnings], assets => standingsPage(payload, selection.format, assets, selectedZone!, table.rows)));
    }
  }

  if (selection.template === 'standings') {
    const table = payload.standings.find(item => item.zone.id === selectedZone!.id);
    if (!table) throw new HttpError(409, 'No hay tabla de posiciones disponible para la zona.');
    pages.push(manifestPage(0, 'posiciones', 'Posiciones', individualName(payload, selection, selectedZone, null, 'posiciones'), [...pageWarnings(selectedZone, [], table.rows), ...table.warnings], assets => standingsPage(payload, selection.format, assets, selectedZone!, table.rows)));
  }

  if (selection.template === 'bracket') {
    const matches = payload.bracket.flatMap(group => group.matches);
    if (!matches.length) throw new HttpError(409, 'La temporada todavía no tiene cruces eliminatorios configurados.');
    selectedMatches = matches;
    pages.push(manifestPage(0, 'eliminatorias', 'Cruces eliminatorios', `${prefix}-eliminatorias-${selection.format}.png`, longTextWarnings(matches.flatMap(match => [matchPair(match, 'home'), matchPair(match, 'away')]), 'el cuadro eliminatorio', 28), assets => bracketPage(payload, selection.format, assets)));
  }

  if (selection.template === 'champions') {
    const final = payload.matches.find(match => match.stage === 'FINAL' && match.status === 'FINISHED' && match.official && match.result);
    if (!final) throw new HttpError(409, 'La placa de campeones estará disponible cuando la final tenga un resultado oficial.');
    selectedMatches = [final];
    pages.push(manifestPage(0, 'campeones', 'Campeones', `${prefix}-campeones-${selection.format}.png`, pageWarnings(null, [final]), assets => championsPage(payload, selection.format, assets, final)));
  }

  if (!pages.length) throw new HttpError(400, 'Tipo de placa no soportado.');
  const zipFileName = pages.length > 1
    ? `${[prefix, selectedZone ? `zona-${slug(selectedZone.code)}` : null, selectedMatchday ? `fecha-${selectedMatchday}` : null, 'carrusel'].filter(Boolean).join('-')}.zip`
    : null;
  return {
    pages,
    manifest: {
      template: selection.template,
      format: selection.format,
      ...dimensions(selection.format),
      description: descriptionFor(payload, selection, selectedZone, selectedMatchday, selectedMatches),
      zipFileName,
      sourceUpdatedAt: String(payload.league.updatedAt),
      pages: pages.map(({ scene: _scene, ...page }) => page)
    } satisfies InstagramManifest
  };
}

export function getInstagramManifest(payload: InstagramLeaguePayload, selection: InstagramSelection) {
  return buildPublication(payload, selection).manifest;
}

export async function renderInstagramPng(payload: InstagramLeaguePayload, selection: InstagramSelection, pageIndex = 0) {
  const { pages, manifest } = buildPublication(payload, selection);
  const page = pages[pageIndex];
  if (!page) throw new HttpError(400, 'La página solicitada no existe en este carrusel.');
  const assets = await loadAssets();
  const svg = await satori(page.scene({ logo: assets.logo }) as never, {
    width: manifest.width,
    height: manifest.height,
    fonts: [
      { name: 'Null Free', data: assets.nullFree, weight: 400, style: 'normal' },
      { name: 'Manrope', data: assets.manropeRegular, weight: 400, style: 'normal' },
      { name: 'Manrope', data: assets.manropeBold, weight: 600, style: 'normal' },
      { name: 'Manrope', data: assets.manropeBold, weight: 700, style: 'normal' },
      { name: 'Manrope', data: assets.manropeExtraBold, weight: 800, style: 'normal' },
      { name: 'Manrope', data: assets.manropeExtraBold, weight: 900, style: 'normal' }
    ]
  });
  const png = new Resvg(svg, { background: COLORS.ink, fitTo: { mode: 'original' } }).render().asPng();
  return { buffer: Buffer.from(png), page: manifest.pages[pageIndex], manifest };
}

export async function renderInstagramZip(payload: InstagramLeaguePayload, selection: InstagramSelection) {
  const { manifest } = buildPublication(payload, selection);
  if (!manifest.zipFileName) throw new HttpError(400, 'La plantilla seleccionada no es un carrusel.');
  const zip = new JSZip();
  for (const page of manifest.pages) {
    const rendered = await renderInstagramPng(payload, selection, page.index);
    zip.file(page.fileName, rendered.buffer);
  }
  return {
    buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }),
    fileName: manifest.zipFileName,
    manifest
  };
}
