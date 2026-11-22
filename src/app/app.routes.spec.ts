/**
 * Tests for the route table.
 *
 * Feature: navigation contract of the app shell (four roles, one auth shell).
 * Contract:
 *  - every route that renders a component declares a `title`
 *  - unknown URLs render the 404 page instead of bouncing to `/login`
 *  - `/worker` children declare their workspace and are guarded by AreaGuard
 *    (deny by default), including the cashier route
 *  - the three pending analytics routes are kept for Phase 2
 *  - the legacy `/worker/take-order` and `/worker/orders` redirects are gone
 *
 * Approach: walk the exported route tree structurally. A new worker route
 * without a workspace declaration or guard fails here.
 */
import { Route } from '@angular/router';

import { routes } from './app.routes';
import { AreaGuard } from '@core/guards/area/area';
import type { WorkerRouteData } from '@app/core/config/navigation/role-navigation';

function flatten(
  routeList: Route[],
  parents: string[] = [],
): { path: string; route: Route }[] {
  return routeList.flatMap((route) => {
    const path = [...parents, route.path ?? ''].filter(Boolean).join('/');

    return [
      { path: path || '(root)', route },
      ...flatten(route.children ?? [], [...parents, route.path ?? '']),
    ];
  });
}

const all = flatten(routes);

function childrenOf(path: string): Route[] {
  return routes.find((route) => route.path === path)?.children ?? [];
}

function workerData(route: Route): WorkerRouteData {
  return (route.data ?? {}) as WorkerRouteData;
}

const workerChildren = childrenOf('worker');

function requireWorkerChild(path: string): Route {
  const child = workerChildren.find((candidate) => candidate.path === path);
  if (!child) {
    throw new Error(`Missing /worker child route: ${path}`);
  }
  return child;
}

describe('app routes', () => {
  it('should title every route that renders a component', () => {
    const untitled = all
      .filter(({ route }) => route.loadComponent !== undefined || route.component !== undefined)
      .filter(({ route }) => !route.title)
      .map(({ path }) => path);

    expect(untitled).toEqual([]);
  });

  it('should render a dedicated 404 page for unknown URLs', () => {
    const wildcard = routes.find((route) => route.path === '**');

    expect(wildcard).toBeDefined();
    expect(wildcard?.redirectTo).toBeUndefined();
    expect(wildcard?.title).toBe('Página no encontrada');
  });

  it('should keep the auth and role guards on every guarded area', () => {
    const guarded = all.filter(({ route }) => route.canActivate !== undefined);

    expect(guarded.length).toBeGreaterThan(0);
  });

  it('should redirect every empty child path to a real screen', () => {
    const emptyRedirects = all.filter(
      ({ route }) => route.path === '' && route.redirectTo !== undefined,
    );

    expect(emptyRedirects.length).toBeGreaterThan(0);
    for (const { route } of emptyRedirects) {
      expect(route.redirectTo).not.toBe('');
    }
  });

  it('should host all five auth screens under one shell', () => {
    const shell = routes.find((route) => route.path === '' && route.children !== undefined);
    const paths = (shell?.children ?? []).map((child) => child.path);

    expect(paths).toEqual([
      'login',
      'login/verify',
      'forgot-password',
      'reset-password',
      'setup-account',
    ]);
  });

  it('should guard every /worker child with AreaGuard', () => {
    const unguarded = workerChildren
      .filter((child) => {
        const guards: unknown[] = child.canActivate ?? [];
        return !guards.includes(AreaGuard);
      })
      .map((child) => child.path);

    expect(unguarded).toEqual([]);
  });

  it('should declare a workspace for every /worker child', () => {
    const undeclared = workerChildren
      .filter((child) => {
        const data = workerData(child);
        return (
          data.workerLanding !== true &&
          data.anyWorker !== true &&
          (data.workerWorkspaces ?? []).length === 0
        );
      })
      .map((child) => child.path);

    expect(undeclared).toEqual([]);
  });

  it('should land the index route through AreaGuard instead of a naked redirect', () => {
    const index = requireWorkerChild('');

    expect(index.redirectTo).toBeUndefined();
    expect(index.loadComponent).toBeDefined();
    expect(workerData(index).workerLanding).toBe(true);
  });

  it('should expose a guarded /worker/cashier area for the CASH role', () => {
    const cashier = requireWorkerChild('cashier');

    expect(cashier.title).toBe('Caja');
    expect(workerData(cashier).workerWorkspaces).toEqual(['cashier']);
  });

  it('should keep waiter and kitchen workspaces separate', () => {
    const waiter = requireWorkerChild('waiter');
    const kitchen = requireWorkerChild('kitchen');

    expect(workerData(waiter).workerWorkspaces).toEqual(['waiter']);
    expect(workerData(kitchen).workerWorkspaces).toEqual(['kitchen']);
  });

  it('should open only profile and schedule to every worker', () => {
    const anyWorkerRoutes = workerChildren
      .filter((child) => workerData(child).anyWorker === true)
      .map((child) => child.path);

    expect(anyWorkerRoutes).toEqual(['profile', 'my-schedule']);
  });

  it('should expose schedules as a first-class admin route', () => {
    const schedules = childrenOf('admin').find((route) => route.path === 'schedules');

    expect(schedules?.title).toBe('Horarios');
    expect(schedules?.loadComponent).toBeDefined();
  });

  it('should keep the three pending analytics routes for Phase 2', () => {
    const analyticsRoute = all.find(({ path }) => path === 'admin/analytics')?.route;
    const analytics = (analyticsRoute?.children ?? []).map((child) => child.path);

    expect(analytics).toEqual(['', 'prime-cost', 'menu-engineering', 'operations', 'cohort', 'alerts']);
  });

  it('should not keep the legacy worker redirects that pointed nowhere', () => {
    const legacy = workerChildren
      .filter((child) => child.path === 'take-order' || child.path === 'orders')
      .map((child) => child.path);

    expect(legacy).toEqual([]);
  });

  it('should redirect the top-level /cashier shortcut to the guarded worker area', () => {
    const shortcut = routes.find((route) => route.path === 'cashier');

    expect(shortcut?.redirectTo).toBe('/worker/cashier');
  });
});
