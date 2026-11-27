import { expect, test } from '@playwright/test';
import { expectShell, type RouteCase } from './routes';
import { settle } from './collect';
import { openRoute, type SuiteRole } from './smoke-suite';
import { publicStorageState } from './paths';
import { freezeClock, visualMasks } from './visual-determinism';

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
        await freezeClock(page);
        await openRoute(page, route.path);
        await expectShell(page, route);

        // Charts animate on canvas; let them reach their final frame.
        await settle(page, 1_200);
        await page.evaluate(() => window.scrollTo(0, 0));
        if (role === 'kitchen') {
          // The connection pill flips between "En vivo" and "Reconectando".
          // Connection state is masked from the board baseline.
          await page.addStyleTag({
            content: `.kitchen__tools app-rms-status-pill { visibility: hidden !important; }`,
          });
          await settle(page, 300);
        }
        const masks = await visualMasks(page);
        await expect(page).toHaveScreenshot(`${route.slug}.png`, {
          // The kitchen is a station board sized to the screen; fullPage would
          // change height with the number of queued cards. Other workspaces
          // keep the whole scrollable page in the baseline.
          fullPage: role !== 'kitchen',
          mask: masks,
          maskColor: '#e2e8f0',
          // The harness and other lanes may run concurrently; 20 s was too
          // tight for font + screenshot capture under that load.
          timeout: 30_000,
        });
      });
    }
  });
}
