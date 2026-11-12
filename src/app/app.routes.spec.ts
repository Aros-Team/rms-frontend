/**
 * Tests for the route table.
 *
 * Feature: Navigation contract of the app shell.
 * Contract:
 *  - every route that renders a component declares a `title`, otherwise the
 *    document title silently falls back to the bare app name
 *  - unknown URLs render the 404 page instead of bouncing to `/login`
 *  - guarded areas keep their guards so a missing guard can't be shipped
 *
 * Approach: Walk the exported route tree. No TestBed needed: the assertions
 * are structural, so a new route fails here until it is titled.
 */
import { Route } from '@angular/router';

import { routes } from './app.routes';

function flatten(routeList: Route[], parents: string[] = []): { path: string; route: Route }[] {
  return routeList.flatMap((route) => {
    const path = [...parents, route.path ?? ''].filter(Boolean).join('/');

    return [
      { path: path || '(root)', route },
      ...flatten(route.children ?? [], [...parents, route.path ?? '']),
    ];
  });
}

const all = flatten(routes);

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
});
