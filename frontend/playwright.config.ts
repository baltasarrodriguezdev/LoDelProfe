import { defineConfig } from '@playwright/test';

const baseURL = process.env.RESPONSIVE_BASE_URL ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  testMatch: /responsive\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'responsive-audit-2026-08-16/playwright-report.json' }]],
  outputDir: 'responsive-audit-2026-08-16/playwright-artifacts',
  use: {
    baseURL,
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  }
});
