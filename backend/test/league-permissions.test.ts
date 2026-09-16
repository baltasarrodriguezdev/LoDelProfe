import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';

let server: ReturnType<typeof app.listen>;
let baseUrl = '';

before(async () => new Promise<void>(resolve => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de test');
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  });
}));
after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test('un usuario común no puede modificar ni consultar la administración de la liga', async () => {
  const token = jwt.sign({ userId: 99, role: 'CLIENT' }, config.jwtSecret);
  const response = await fetch(`${baseUrl}/api/admin/leagues`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 403);
  assert.match((await response.json() as { message: string }).message, /permisos/i);
});

test('las operaciones de carga rápida requieren permisos de administración', async () => {
  const token = jwt.sign({ userId: 99, role: 'CLIENT' }, config.jwtSecret);
  const cases = [
    ['POST', '/api/admin/leagues/1/matches/2/schedule', { date: '2026-09-16', startTime: '20:00', durationMinutes: 60, responsiblePairId: 1 }],
    ['POST', '/api/admin/leagues/1/matches/2/link-booking', { bookingId: 5 }],
    ['PUT', '/api/admin/leagues/1/matches/2/result', { sets: [{ homeGames: 6, awayGames: 4 }, { homeGames: 6, awayGames: 2 }], confirm: true }]
  ] as const;
  for (const [method, url, body] of cases) {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 403, `${method} ${url}`);
  }
});
