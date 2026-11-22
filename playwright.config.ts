import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authStatePath } from './tests/e2e/support/paths';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Baseline artifacts live in the planning repo so the Sprint 0 evidence is
 * collected in one place. Override with PW_ARTIFACTS when running elsewhere.
 */
const ARTIFACTS_DIR =
  process.env['PW_ARTIFACTS'] ?? path.resolve(here, '../../rms/docs/sprint-0/artifacts/playwright');

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:4200';

/**
 * The dev server is already running, so there is deliberately no webServer
 * block. `npx playwright test` never starts or stops the Angular dev server.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  outputDir: path.join(ARTIFACTS_DIR, 'results'),
  // Baselines live in the worktree so they can be reviewed and committed with
  // the lane. Only the HTML report, traces and axe JSON go to the artifacts dir.
  snapshotPathTemplate: path.join(
    here,
    'tests/e2e/visual/__screenshots__',
    '{projectName}',
    '{arg}{ext}',
  ),
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: process.env['CI'] ? 2 : 6,
  timeout: 120_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      threshold: 0.2,
      maxDiffPixelRatio: 0.02,
    },
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(ARTIFACTS_DIR, 'html-report'), open: 'never' }],
    ['json', { outputFile: path.join(ARTIFACTS_DIR, 'results.json') }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'admin-desktop',
      testMatch: [
        'smoke/admin.spec.ts',
        'smoke/public.spec.ts',
        'a11y/admin.spec.ts',
        'a11y/public.spec.ts',
        'visual/admin.spec.ts',
        'visual/public.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: authStatePath('admin'),
      },
    },
    {
      name: 'waiter-mobile',
      testMatch: ['smoke/waiter.spec.ts', 'a11y/waiter.spec.ts', 'visual/waiter.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        storageState: authStatePath('waiter'),
      },
    },
    {
      name: 'kitchen-tv',
      testMatch: ['smoke/kitchen.spec.ts', 'a11y/kitchen.spec.ts', 'visual/kitchen.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: authStatePath('kitchen'),
      },
    },
    {
      name: 'kitchen-tablet',
      testMatch: ['smoke/kitchen.spec.ts', 'a11y/kitchen.spec.ts', 'visual/kitchen.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        storageState: authStatePath('kitchen'),
      },
    },
    {
      name: 'cashier-desktop',
      testMatch: ['smoke/cashier.spec.ts', 'a11y/cashier.spec.ts', 'visual/cashier.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: authStatePath('cashier'),
      },
    },
  ],
});
