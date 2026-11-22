import fs from 'node:fs';
import type { FullConfig } from '@playwright/test';
import { ARTIFACTS_DIR, AUTH_DIR, authStatePath, type RoleKey } from './support/paths';

/**
 * Baseline auth shortcut (S0-F4).
 *
 * The API login endpoint rejects this build's anonymous request shape, so the
 * Sprint 0 baseline reuses access tokens minted by the orchestrator and stored
 * in /tmp/opencode. Tokens are short-lived (~60 min), therefore they are read
 * here on every run instead of being checked into a storageState file.
 *
 * A real login fixture (credentials -> storageState) is a Phase 1 task; this
 * file is the only place that needs to change.
 */
const TOKEN_FILES: Record<RoleKey, string> = {
  admin: '/tmp/opencode/admin_token.txt',
  waiter: '/tmp/opencode/token-waiter.txt',
  kitchen: '/tmp/opencode/token-kitchen.txt',
  cashier: '/tmp/opencode/token-cashier.txt',
};

const ORIGIN = process.env['BASE_URL'] ?? 'http://localhost:4200';

interface JwtPayload {
  sub?: string;
  role?: string;
  exp?: number;
}

function decodePayload(token: string): JwtPayload {
  const segment = token.split('.')[1];
  if (!segment) throw new Error('Token is not a JWT (missing payload segment)');
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as JwtPayload;
}

function readToken(role: RoleKey): { token: string; payload: JwtPayload } {
  const file = TOKEN_FILES[role];
  if (!fs.existsSync(file)) {
    throw new Error(
      `[auth] Missing ${role} token at ${file}. Regenerate it with /tmp/opencode/api_token.sh ` +
        `(admin) or /tmp/opencode/user_token.sh (workers), or point the lane at fresh files.`,
    );
  }
  const token = fs.readFileSync(file, 'utf8').trim();
  const payload = decodePayload(token);
  if (!payload.exp) throw new Error(`[auth] ${role} token has no exp claim (${file})`);

  const msLeft = payload.exp * 1000 - Date.now();
  if (msLeft < 120_000) {
    throw new Error(
      `[auth] ${role} token from ${file} expires in ${Math.round(msLeft / 1000)}s. ` +
        `Regenerate the tokens before running the suite.`,
    );
  }
  console.log(
    `[auth] ${role}: ${payload.sub ?? 'unknown'} (${payload.role ?? '?'}) token valid for ` +
      `${Math.round(msLeft / 60_000)} min`,
  );
  return { token, payload };
}

function storageState(role: RoleKey): object {
  const { token, payload } = readToken(role);
  const expires = payload.exp as number;
  const today = new Date().toISOString().slice(0, 10);

  return {
    cookies: [
      {
        name: 'rms_access',
        value: token,
        domain: 'localhost',
        path: '/',
        expires,
        httpOnly: false,
        secure: false,
        sameSite: 'Strict',
      },
      {
        name: 'rms_token_expiry',
        // The visual suite freezes the browser clock to the seed anchor. Keep
        // the client-side expiry beyond that frozen instant; the API still
        // validates the real JWT exp. Global setup aborts if the JWT is near
        // expiry, so this only prevents a false "session expired" redirect.
        value: String((expires + 7 * 24 * 60 * 60) * 1000),
        domain: 'localhost',
        path: '/',
        expires,
        httpOnly: false,
        secure: false,
        sameSite: 'Strict',
      },
    ],
    origins: [
      {
        origin: ORIGIN,
        localStorage: [
          { name: 'habeas_data_accepted', value: 'true' },
          { name: 'habeas_data_date', value: today },
          // Pin the baseline to light; dark snapshots are a Phase 1 follow-up.
          { name: 'theme', value: 'light' },
        ],
      },
    ],
  };
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  for (const role of Object.keys(TOKEN_FILES) as RoleKey[]) {
    const file = authStatePath(role);
    fs.writeFileSync(file, `${JSON.stringify(storageState(role), null, 2)}\n`, 'utf8');
  }
}
