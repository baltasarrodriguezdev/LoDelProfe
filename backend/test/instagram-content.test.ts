import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  getInstagramManifest,
  renderInstagramPng,
  renderInstagramZip,
  type InstagramSelection
} from '../src/services/instagram-content.service.js';
import { instagramTestPayload } from './fixtures/instagram-payload.js';

const payload = instagramTestPayload();
const selections: Omit<InstagramSelection, 'format'>[] = [
  { template: 'zones' },
  { template: 'next_matchday', zoneId: 1, matchday: 1 },
  { template: 'weekly_fixture', matchday: 1 },
  { template: 'today', zoneId: 2, matchday: 1 },
  { template: 'individual_result', matchId: 1 },
  { template: 'matchday_results', zoneId: 1, matchday: 1 },
  { template: 'standings', zoneId: 1 },
  { template: 'results_standings', zoneId: 1, matchday: 1 },
  { template: 'bracket' },
  { template: 'champions' }
];

function pngDimensions(buffer: Buffer) {
  assert.deepEqual([...buffer.subarray(1, 4)], [80, 78, 71]);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('renderiza todas las plantillas y páginas en Feed e Historia con dimensiones exactas', { timeout: 120_000 }, async () => {
  for (const format of ['feed', 'story'] as const) {
    for (const selection of selections) {
      const request = { ...selection, format } as InstagramSelection;
      const manifest = getInstagramManifest(payload, request);
      assert.equal(manifest.width, 1080);
      assert.equal(manifest.height, format === 'feed' ? 1350 : 1920);
      assert.ok(manifest.description.includes('Liga Suma 12'));
      for (const page of manifest.pages) {
        const rendered = await renderInstagramPng(payload, request, page.index);
        assert.deepEqual(pngDimensions(rendered.buffer), { width: manifest.width, height: manifest.height });
        assert.ok(rendered.buffer.length > 20_000, `${selection.template}/${format}/${page.id} produjo un PNG sospechosamente pequeño`);
      }
    }
  }
});

test('advierte y ajusta nombres considerablemente largos sin aceptar texto de diseño separado', () => {
  const manifest = getInstagramManifest(payload, { template: 'standings', format: 'feed', zoneId: 1 });
  assert.match(manifest.pages[0].warnings.join(' '), /tipografía/i);
  assert.equal(manifest.pages[0].fileName, 'liga-suma12-zona-a-posiciones-feed.png');
});

test('genera el ZIP del carrusel en el orden publicado', async () => {
  const rendered = await renderInstagramZip(payload, { template: 'results_standings', format: 'feed', zoneId: 1, matchday: 1 });
  const zip = await JSZip.loadAsync(rendered.buffer);
  assert.deepEqual(Object.keys(zip.files), ['01-portada.png', '02-resultados.png', '03-posiciones.png']);
  assert.equal(rendered.fileName, 'liga-suma12-zona-a-fecha-1-carrusel.zip');
});

test('Hoy juegan filtra por día real y admite partidos de distintas zonas y fechas', async () => {
  const daily = instagramTestPayload();
  const first = daily.matches.find(match => match.id === 1)!;
  const second = daily.matches.find(match => match.id === 11)!;
  first.scheduledDate = '2026-08-19';
  second.scheduledDate = '2026-08-19';
  second.matchday = 2;

  const manifest = getInstagramManifest(daily, { template: 'today', format: 'story', scheduledDate: '2026-08-19' });

  assert.equal(manifest.pages[0].label, 'Hoy juegan');
  assert.equal(manifest.pages[0].fileName, 'liga-suma12-hoy-2026-08-19-story.png');
  assert.doesNotMatch(manifest.description, /Fecha 1/);
  assert.match(manifest.description, /miércoles 19 de agosto/i);
  assert.doesNotMatch(manifest.pages[0].warnings.join(' '), /prevé cuatro por zona/i);
  const rendered = await renderInstagramPng(daily, { template: 'today', format: 'story', scheduledDate: '2026-08-19' });
  assert.deepEqual(pngDimensions(rendered.buffer), { width: 1080, height: 1920 });
});

test('Hoy juegan rechaza un día sin partidos programados', () => {
  assert.throws(
    () => getInstagramManifest(payload, { template: 'today', format: 'story', scheduledDate: '2026-08-19' }),
    /No hay partidos programados/i
  );
});

test('bloquea campeones si la final todavía no es oficial', () => {
  const incomplete = instagramTestPayload();
  const final = incomplete.matches.find(match => match.stage === 'FINAL')!;
  final.official = false;
  assert.throws(() => getInstagramManifest(incomplete, { template: 'champions', format: 'feed' }), /final tenga un resultado oficial/i);
});
