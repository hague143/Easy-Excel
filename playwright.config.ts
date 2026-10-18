import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const port = Number(process.env.SHEETPILOT_E2E_PORT || 5174);
const standalone = Boolean(process.env.SHEETPILOT_STANDALONE_HTML);
export default defineConfig({
  testDir: './tests',
  testMatch: 'e2e.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir:
    process.env.SHEETPILOT_E2E_OUTPUT || (standalone ? 'test-results/standalone' : 'test-results'),
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    offline: standalone,
    viewport: { width: 1440, height: 1000 },
    launchOptions: existsSync('/usr/bin/chromium')
      ? { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] }
      : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: standalone
    ? undefined
    : {
        command: `npm run dev -- --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});
