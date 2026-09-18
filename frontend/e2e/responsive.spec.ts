import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const screenshotRoot = resolve(process.env.RESPONSIVE_SCREENSHOT_DIR ?? 'responsive-audit-2026-08-16/final-playwright');

const viewports = [
  { name: 'mobile-320x568', width: 320, height: 568, mobile: true },
  { name: 'mobile-360x800', width: 360, height: 800, mobile: true },
  { name: 'mobile-375x812', width: 375, height: 812, mobile: true },
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
  { name: 'mobile-412x915', width: 412, height: 915, mobile: true },
  { name: 'mobile-landscape-844x390', width: 844, height: 390, mobile: true },
  { name: 'tablet-768x1024', width: 768, height: 1024, mobile: false },
  { name: 'tablet-820x1180', width: 820, height: 1180, mobile: false },
  { name: 'desktop-1280x720', width: 1280, height: 720, mobile: false },
  { name: 'desktop-1366x768', width: 1366, height: 768, mobile: false },
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false }
] as const;

const publicRoutes = [
  { path: '/', name: 'inicio' },
  { path: '/ingresar', name: 'ingresar' },
  { path: '/registro', name: 'registro' },
  { path: '/recuperar-contrasena', name: 'recuperar-contrasena' },
  { path: '/reservar', name: 'reservar' },
  { path: '/la-liga', name: 'la-liga' }
];

const authenticatedRoutes = [
  { path: '/validar-telefono', name: 'validar-telefono' },
  { path: '/confirmar-reserva', name: 'confirmar-reserva' },
  { path: '/mis-turnos', name: 'mis-turnos' },
  { path: '/historial', name: 'historial' }
];

const adminRoutes = [
  { path: '/admin', name: 'admin' },
  { path: '/admin/agenda-diaria', name: 'admin-agenda-diaria' },
  { path: '/admin/agenda-semanal', name: 'admin-agenda-semanal' },
  { path: '/admin/turno', name: 'admin-turno' },
  { path: '/admin/precios', name: 'admin-precios' },
  { path: '/admin/horarios', name: 'admin-horarios' },
  { path: '/admin/politicas', name: 'admin-politicas' },
  { path: '/admin/turnos-fijos', name: 'admin-turnos-fijos' },
  { path: '/admin/clientes', name: 'admin-clientes' },
  { path: '/admin/seguridad', name: 'admin-seguridad' },
  { path: '/admin/caja', name: 'admin-caja' },
  { path: '/admin/estadisticas', name: 'admin-estadisticas' },
  { path: '/admin/marketing/historias-instagram', name: 'admin-historias-instagram' },
  { path: '/admin/contenido-instagram', name: 'admin-contenido-instagram' },
  { path: '/admin/la-liga', name: 'admin-la-liga' }
];

type BrowserIssue = { kind: 'console' | 'request' | 'response'; detail: string };

function watchBrowserIssues(page: Page) {
  const issues: BrowserIssue[] = [];
  page.on('console', message => {
    if (message.type() === 'error') issues.push({ kind: 'console', detail: message.text() });
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith('http://localhost:4200')) {
      const failure = request.failure()?.errorText ?? 'falló';
      const isExpectedPreviewCancellation = failure === 'net::ERR_ABORTED'
        && request.url().includes('/api/admin/leagues/')
        && request.url().includes('/instagram/render');
      const isRetriedNavigationTransition = request.isNavigationRequest()
        && /net::ERR_NETWORK_(?:CHANGED|IO_SUSPENDED)/.test(failure);
      if (!isExpectedPreviewCancellation && !isRetriedNavigationTransition) {
        issues.push({ kind: 'request', detail: `${request.method()} ${request.url()} — ${failure}` });
      }
    }
  });
  page.on('response', response => {
    if (response.url().startsWith('http://localhost:4200/api/') && response.status() >= 400) {
      issues.push({ kind: 'response', detail: `${response.status()} ${response.url()}` });
    }
  });
  return issues;
}

async function settle(page: Page) {
  await page.locator('app-root').waitFor({ state: 'visible' });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())));
  });
}

async function assertNoGlobalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(sizes.html, `overflow horizontal global: ${JSON.stringify(sizes)}`).toBeLessThanOrEqual(sizes.viewport + 1);
  expect(sizes.body, `overflow horizontal en body: ${JSON.stringify(sizes)}`).toBeLessThanOrEqual(sizes.viewport + 1);
}

async function assertTouchTargets(page: Page) {
  const roleButton = ['[role', '="button"]'].join('');
  const selector = ['button:visible', 'input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):visible', 'select:visible', 'textarea:visible', `${roleButton}:visible`].join(', ');
  const tooSmall = await page.locator(selector).evaluateAll(elements => elements
    .map(element => {
      const rect = element.getBoundingClientRect();
      return { label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60) || element.tagName, width: Math.round(rect.width), height: Math.round(rect.height) };
    })
    .filter(item => item.width < 40 || item.height < 40));
  expect(tooSmall, `controles táctiles menores a 40 px: ${JSON.stringify(tooSmall)}`).toEqual([]);
}

async function capture(page: Page, viewportName: string, screenName: string) {
  await mkdir(screenshotRoot, { recursive: true });
  await page.screenshot({ path: resolve(screenshotRoot, `${screenName}-${viewportName}.png`), fullPage: true, animations: 'disabled' });
}

async function openRoute(page: Page, path: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      break;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const transient = /ERR_NETWORK_(?:CHANGED|IO_SUSPENDED)/.test(detail);
      if (!transient || attempt === 3) throw error;
      await page.waitForTimeout(250 * attempt);
    }
  }
  await settle(page);
  await assertNoGlobalOverflow(page);
}

async function loginAsConfiguredAdmin(page: Page) {
  const phone = process.env.RESP_ADMIN_PHONE;
  const password = process.env.RESP_ADMIN_PASSWORD;
  test.skip(!phone || !password, 'Las credenciales locales de auditoría no están configuradas.');
  const response = await page.request.post('/api/auth/login', { data: { phone, password } });
  expect(response.ok(), `login local falló con HTTP ${response.status()}`).toBeTruthy();
  const payload = await response.json();
  expect(['ADMIN', 'SUPERADMIN']).toContain(payload.user.role);
}

test.beforeAll(async () => mkdir(screenshotRoot, { recursive: true }));

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile });

    test('rutas públicas sin overflow y con captura completa', async ({ page }, testInfo: TestInfo) => {
      const issues = watchBrowserIssues(page);
      for (const route of publicRoutes) {
        await test.step(route.path, async () => {
          await openRoute(page, route.path);
          if (viewport.mobile) await assertTouchTargets(page);
          await capture(page, viewport.name, route.name);
        });
      }
      await testInfo.attach('browser-issues', { body: JSON.stringify(issues, null, 2), contentType: 'application/json' });
      expect(issues).toEqual([]);
    });

    test('todas las vistas de Liga conservan datos y overflow local', async ({ page }, testInfo: TestInfo) => {
      const issues = watchBrowserIssues(page);
      await openRoute(page, '/la-liga');
      for (const tab of ['Zonas', 'Partidos', 'Posiciones', 'Eliminatorias']) {
        const button = page.getByRole('button', { name: tab, exact: true });
        await expect(button).toBeVisible();
        await button.click();
        await settle(page);
        await assertNoGlobalOverflow(page);
        await capture(page, viewport.name, `la-liga-${tab.toLocaleLowerCase('es-AR')}`);
      }

      const bracket = page.locator('.league-bracket-scroll');
      const bracketOverflow = await bracket.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
      if (viewport.width < 1100) expect(bracketOverflow.scroll).toBeGreaterThan(bracketOverflow.client);

      await page.getByRole('button', { name: 'Posiciones', exact: true }).click();
      await settle(page);
      const payload = await (await page.request.get('/api/league/active')).json();
      for (const table of payload.standings) {
        for (const row of table.rows) expect(row.setDifference).toBe(row.setsFor - row.setsAgainst);
      }

      if (viewport.width <= 720) {
        const tables = page.locator('.league-table-scroll:visible');
        expect(await tables.count()).toBe(payload.standings.length);
        const first = tables.first();
        const visibleHeaders = await first.locator('thead th:visible').allTextContents();
        expect(visibleHeaders).toEqual(viewport.width <= 340
          ? ['POS', 'PAREJA', 'PJ', 'DS', 'PTS']
          : ['POS', 'PAREJA', 'PJ', 'SF', 'SC', 'DS', 'PTS']);
        const clippedCells = await first.locator('th:visible, td:visible').evaluateAll(elements => elements
          .filter(element => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
          .map(element => element.textContent?.trim()));
        expect(clippedCells, `celdas cortadas: ${JSON.stringify(clippedCells)}`).toEqual([]);
        expect(await first.locator('tbody tr').count()).toBe(payload.standings[0].rows.length);
        const compactOverflow = await first.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
        expect(compactOverflow.scroll).toBeLessThanOrEqual(compactOverflow.client + 1);
        if (['mobile-360x800', 'mobile-390x844'].includes(viewport.name)) {
          await page.locator('.league-standings-card').first().screenshot({
            path: resolve(screenshotRoot, `tabla-posiciones-${viewport.width}px.png`),
            animations: 'disabled'
          });
        }
        await page.getByRole('button', { name: 'Ver estadísticas', exact: true }).first().click();
        expect(await first.locator('thead th:visible').allTextContents()).toEqual(['POS', 'PAREJA', 'PJ', 'PG', 'PP', 'SF', 'SC', 'DS', 'GF', 'GC', 'DG', 'PTS']);
        const expandedOverflow = await first.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
        expect(expandedOverflow.scroll).toBeGreaterThan(expandedOverflow.client);
        await assertNoGlobalOverflow(page);
      } else {
        const table = page.locator('.league-table-scroll:visible').first();
        const headers = await table.locator('thead th').allTextContents();
        expect(headers).toEqual(['POS', 'PAREJA', 'PJ', 'PG', 'PP', 'SF', 'SC', 'DS', 'GF', 'GC', 'DG', 'PTS']);
        if (viewport.name === 'desktop-1366x768') {
          await page.locator('.league-standings-card').first().screenshot({
            path: resolve(screenshotRoot, 'tabla-posiciones-escritorio.png'),
            animations: 'disabled'
          });
        }
        if (viewport.width <= 1100) {
          const tableOverflow = await table.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
          expect(tableOverflow.scroll).toBeGreaterThan(tableOverflow.client);
          await table.evaluate(element => { element.scrollLeft = element.scrollWidth; });
          expect(await table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
        }
      }
      await testInfo.attach('browser-issues', { body: JSON.stringify(issues, null, 2), contentType: 'application/json' });
      expect(issues).toEqual([]);
    });

    test('rutas autenticadas y administrativas mantienen funciones', async ({ page }, testInfo: TestInfo) => {
      test.setTimeout(180_000);
      const issues = watchBrowserIssues(page);
      await loginAsConfiguredAdmin(page);
      for (const route of [...authenticatedRoutes, ...adminRoutes]) {
        await test.step(route.path, async () => {
          await openRoute(page, route.path);
          const actualPath = new URL(page.url()).pathname;
          if (route.path === '/validar-telefono') expect(['/validar-telefono', '/reservar']).toContain(actualPath);
          else expect(actualPath).toBe(route.path);
          if (viewport.mobile) await assertTouchTargets(page);
          await capture(page, viewport.name, route.name);
        });
      }
      await testInfo.attach('browser-issues', { body: JSON.stringify(issues, null, 2), contentType: 'application/json' });
      expect(issues).toEqual([]);
    });
  });
}

test.describe('interacciones responsive críticas', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('menús, modal de reserva y validaciones se abren y cierran', async ({ page }) => {
    await openRoute(page, '/');
    const menu = page.locator('.mobile-menu-toggle');
    await menu.click();
    await expect(page.locator('#primary-navigation')).toHaveClass(/open/);
    await assertNoGlobalOverflow(page);
    await menu.click();

    await openRoute(page, '/registro');
    await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator('.field-error').first()).toBeVisible();
    await capture(page, 'mobile-390x844', 'registro-validaciones');

    await openRoute(page, '/reservar');
    const firstSlot = page.locator('.start-time-grid button').first();
    if (await firstSlot.count()) {
      await firstSlot.click();
      await expect(page.locator('.modal-backdrop')).toBeVisible();
      await assertNoGlobalOverflow(page);
      await capture(page, 'mobile-390x844', 'reservar-modal');
      await page.locator('.modal-close').click();
      await expect(page.locator('.modal-backdrop')).toBeHidden();
    }
  });

  test('gestión de Liga permite recorrer resultados y posiciones sin mutar datos', async ({ page }) => {
    await loginAsConfiguredAdmin(page);
    await openRoute(page, '/admin/la-liga');
    await page.getByRole('button', { name: 'Resultados', exact: true }).click();
    await expect(page.locator('.league-results-layout')).toBeVisible();
    await assertNoGlobalOverflow(page);
    await capture(page, 'mobile-390x844', 'admin-la-liga-resultados');

    await page.getByRole('button', { name: 'Posiciones', exact: true }).click();
    const cards = page.locator('.league-admin-standing-cards article:visible');
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first()).toContainText('PG');
    await expect(cards.first()).toContainText('PP');
    await assertNoGlobalOverflow(page);
    await capture(page, 'mobile-390x844', 'admin-la-liga-posiciones');
  });
});

test.describe('estados difíciles de Liga', () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

  test('error de red visible y reintentable', async ({ page }) => {
    await page.route('**/api/league/active', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Servicio temporalmente no disponible.' }) }));
    await page.goto('/la-liga');
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(page.locator('.league-error')).toContainText('Servicio temporalmente no disponible.');
    await assertNoGlobalOverflow(page);
    await capture(page, 'mobile-320x568', 'la-liga-error');
  });

  test('loading y tabla vacía tienen estados legibles', async ({ page }) => {
    const realPayload = await (await page.request.get('/api/league/active')).json();
    let releaseResponse: (() => void) | undefined;
    await page.route('**/api/league/active', async route => {
      await new Promise<void>(resolveRequest => { releaseResponse = resolveRequest; });
      const emptyPayload = {
        ...realPayload,
        standings: realPayload.standings.map((table: any) => ({ ...table, rows: [], warnings: [], rankingComplete: true }))
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyPayload) });
    });
    await page.goto('/la-liga', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.league-loading')).toBeVisible();
    releaseResponse?.();
    await page.getByRole('button', { name: 'Posiciones', exact: true }).click();
    await expect(page.getByText('Todavía no hay parejas en esta zona.').first()).toBeVisible();
    await assertNoGlobalOverflow(page);
    await capture(page, 'mobile-320x568', 'la-liga-sin-datos');
  });

  test('nombres largos y estadísticas negativas conservan la fila completa', async ({ page }) => {
    const response = await page.request.get('/api/league/active');
    const payload = await response.json();
    payload.standings[0].rows[0].pair = 'Valentino Rodríguez Extraordinariamente Largo - Maximiliano de la Concepción Fernández';
    payload.standings[0].rows[0].setsFor = 10;
    payload.standings[0].rows[0].setsAgainst = 12;
    payload.standings[0].rows[0].setDifference = -2;
    payload.standings[0].rows[0].points = 12;
    await page.route('**/api/league/active', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
    await page.goto('/la-liga');
    await page.getByRole('button', { name: 'Posiciones', exact: true }).click();
    const row = page.locator('.league-table-scroll:visible tbody tr').first();
    await expect(row).toContainText('Valentino Rodríguez Extraordinariamente Largo');
    await expect(row).toContainText('-2');
    await expect(row.locator('td:last-child strong')).toHaveText('12');
    await assertNoGlobalOverflow(page);
    await capture(page, 'mobile-320x568', 'la-liga-nombre-largo');
  });
});
