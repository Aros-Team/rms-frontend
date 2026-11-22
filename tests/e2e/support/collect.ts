import type { Page, Request, Response } from '@playwright/test';
import { expect } from '@playwright/test';

export interface CollectedIssues {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
}

/**
 * Known platform noise, not an app defect. Chromium emits this because the
 * Angular dev server (or a library) registers an unload handler while the
 * Permissions-Policy header disallows it. It appears on every route, including
 * the static error pages, so failing on it would make the suite useless.
 */
const KNOWN_CONSOLE_NOISE = [
  /Permissions policy violation: unload is not allowed in this document\./,
];

function isKnownNoise(message: string): boolean {
  return KNOWN_CONSOLE_NOISE.some((pattern) => pattern.test(message));
}

export function collectIssues(page: Page): CollectedIssues {
  const issues: CollectedIssues = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error' && !isKnownNoise(message.text())) {
      issues.consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    issues.pageErrors.push(error.stack ?? String(error));
  });
  page.on('requestfailed', (request: Request) => {
    // Aborted navigations during SPA redirects are not failures we can act on.
    const failure = request.failure()?.errorText ?? 'unknown';
    if (!failure.includes('net::ERR_ABORTED')) {
      issues.failedRequests.push(`${request.method()} ${request.url()} — ${failure}`);
    }
  });
  page.on('response', (response: Response) => {
    if (response.status() >= 400) {
      issues.badResponses.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  return issues;
}

export function issueSummary(issues: CollectedIssues): string {
  const lines: string[] = [];
  for (const [key, values] of Object.entries(issues) as [keyof CollectedIssues, string[]][]) {
    if (values.length > 0) {
      lines.push(`${key} (${values.length}):`);
      for (const value of values) lines.push(`  - ${value}`);
    }
  }
  return lines.join('\n');
}

export function expectNoIssues(issues: CollectedIssues, label: string): void {
  const summary = issueSummary(issues);
  expect(issues.pageErrors, `${label}: page errors\n${summary}`).toEqual([]);
  expect(issues.consoleErrors, `${label}: console errors\n${summary}`).toEqual([]);
  expect(issues.failedRequests, `${label}: failed requests\n${summary}`).toEqual([]);
  expect(issues.badResponses, `${label}: HTTP 4xx/5xx responses\n${summary}`).toEqual([]);
}

/**
 * Wait until the SPA has finished its first data batch. `networkidle` is the
 * strongest signal available because the app polls; the extra animation frames
 * let Angular flush the shell before we assert or screenshot.
 */
export async function settle(page: Page, minDelayMs = 600): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {
    // Polling pages may never be fully idle; the shell assertion still runs.
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  if (minDelayMs > 0) await page.waitForTimeout(minDelayMs);
}
