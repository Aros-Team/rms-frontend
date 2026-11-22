import { expect, test, type Page } from '@playwright/test';
import {
  expectNotErrorPage,
  expectRoutePath,
  expectShell,
  type RouteCase,
} from './routes';
import { collectIssues, expectNoIssues, issueSummary, settle } from './collect';
import { publicStorageState, type RoleKey } from './paths';

export type SuiteRole = RoleKey | 'public';

export async function openRoute(page: Page, path: string): Promise<void> {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status() ?? 0, `GET ${path} did not return an HTML document`).toBeLessThan(400);
  await settle(page);
}

/**
 * One test per route. A failure identifies the exact route instead of stopping
 * the crawl, which makes the HTML report usable as a triage list.
 */
export function defineSmokeSuite(
  role: SuiteRole,
  routes: RouteCase[],
  options: { authenticated: boolean },
): void {
  test.describe(`smoke / ${role}`, () => {
    if (!options.authenticated) {
      test.use({ storageState: publicStorageState() });
    }

    for (const route of routes) {
      test(`${route.label} — ${route.path}`, async ({ page }, testInfo) => {
        const issues = collectIssues(page);
        await openRoute(page, route.path);

        expectRoutePath(page, route);
        expectNotErrorPage(page, route);
        await expectShell(page, route);
        if (route.expectPath === '/forbidden') {
          await expect(
            page.locator('app-forbidden-page'),
            `${role} ${route.path}: expected the forbidden page`,
          ).toBeVisible();
        }

        if (issueSummary(issues)) {
          await testInfo.attach('route-issues', {
            body: JSON.stringify({ role, route, ...issues }, null, 2),
            contentType: 'application/json',
          });
        }
        expectNoIssues(issues, `${role} ${route.path}`);
      });
    }
  });
}
