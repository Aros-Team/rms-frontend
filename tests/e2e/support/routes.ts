import { expect, type Page, type TestInfo } from '@playwright/test';

export interface RouteCase {
  /** URL to request. May differ from the final URL when a route redirects. */
  path: string;
  /** Stable, file-system-safe name used by snapshots and a11y artifacts. */
  slug: string;
  /** Human label for the report. */
  label: string;
  /** Area shell the route must render. */
  shell: 'admin' | 'worker' | 'none';
  /** Expected `pathname + search` after router redirects settle. */
  expectPath: string;
  /** True when the expected final URL is `/forbidden` (or another error page). */
  allowErrorPage?: boolean;
  /** Route is crawled and snapshotted but excluded from the axe gate. */
  a11yExempt?: boolean;
  note?: string;
}

export type RoleKey = 'admin' | 'waiter' | 'kitchen' | 'cashier';

/**
 * Route manifest derived from `src/app/app.routes.ts` (Angular 21, standalone).
 *
 * Dynamic routes use ids from the deterministic dev seed:
 *  - product 1        `/admin/manage/products/1/recipe`
 *  - worker 1001      `/admin/manage/workers/1001/salary-history`
 *  - combo 1          `/admin/manage/combos/1/edit` and `/history`
 *
 * Redirect-only children keep their own row so a broken redirect is visible.
 */
export const ROLE_ROUTES: Record<RoleKey, RouteCase[]> = {
  admin: [
    { path: '/admin', slug: 'admin', label: 'Dashboard', shell: 'admin', expectPath: '/admin' },
    { path: '/admin/orders', slug: 'orders', label: 'Orders', shell: 'admin', expectPath: '/admin/orders' },
    {
      path: '/admin/schedules',
      slug: 'schedules',
      label: 'Schedules / Week',
      shell: 'admin',
      expectPath: '/admin/schedules',
    },
    {
      path: '/admin/schedules?tab=plantillas',
      slug: 'schedules-templates',
      label: 'Schedules / Templates',
      shell: 'admin',
      expectPath: '/admin/schedules?tab=plantillas',
    },
    {
      path: '/admin/schedules?tab=registros',
      slug: 'schedules-attendance',
      label: 'Schedules / Attendance',
      shell: 'admin',
      expectPath: '/admin/schedules?tab=registros',
    },
    {
      path: '/admin/manage',
      slug: 'manage',
      label: 'Manage (redirect to products)',
      shell: 'admin',
      expectPath: '/admin/manage/products',
    },
    {
      path: '/admin/manage/products',
      slug: 'manage-products',
      label: 'Manage / Products',
      shell: 'admin',
      expectPath: '/admin/manage/products',
    },
    {
      path: '/admin/manage/products/1/recipe',
      slug: 'product-recipe',
      label: 'Recipe editor and live costing (seed product 1)',
      shell: 'admin',
      expectPath: '/admin/manage/products/1/recipe',
    },
    {
      path: '/admin/manage/categories',
      slug: 'manage-categories',
      label: 'Manage / Categories',
      shell: 'admin',
      expectPath: '/admin/manage/categories',
    },
    {
      path: '/admin/manage/tables',
      slug: 'manage-tables',
      label: 'Manage / Tables',
      shell: 'admin',
      expectPath: '/admin/manage/tables',
    },
    {
      path: '/admin/manage/areas',
      slug: 'manage-areas',
      label: 'Manage / Areas',
      shell: 'admin',
      expectPath: '/admin/manage/areas',
    },
    {
      path: '/admin/manage/combos',
      slug: 'manage-combos',
      label: 'Manage / Combos',
      shell: 'admin',
      expectPath: '/admin/manage/combos',
    },
    {
      path: '/admin/manage/combos/new',
      slug: 'combo-new',
      label: 'Combo wizard (new)',
      shell: 'admin',
      expectPath: '/admin/manage/combos/new',
    },
    {
      path: '/admin/manage/combos/1/edit',
      slug: 'combo-edit',
      label: 'Combo wizard (seed combo 1)',
      shell: 'admin',
      expectPath: '/admin/manage/combos/1/edit',
    },
    {
      path: '/admin/manage/combos/1/history',
      slug: 'combo-history',
      label: 'Combo history (seed combo 1)',
      shell: 'admin',
      expectPath: '/admin/manage/combos/1/history',
    },
    {
      path: '/admin/manage/orders-create',
      slug: 'orders-create',
      label: 'Create order',
      shell: 'admin',
      expectPath: '/admin/manage/orders-create',
    },
    {
      path: '/admin/manage/workers',
      slug: 'manage-workers',
      label: 'Manage / Workers',
      shell: 'admin',
      expectPath: '/admin/manage/workers',
    },
    {
      path: '/admin/manage/workers/1001/salary-history',
      slug: 'salary-history',
      label: 'Salary history (seed worker 1001)',
      shell: 'admin',
      expectPath: '/admin/manage/workers/1001/salary-history',
    },
    {
      path: '/admin/manage/inventory',
      slug: 'manage-inventory',
      label: 'Manage / Inventory',
      shell: 'admin',
      expectPath: '/admin/manage/inventory',
    },
    {
      path: '/admin/analytics',
      slug: 'analytics',
      label: 'Analytics (redirect to prime cost)',
      shell: 'admin',
      expectPath: '/admin/analytics/prime-cost',
    },
    {
      path: '/admin/analytics/prime-cost',
      slug: 'analytics-prime-cost',
      label: 'Analytics / Prime cost',
      shell: 'admin',
      expectPath: '/admin/analytics/prime-cost',
    },
    {
      path: '/admin/analytics/menu-engineering',
      slug: 'analytics-menu-engineering',
      label: 'Analytics / Menu engineering',
      shell: 'admin',
      expectPath: '/admin/analytics/menu-engineering',
    },
    {
      path: '/admin/analytics/operations',
      slug: 'analytics-operations',
      label: 'Analytics / Operations',
      shell: 'admin',
      expectPath: '/admin/analytics/operations',
    },
    {
      path: '/admin/analytics/cohort',
      slug: 'analytics-cohort',
      label: 'Analytics / Cohort',
      shell: 'admin',
      expectPath: '/admin/analytics/cohort',
    },
    {
      path: '/admin/analytics/alerts',
      slug: 'analytics-alerts',
      label: 'Analytics / Alerts',
      shell: 'admin',
      expectPath: '/admin/analytics/alerts',
    },
    {
      path: '/admin/settings',
      slug: 'settings',
      label: 'Admin settings workspace',
      shell: 'admin',
      expectPath: '/admin/settings',
    },
    {
      path: '/admin/create-product',
      slug: 'create-product',
      label: 'Create product',
      shell: 'admin',
      expectPath: '/admin/create-product',
    },
    {
      path: '/dev/ui',
      slug: 'dev-ui',
      label: 'Design-system gallery (dev only)',
      shell: 'none',
      expectPath: '/dev/ui',
      a11yExempt: true,
      note: 'Development-only gallery; visually baselined but excluded from the axe gate until P1-QA-07.',
    },
  ],
  waiter: [
    {
      path: '/worker',
      slug: 'worker-home',
      label: 'Worker home (redirect to waiter)',
      shell: 'worker',
      expectPath: '/worker/waiter',
    },
    {
      path: '/worker/waiter',
      slug: 'waiter',
      label: 'Waiter dashboard',
      shell: 'worker',
      expectPath: '/worker/waiter',
    },
    {
      path: '/worker/waiter?tab=carta',
      slug: 'waiter-tab-carta',
      label: 'Waiter dashboard / Carta tab',
      shell: 'worker',
      expectPath: '/worker/waiter?tab=carta',
    },
    {
      path: '/worker/waiter?tab=pedidos',
      slug: 'waiter-tab-pedidos',
      label: 'Waiter dashboard / Pedidos tab',
      shell: 'worker',
      expectPath: '/worker/waiter?tab=pedidos',
    },
    {
      path: '/worker/combos/1',
      slug: 'combo-detail',
      label: 'Combo detail (seed combo 1)',
      shell: 'worker',
      expectPath: '/worker/combos/1',
    },
    {
      path: '/worker/kitchen',
      slug: 'kitchen-denied',
      label: 'Kitchen (denied for a waiter)',
      shell: 'none',
      expectPath: '/forbidden',
      allowErrorPage: true,
      note: 'Waiter lacks the KITCHEN/GRILL workspace; AreaGuard denies by default.',
    },
    {
      path: '/worker/cashier',
      slug: 'cashier-denied',
      label: 'Cashier (denied for a waiter)',
      shell: 'none',
      expectPath: '/forbidden',
      allowErrorPage: true,
      note: 'Waiter lacks the CASH workspace; AreaGuard denies by default.',
    },
    {
      path: '/worker/my-schedule',
      slug: 'my-schedule',
      label: 'My schedule',
      shell: 'worker',
      expectPath: '/worker/my-schedule',
    },
    {
      path: '/worker/profile',
      slug: 'profile',
      label: 'Worker profile',
      shell: 'worker',
      expectPath: '/worker/profile',
    },
  ],
  kitchen: [
    {
      path: '/worker',
      slug: 'worker-home',
      label: 'Worker home (landing is kitchen)',
      shell: 'worker',
      expectPath: '/worker/kitchen',
    },
    {
      path: '/worker/kitchen',
      slug: 'kitchen',
      label: 'Kitchen queue',
      shell: 'worker',
      expectPath: '/worker/kitchen',
    },
    {
      path: '/worker/waiter',
      slug: 'waiter-denied',
      label: 'Waiter dashboard (denied for a kitchen-only user)',
      shell: 'none',
      expectPath: '/forbidden',
      allowErrorPage: true,
      note: 'Kitchen-only user has no SERVICE/BAR workspace.',
    },
    {
      path: '/worker/cashier',
      slug: 'cashier-denied',
      label: 'Cashier (denied for a kitchen-only user)',
      shell: 'none',
      expectPath: '/forbidden',
      allowErrorPage: true,
    },
    {
      path: '/worker/my-schedule',
      slug: 'my-schedule',
      label: 'My schedule',
      shell: 'worker',
      expectPath: '/worker/my-schedule',
    },
    {
      path: '/worker/profile',
      slug: 'profile',
      label: 'Worker profile',
      shell: 'worker',
      expectPath: '/worker/profile',
    },
  ],
  cashier: [
    {
      path: '/worker',
      slug: 'worker-home',
      label: 'Worker home (landing is cashier)',
      shell: 'worker',
      expectPath: '/worker/cashier',
    },
    {
      path: '/worker/cashier',
      slug: 'cashier',
      label: 'Cashier workspace',
      shell: 'worker',
      expectPath: '/worker/cashier',
    },
    {
      path: '/worker/waiter',
      slug: 'waiter-denied',
      label: 'Waiter dashboard (denied for a cashier)',
      shell: 'none',
      expectPath: '/forbidden',
      allowErrorPage: true,
      note: 'CASH does not grant the waiter workspace.',
    },
    {
      path: '/worker/kitchen',
      slug: 'kitchen-denied',
      label: 'Kitchen (denied for a cashier)',
      shell: 'none',
      expectPath: '/forbidden',
      allowErrorPage: true,
    },
    {
      path: '/worker/my-schedule',
      slug: 'my-schedule',
      label: 'My schedule',
      shell: 'worker',
      expectPath: '/worker/my-schedule',
    },
    {
      path: '/worker/profile',
      slug: 'profile',
      label: 'Worker profile',
      shell: 'worker',
      expectPath: '/worker/profile',
    },
  ],
};

/** Unauthenticated routes from `app.routes.ts` plus the wildcard 404. */
export const PUBLIC_ROUTES: RouteCase[] = [
  { path: '/login', slug: 'login', label: 'Login', shell: 'none', expectPath: '/login' },
  {
    path: '/forgot-password',
    slug: 'forgot-password',
    label: 'Forgot password',
    shell: 'none',
    expectPath: '/forgot-password',
  },
  {
    path: '/reset-password',
    slug: 'reset-password',
    label: 'Reset password',
    shell: 'none',
    expectPath: '/reset-password',
  },
  {
    path: '/login/verify',
    slug: 'login-verify',
    label: 'Two-factor verification',
    shell: 'none',
    expectPath: '/login/verify',
  },
  {
    path: '/setup-account',
    slug: 'setup-account',
    label: 'Setup account',
    shell: 'none',
    expectPath: '/setup-account',
  },
  {
    path: '/server-error',
    slug: 'server-error',
    label: 'Server error page',
    shell: 'none',
    expectPath: '/server-error',
    allowErrorPage: true,
  },
  {
    path: '/forbidden',
    slug: 'forbidden',
    label: 'Forbidden page',
    shell: 'none',
    expectPath: '/forbidden',
    allowErrorPage: true,
  },
  {
    path: '/route-not-in-manifest',
    slug: 'not-found',
    label: 'Wildcard 404',
    shell: 'none',
    expectPath: '/route-not-in-manifest',
  },
];

export const SHELL_SELECTOR = {
  admin: 'app-admin-area app-layout',
  worker: 'app-worker-area app-worker-layout',
  none: null,
} as const;

export function expectRoutePath(page: Page, route: RouteCase): void {
  const url = new URL(page.url());
  expect(
    `${url.pathname}${url.search}`,
    `${route.label}: expected final URL ${route.expectPath}`,
  ).toBe(route.expectPath);
}

export async function expectShell(page: Page, route: RouteCase): Promise<void> {
  if (route.shell === 'none') return;
  const selector = SHELL_SELECTOR[route.shell];
  await expect(page.locator(selector).first(), `${route.label}: missing ${selector}`).toBeVisible();
  await expect(page.locator('main').first(), `${route.label}: missing main landmark`).toBeVisible();
}

export function expectNotErrorPage(page: Page, route: RouteCase): void {
  if (route.allowErrorPage) return;
  const pathname = new URL(page.url()).pathname;
  expect(pathname, `${route.label}: landed on ${pathname}`).not.toBe('/forbidden');
  expect(pathname, `${route.label}: landed on ${pathname}`).not.toBe('/server-error');
}
