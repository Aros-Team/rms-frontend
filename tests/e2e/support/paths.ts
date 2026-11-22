import path from 'node:path';

/**
 * Single source of truth for on-disk locations. Both the config and the specs
 * import this file, so `PW_ARTIFACTS` moves report, traces and snapshots
 * together.
 */
export const ARTIFACTS_DIR =
  process.env['PW_ARTIFACTS'] ??
  path.resolve(process.cwd(), '../../rms/docs/sprint-0/artifacts/playwright');

export type RoleKey = 'admin' | 'waiter' | 'kitchen' | 'cashier';

/**
 * Auth state is generated at run time by tests/e2e/global-setup.ts from the
 * token files in /tmp/opencode. It is deliberately git-ignored: it contains
 * short-lived access tokens.
 */
export const AUTH_DIR = path.resolve(process.cwd(), 'tests/e2e/.auth');

export function authStatePath(role: RoleKey): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

export function a11yArtifactPath(
  role: RoleKey | 'public',
  slug: string,
  projectName?: string,
): string {
  const suffix = projectName ? `--${projectName}` : '';
  return path.join(ARTIFACTS_DIR, 'a11y', role, `${slug}${suffix}.json`);
}

/**
 * Unauthenticated but "returning visitor" state: no session cookies, yet the
 * habeas-data notice and theme are already accepted/pinned. Without this the
 * public routes would only ever show the first-run privacy modal.
 */
export function publicStorageState(): {
  cookies: [];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
} {
  const origin = process.env['BASE_URL'] ?? 'http://localhost:4200';
  return {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: 'habeas_data_accepted', value: 'true' },
          { name: 'habeas_data_date', value: new Date().toISOString().slice(0, 10) },
          { name: 'theme', value: 'light' },
        ],
      },
    ],
  };
}
