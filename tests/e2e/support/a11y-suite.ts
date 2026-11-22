import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectShell, type RouteCase } from './routes';
import { settle } from './collect';
import { a11yArtifactPath, publicStorageState } from './paths';
import { openRoute, type SuiteRole } from './smoke-suite';

interface SerializableNode {
  target: string[];
  html: string;
  failureSummary?: string;
}

interface SerializableViolation {
  id: string;
  impact: string | null;
  help: string;
  description: string;
  nodes: SerializableNode[];
}

const SEVERE = new Set(['serious', 'critical']);

/**
 * Scans every route with the WCAG 2.0/2.1 A+AA rule set. Only serious and
 * critical violations fail the test (the project gate); moderate and minor
 * findings are still written to the artifact so the audit has the full picture.
 */
export function defineA11ySuite(
  role: SuiteRole,
  routes: RouteCase[],
  options: { authenticated: boolean },
): void {
  test.describe(`a11y / ${role}`, () => {
    if (!options.authenticated) {
      test.use({ storageState: publicStorageState() });
    }

    for (const route of routes.filter((candidate) => !candidate.a11yExempt)) {
      test(`${route.label} — ${route.path}`, async ({ page }, testInfo) => {
        await openRoute(page, route.path);
        await expectShell(page, route);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        const violations: SerializableViolation[] = results.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact ?? null,
          help: violation.help,
          description: violation.description,
          nodes: violation.nodes.map((node) => ({
            target: node.target.map(String),
            html: node.html,
            failureSummary: node.failureSummary,
          })),
        }));
        const severe = violations.filter((violation) => SEVERE.has(violation.impact ?? ''));

        const artifact = {
          role,
          route: { path: route.path, label: route.label },
          finalUrl: page.url(),
          scannedAt: new Date().toISOString(),
          counts: {
            violations: violations.length,
            severe: severe.length,
            passes: results.passes.length,
            incomplete: results.incomplete.length,
          },
          severe: severe.map((violation) => violation.id),
          violations,
        };

        const out = a11yArtifactPath(role, route.slug);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
        await testInfo.attach('axe-results', {
          body: JSON.stringify(artifact, null, 2),
          contentType: 'application/json',
        });

        const details = severe
          .map(
            (violation) =>
              `- ${violation.id} (${violation.impact ?? 'unknown'}, ${violation.nodes.length} node(s)): ` +
              violation.help,
          )
          .join('\n');

        expect(
          severe,
          `${role} ${route.path}: ${severe.length} serious/critical axe violation(s)\n${details}`,
        ).toEqual([]);
      });
    }
  });
}
