import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { publishRealtimeEvent, subscribeRealtimeEvents } from '../src/realtime/events.js';

test('removed realtime endpoint does not advertise an upgrade', async () => {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal(server.listenerCount('upgrade'), 0);
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/api/realtime`);
    assert.equal(response.status, 404); assert.equal(response.headers.get('upgrade'), null);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('business events execute locally with an unavailable Redis URL', async () => {
  const previous = config.realtime.redisUrl; config.realtime.redisUrl = 'redis://127.0.0.1:1';
  const received: unknown[] = []; const unsubscribe = subscribeRealtimeEvents(event => received.push(event));
  try {
    const event = await publishRealtimeEvent({ audience: 'ADMIN', type: 'CASH_MOVEMENT_CREATED', resource: { resource: 'CASH' } });
    assert.deepEqual(received, [event]);
  } finally { unsubscribe(); config.realtime.redisUrl = previous; }
});
