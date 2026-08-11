import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const baseUrl = process.env.RESPONSIVE_BASE_URL ?? 'http://localhost:4200';
const browserPath = process.env.RESPONSIVE_BROWSER_PATH
  ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outputDir = resolve(process.env.RESPONSIVE_OUTPUT_DIR ?? 'responsive-results');
const widths = [320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1440];
const screenshotWidths = new Set([390, 768, 1440]);
const publicRoutes = ['/', '/ingresar', '/registro', '/recuperar-contrasena', '/reservar'];
const authenticatedRoutes = ['/validar-telefono', '/confirmar-reserva', '/mis-turnos', '/historial'];
const adminRoutes = [
  '/admin',
  '/admin/agenda-diaria',
  '/admin/agenda-semanal',
  '/admin/turno',
  '/admin/precios',
  '/admin/horarios',
  '/admin/politicas',
  '/admin/turnos-fijos',
  '/admin/clientes',
  '/admin/seguridad',
  '/admin/caja',
  '/admin/estadisticas',
  '/admin/marketing/historias-instagram'
];

class CdpClient {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolveOpen, rejectOpen) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', rejectOpen, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const key = `${message.sessionId ?? ''}:${message.method}`;
      const handlers = this.events.get(key) ?? [];
      handlers.splice(0).forEach(handler => handler(message.params));
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolveRequest, rejectRequest) => {
      this.pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
    });
  }

  once(method, sessionId) {
    const key = `${sessionId ?? ''}:${method}`;
    return new Promise(resolveEvent => {
      const handlers = this.events.get(key) ?? [];
      handlers.push(resolveEvent);
      this.events.set(key, handlers);
    });
  }

  close() {
    this.socket.close();
  }
}

const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));

async function waitForDebugger(port) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // Browser startup is still in progress.
    }
    await delay(150);
  }
  throw new Error('El navegador headless no inició el puerto de depuración.');
}

async function evaluate(client, sessionId, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  }, sessionId);
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result?.value;
}

async function navigate(client, sessionId, url) {
  const loaded = client.once('Page.loadEventFired', sessionId);
  await client.send('Page.navigate', { url }, sessionId);
  await Promise.race([loaded, delay(15_000)]);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const ready = await evaluate(client, sessionId, `
      document.readyState === 'complete'
      && Boolean(document.querySelector('app-root'))
      && !document.querySelector('vite-error-overlay')
    `);
    if (ready) {
      await evaluate(client, sessionId, 'scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0;');
      await waitForUiSettled(client, sessionId);
      await evaluate(client, sessionId, 'scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0;');
      return;
    }
    await delay(100);
  }
  throw new Error(`La aplicación no terminó de renderizar ${url}.`);
}

async function waitForUiSettled(client, sessionId) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const loading = await evaluate(client, sessionId, `(() => {
      const pattern = /^(Cargando|Buscando|Calculando|Actualizando)/i;
      return [...document.querySelectorAll('.empty, button, [aria-busy="true"]')]
        .some(element => pattern.test((element.textContent ?? '').trim()));
    })()`);
    if (!loading) break;
    await delay(100);
  }
  await delay(100);
}

async function setViewport(client, sessionId, width) {
  const height = width <= 430 ? 844 : width <= 768 ? 1024 : 900;
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile: width <= 768,
    scale: 1
  }, sessionId);
  return height;
}

async function inspectLayout(client, sessionId) {
  return evaluate(client, sessionId, `(() => {
    const viewport = document.documentElement.clientWidth;
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const offenders = [...document.querySelectorAll('body *')]
      .filter(visible)
      .map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left < -1 || rect.right > viewport + 1)
      .slice(0, 20)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
        text: (element.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 100),
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10
      }));
    return {
      viewport,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflow: document.documentElement.scrollWidth > viewport + 1,
      offenders,
      title: document.title,
      url: location.pathname + location.search
    };
  })()`);
}

async function clickFirst(client, sessionId, selector) {
  return evaluate(client, sessionId, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLElement)) return false;
    element.click();
    return true;
  })()`);
}

async function captureInteraction(client, sessionId, report, details) {
  await delay(120);
  report.push({ ...details, ...(await inspectLayout(client, sessionId)) });
  if (details.screenshot) await screenshot(client, sessionId, details.screenshot);
}

async function screenshot(client, sessionId, fileName) {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  }, sessionId);
  await writeFile(join(outputDir, fileName), Buffer.from(result.data, 'base64'));
}

function slug(route) {
  return route === '/' ? 'inicio' : route.replace(/^\//, '').replace(/[/?=&]+/g, '-');
}

async function loginAsAdmin(client, sessionId) {
  const phone = process.env.RESP_ADMIN_PHONE;
  const password = process.env.RESP_ADMIN_PASSWORD;
  if (!phone || !password) return false;
  return evaluate(client, sessionId, `(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(${JSON.stringify({ phone: process.env.RESP_ADMIN_PHONE, password: process.env.RESP_ADMIN_PASSWORD })})
    });
    if (!response.ok) return false;
    const data = await response.json();
    localStorage.setItem('user', JSON.stringify(data.user));
    return true;
  })()`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(join(tmpdir(), 'lo-del-profe-responsive-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ], { stdio: 'ignore', windowsHide: true });

  let client;
  try {
    const version = await waitForDebugger(port);
    client = new CdpClient(version.webSocketDebuggerUrl);
    await client.connect();
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
    await client.send('Page.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);

    const report = [];
    for (const width of widths) {
      await setViewport(client, sessionId, width);
      for (const route of publicRoutes) {
        await navigate(client, sessionId, `${baseUrl}${route}`);
        const result = await inspectLayout(client, sessionId);
        report.push({ route, width, state: 'public', ...result });
        if (screenshotWidths.has(width)) await screenshot(client, sessionId, `${slug(route)}-${width}.png`);
      }
    }

    await setViewport(client, sessionId, 390);
    await navigate(client, sessionId, `${baseUrl}/`);
    const menuOpened = await clickFirst(client, sessionId, '.mobile-menu-toggle');
    if (menuOpened) {
      await captureInteraction(client, sessionId, report, { route: '/', width: 390, state: 'menu-open', screenshot: 'inicio-menu-abierto-390.png' });
    }

    await navigate(client, sessionId, `${baseUrl}/registro`);
    const validationOpened = await evaluate(client, sessionId, `(() => {
      const form = document.querySelector('form');
      if (!(form instanceof HTMLFormElement)) return false;
      form.requestSubmit();
      return true;
    })()`);
    if (validationOpened) {
      await captureInteraction(client, sessionId, report, { route: '/registro', width: 390, state: 'long-validation-messages', screenshot: 'registro-validaciones-390.png' });
    }

    await navigate(client, sessionId, `${baseUrl}/reservar`);
    const guestModalOpened = await clickFirst(client, sessionId, '.start-time-grid button');
    if (guestModalOpened) {
      await captureInteraction(client, sessionId, report, { route: '/reservar', width: 390, state: 'guest-modal-open', screenshot: 'reservar-modal-390.png' });
    }

    const adminAuthenticated = await loginAsAdmin(client, sessionId);
    if (adminAuthenticated) {
      for (const width of widths) {
        await setViewport(client, sessionId, width);
        for (const route of [...authenticatedRoutes, ...adminRoutes]) {
          await navigate(client, sessionId, `${baseUrl}${route}`);
          const result = await inspectLayout(client, sessionId);
          report.push({ route, width, state: route.startsWith('/admin') ? 'admin' : 'authenticated', ...result });
          if (screenshotWidths.has(width)) await screenshot(client, sessionId, `${slug(route)}-${width}.png`);
        }
      }

      await setViewport(client, sessionId, 390);
      await navigate(client, sessionId, `${baseUrl}/admin`);
      const authenticatedMenuOpened = await clickFirst(client, sessionId, '.mobile-menu-toggle');
      if (authenticatedMenuOpened) {
        await captureInteraction(client, sessionId, report, { route: '/admin', width: 390, state: 'authenticated-menu-open', screenshot: 'admin-menu-principal-abierto-390.png' });
      }

      await navigate(client, sessionId, `${baseUrl}/admin/agenda-diaria`);
      const adminMenuOpened = await clickFirst(client, sessionId, '.admin-navigation-toggle');
      if (adminMenuOpened) {
        await captureInteraction(client, sessionId, report, { route: '/admin/agenda-diaria', width: 390, state: 'admin-menu-open', screenshot: 'admin-menu-abierto-390.png' });
      }

      await navigate(client, sessionId, `${baseUrl}/admin/seguridad`);
      const verificationModalOpened = await clickFirst(client, sessionId, '.request-card .pay-action');
      if (verificationModalOpened) {
        await captureInteraction(client, sessionId, report, { route: '/admin/seguridad', width: 390, state: 'verification-modal-open', screenshot: 'admin-seguridad-modal-390.png' });
      }

      await navigate(client, sessionId, `${baseUrl}/admin/clientes`);
      const longContentInjected = await evaluate(client, sessionId, `(() => {
        const title = document.querySelector('.client-title-row h2');
        const copy = document.querySelector('.client-main p');
        const action = document.querySelector('.client-actions .small-action');
        if (!(title instanceof HTMLElement) || !(copy instanceof HTMLElement) || !(action instanceof HTMLElement)) return false;
        title.textContent = 'Valentino Baltasar de la Concepción Rodríguez Extraordinariamente Largo';
        copy.textContent = '+549351555123456789 · Alta 11/08/2026 · texto administrativo largo de verificación';
        action.textContent = 'Comprobar identidad y documentación';
        return true;
      })()`);
      if (longContentInjected) {
        await captureInteraction(client, sessionId, report, { route: '/admin/clientes', width: 390, state: 'long-content', screenshot: 'admin-clientes-texto-largo-390.png' });
      }
    }

    const failures = report.filter(item => item.overflow || item.innerWidth !== item.width);
    await writeFile(join(outputDir, 'responsive-report.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      baseUrl,
      adminAuthenticated,
      widths,
      totalChecks: report.length,
      failures,
      checks: report
    }, null, 2));

    console.log(JSON.stringify({ totalChecks: report.length, failures: failures.length, adminAuthenticated }));
    if (failures.length) process.exitCode = 1;
  } finally {
    client?.close();
    if (browser.exitCode === null) {
      const exited = new Promise(resolveExit => browser.once('exit', resolveExit));
      browser.kill();
      await Promise.race([exited, delay(3_000)]);
    }
    try {
      await rm(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    } catch (error) {
      console.warn(`No se pudo limpiar el perfil temporal del navegador: ${error instanceof Error ? error.message : error}`);
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
