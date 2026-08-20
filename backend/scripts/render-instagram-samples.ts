import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderInstagramPng, type InstagramSelection } from '../src/services/instagram-content.service.js';
import { instagramTestPayload } from '../test/fixtures/instagram-payload.js';

const output = resolve(process.argv[2] ?? '../instagram-validation/plates');
const payload = instagramTestPayload();
const selections: Omit<InstagramSelection, 'format'>[] = [
  { template: 'zones' },
  { template: 'next_matchday', zoneId: 1, matchday: 1 },
  { template: 'weekly_fixture', matchday: 1 },
  { template: 'today', zoneId: 2, matchday: 1 },
  { template: 'today_results', scheduledDate: '2026-08-17' },
  { template: 'individual_result', matchId: 1 },
  { template: 'matchday_results', zoneId: 1, matchday: 1 },
  { template: 'standings', zoneId: 1 },
  { template: 'results_standings', zoneId: 1, matchday: 1 },
  { template: 'bracket' },
  { template: 'champions' }
];
async function main() {
  const report: Array<{ template: string; format: string; page: string; file: string; width: number; height: number; bytes: number }> = [];
  for (const format of ['feed', 'story'] as const) {
    const directory = resolve(output, format);
    await mkdir(directory, { recursive: true });
    for (const selection of selections) {
      const request = { ...selection, format } as InstagramSelection;
      const first = await renderInstagramPng(payload, request, 0);
      for (const page of first.manifest.pages) {
        const rendered = page.index === 0 ? first : await renderInstagramPng(payload, request, page.index);
        const file = `${selection.template}-${page.id}.png`;
        await writeFile(resolve(directory, file), rendered.buffer);
        report.push({ template: selection.template, format, page: page.id, file: `${format}/${file}`, width: rendered.manifest.width, height: rendered.manifest.height, bytes: rendered.buffer.length });
      }
    }
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), pages: report }, null, 2));
  console.log(JSON.stringify({ output, pages: report.length }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
