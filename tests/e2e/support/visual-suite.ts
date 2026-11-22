import { expect, test } from '@playwright/test';
import { expectShell, type RouteCase } from './routes';
import { settle } from './collect';
import { openRoute, type SuiteRole } from './smoke-suite';
import { publicStorageState } from './paths';

/**
 * Baseline visual snapshots (light theme only in Sprint 0).
 *
 * Stability strategy:
 *  - `reducedMotion: reduce` + Playwright's `animations: 'disabled'`.
 *  - settle() waits for network idle, fonts and two animation frames.
 *  - an extra 1.2 s lets Chart.js finish its JS animation (CSS-only disabling
 *    does not stop canvas animation).
 *  - worker toasts are masked because they depend on polling and seed state.
 */
export function defineVisualSuite(
  role: SuiteRole,
  routes: RouteCase[],
  options: { authenticated: boolean },
): void {
  test.describe(`visual / ${role}`, () => {
    if (!options.authenticated) {
      test.use({ storageState: publicStorageState() });
    }

    for (const route of routes) {
      test(`${route.label} — ${route.path}`, async ({ page }) => {
        await openRoute(page, route.path);
        await expectShell(page, route);

        // Charts animate on canvas; let them reach their final frame.
        await settle(page, 1_200);
        await page.evaluate(() => window.scrollTo(0, 0));

        await expect(page).toHaveScreenshot(`${route.slug}.png`, {
          fullPage: true,
          mask: [page.locator('.p-toast'), page.locator('.p-toast-message')],
          timeout: 20_000,
        });
      });
    }
  });
}
