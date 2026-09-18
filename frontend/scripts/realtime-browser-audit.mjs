import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseUrl = process.env.REALTIME_BASE_URL ?? 'http://localhost:4200';
const browserPath = process.env.RESPONSIVE_BROWSER_PATH
  ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const adminPhone = process.env.REALTIME_ADMIN_PHONE;
const adminPassword = process.env.REALTIME_ADMIN_PASSWORD;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

if (!adminPhone || !adminPassword) throw new Error('Definí REALTIME_ADMIN_PHONE y REALTIME_ADMIN_PASSWORD para ejecutar la auditoría.');

class CdpClient {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    this.socket = new WebSocket(url);
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      }
      const key = `${message.sessionId ?? ''}:${message.method}`;
      const handlers = this.events.get(key) ?? [];
      handlers.splice(0).forEach(handler => handler(message.params));
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  once(method, sessionId) {
    const key = `${sessionId ?? ''}:${method}`;
    return new Promise(resolve => {
      const handlers = this.events.get(key) ?? [];
      handlers.push(resolve);
      this.events.set(key, handlers);
    });
  }
  close() { this.socket.close(); }
}

async function waitForDebugger(port) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {}
    await delay(150);
  }
  throw new Error('El navegador no inició el puerto de depuración.');
}

async function evaluate(client, sessionId, expression) {
  const response = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result?.value;
}

async function navigate(client, sessionId, path) {
  const loaded = client.once('Page.loadEventFired', sessionId);
  await client.send('Page.navigate', { url: `${baseUrl}${path}` }, sessionId);
  await Promise.race([loaded, delay(15_000)]);
  await waitFor(client, sessionId, `document.readyState === 'complete' && Boolean(document.querySelector('app-root'))`, 10_000);
  await delay(300);
}

async function waitFor(client, sessionId, expression, timeout = 80_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(client, sessionId, expression)) return true;
    await delay(100);
  }
  return false;
}

async function page(client, browserContextId, path = '/') {
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
  await client.send('Page.enable', {}, sessionId);
  await client.send('Runtime.enable', {}, sessionId);
  await navigate(client, sessionId, path);
  return sessionId;
}

function apiCall(sessionId, client, path, method = 'GET', body) {
  return evaluate(client, sessionId, `(async () => {
    const csrf = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith('padel_csrf='))?.split('=').slice(1).join('=') ?? '';
    const response = await fetch(${JSON.stringify(`/api${path}`)}, {
      method: ${JSON.stringify(method)}, credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}) },
      ${body === undefined ? '' : `body: JSON.stringify(${JSON.stringify(body)}),`}
    });
    let data = null;
    try { data = await response.json(); } catch {}
    return { status: response.status, data };
  })()`);
}

async function register(client, sessionId, user) {
  const response = await apiCall(sessionId, client, '/auth/register', 'POST', user);
  if (response.status !== 201) throw new Error(`No se pudo registrar ${user.firstName}: ${response.status}`);
  await evaluate(client, sessionId, `localStorage.setItem('user', JSON.stringify(${JSON.stringify(response.data.user)}))`);
  await navigate(client, sessionId, '/reservar');
  return response.data.user;
}

async function loginAdmin(client, sessionId) {
  const response = await apiCall(sessionId, client, '/auth/login', 'POST', { phone: adminPhone, password: adminPassword });
  if (response.status !== 200) throw new Error(`No se pudo iniciar la sesión administrativa: ${response.status}`);
  await evaluate(client, sessionId, `localStorage.setItem('user', JSON.stringify(${JSON.stringify(response.data.user)}))`);
  await navigate(client, sessionId, '/admin/agenda-diaria');
}

async function setDate(client, sessionId, date) {
  return evaluate(client, sessionId, `(() => {
    const input = document.querySelector('input[type="date"]');
    if (!(input instanceof HTMLInputElement)) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(date)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function main() {
  const profile = await mkdtemp(join(tmpdir(), 'lo-del-profe-realtime-'));
  const port = 9700 + Math.floor(Math.random() * 200);
  const browser = spawn(browserPath, [
    '--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  let client;
  const contexts = [];
  const suffix = String(Date.now()).slice(-7);
  const numberA = `351${suffix}`;
  const numberB = `351${String((Number(suffix) + 1) % 10_000_000).padStart(7, '0')}`;
  const password = 'Realtime-2026!';
  let userA;
  let userB;
  let adminPage;

  try {
    const version = await waitForDebugger(port);
    client = new CdpClient(version.webSocketDebuggerUrl);
    await client.connect();
    for (let index = 0; index < 3; index++) {
      contexts.push((await client.send('Target.createBrowserContext')).browserContextId);
    }
    const userAPage = await page(client, contexts[0]);
    const userBPage = await page(client, contexts[1]);
    adminPage = await page(client, contexts[2]);
    userA = await register(client, userAPage, { firstName: 'RealtimeA', lastName: 'Prueba', phone: numberA, password });
    userB = await register(client, userBPage, { firstName: 'RealtimeB', lastName: 'Prueba', phone: numberB, password });
    await loginAdmin(client, adminPage);

    const selection = await evaluate(client, userBPage, `(async () => {
      const [courts, prices] = await Promise.all([fetch('/api/courts').then(r => r.json()), fetch('/api/prices').then(r => r.json())]);
      const courtId = Number(courts[0]?.id); const duration = Number(prices[0]?.durationMinutes);
      for (let offset = 1; offset <= 14; offset++) {
        const day = new Date(); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() + offset);
        const date = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
        const availability = await fetch('/api/availability?' + new URLSearchParams({ date, duration: String(duration), courtId: String(courtId) })).then(r => r.json());
        const slot = availability.slots?.find(item => item.available);
        if (slot) return { courtId, duration, date, slot };
      }
      return null;
    })()`);
    if (!selection) throw new Error('No se encontró un horario libre en los próximos 14 días.');

    await setDate(client, userAPage, selection.date);
    await setDate(client, userBPage, selection.date);
    const slotVisible = sessionId => waitFor(client, sessionId, `[...document.querySelectorAll('.start-time-grid button b')].some(node => node.textContent.trim() === ${JSON.stringify(selection.slot.startTime)})`);
    if (!await slotVisible(userAPage) || !await slotVisible(userBPage)) throw new Error('El horario inicial no apareció en ambos navegadores.');

    const myBookingsPage = await page(client, contexts[0], '/mis-turnos');
    await setDate(client, adminPage, selection.date);
    await delay(500);

    const created = await apiCall(userAPage, client, '/bookings', 'POST', {
      courtId: selection.courtId,
      date: selection.date,
      startTime: selection.slot.startTime,
      durationMinutes: selection.duration,
      playersCount: 4
    });
    if (created.status !== 201) throw new Error(`La reserva de prueba falló: ${created.status}`);
    const booking = created.data.reservation ?? created.data;

    const disappearedForB = await waitFor(client, userBPage, `![...document.querySelectorAll('.start-time-grid button b')].some(node => node.textContent.trim() === ${JSON.stringify(selection.slot.startTime)})`);
    const appearedInMine = await waitFor(client, myBookingsPage, `document.body.textContent.includes('RealtimeA') || [...document.querySelectorAll('.booking-card')].some(card => card.textContent.includes(${JSON.stringify(selection.slot.startTime)}))`);
    const appearedForAdmin = await waitFor(client, adminPage, `document.body.textContent.includes('RealtimeA Prueba')`);

    const cancelled = await apiCall(adminPage, client, `/admin/reservations/${booking.id}/cancel`, 'PATCH', { cancellationReason: 'Auditoría realtime' });
    if (cancelled.status !== 200) throw new Error(`La cancelación administrativa falló: ${cancelled.status}`);
    const returnedForB = await slotVisible(userBPage);
    const removedFromMine = await waitFor(client, myBookingsPage, `![...document.querySelectorAll('.booking-card')].some(card => card.textContent.includes(${JSON.stringify(selection.slot.startTime)}))`);

    const report = {
      selection,
      bookingId: booking.id,
      disappearedForB,
      appearedInMine,
      appearedForAdmin,
      returnedForB,
      removedFromMine
    };
    console.log(JSON.stringify(report));
    if (Object.values(report).some(value => value === false)) process.exitCode = 1;

  } finally {
    if (client && adminPage) {
      if (userA?.id) await apiCall(adminPage, client, `/admin/users/${userA.id}/pending-verification`, 'DELETE').catch(() => undefined);
      if (userB?.id) await apiCall(adminPage, client, `/admin/users/${userB.id}/pending-verification`, 'DELETE').catch(() => undefined);
    }
    client?.close();
    if (browser.exitCode === null) browser.kill();
    await delay(300);
    await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
