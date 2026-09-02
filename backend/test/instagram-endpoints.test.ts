import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import JSZip from 'jszip';
import { app } from '../src/app.js';
import { config } from '../src/config.js';

let server: ReturnType<typeof app.listen>;
let baseUrl = '';
const adminToken = jwt.sign({ userId: 1, role: 'ADMIN' }, config.jwtSecret);
const clientToken = jwt.sign({ userId: 99, role: 'CLIENT' }, config.jwtSecret);

before(async () => new Promise<void>(resolve => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de test');
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  });
}));
after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

async function activeLeagueId() {
  const response = await fetch(`${baseUrl}/api/league/active`);
  assert.equal(response.status, 200);
  return Number(((await response.json()) as { league: { id: number } }).league.id);
}

test('los endpoints de contenido rechazan sesiones no administradoras', async () => {
  const leagueId = await activeLeagueId();
  const path = `/api/admin/leagues/${leagueId}/instagram/manifest?template=zones&format=feed`;
  assert.equal((await fetch(baseUrl + path)).status, 401);
  assert.equal((await fetch(baseUrl + path, { headers: { authorization: `Bearer ${clientToken}` } })).status, 403);
});

test('el endpoint entrega manifiesto y PNG real sin caché para un administrador', { timeout: 45_000 }, async () => {
  const leagueId = await activeLeagueId();
  const headers = { authorization: `Bearer ${adminToken}` };
  const query = 'template=zones&format=feed';
  const manifestResponse = await fetch(`${baseUrl}/api/admin/leagues/${leagueId}/instagram/manifest?${query}`, { headers });
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get('cache-control') ?? '', /no-store/);
  const manifest = await manifestResponse.json() as { pages: unknown[]; width: number; height: number };
  assert.equal(manifest.pages.length, 3);
  const pngResponse = await fetch(`${baseUrl}/api/admin/leagues/${leagueId}/instagram/render?${query}&page=0`, { headers });
  assert.equal(pngResponse.status, 200);
  assert.equal(pngResponse.headers.get('content-type'), 'image/png');
  const png = Buffer.from(await pngResponse.arrayBuffer());
  assert.deepEqual({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }, { width: 1080, height: 1350 });
});

test('el endpoint ZIP conserva los prefijos de orden del carrusel', { timeout: 60_000 }, async () => {
  const leagueId = await activeLeagueId();
  const response = await fetch(`${baseUrl}/api/admin/leagues/${leagueId}/instagram/carousel.zip?template=zones&format=feed`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/zip');
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files), ['01-portada.png', '02-zona-a.png', '03-zona-b.png']);
});
