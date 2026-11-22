/**
 * Tests for the AreaGuard (`/worker` workspace permission).
 *
 * Feature: a worker only enters the workspace their assigned areas allow, and
 * `/worker` dispatches them to their landing screen.
 *
 * Contract:
 *  - landing: SERVICE/BAR → `/worker/waiter`, KITCHEN/GRILL → `/worker/kitchen`,
 *    CASH → `/worker/cashier`; multi-area priority cashier > waiter > kitchen
 *  - no recognized area → `/forbidden`; no session → `/login`
 *  - CASH cannot enter waiter routes, SERVICE cannot enter kitchen/cashier
 *  - `anyWorker` routes (profile, schedule) are open to every worker
 *  - a route with no workspace data is DENIED (deny by default)
 *
 * Approach: real Router for UrlTree serialization, stubbed Auth + Logging,
 * route snapshots carrying `data`; assert the exact guard result.
 */
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  RedirectCommand,
  Router,
  provideRouter,
} from '@angular/router';

import { AreaGuard } from './area';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { UserInfo } from '@models/domain/user/user-info';
import type { AreaTypeValue } from '@models/dto/areas/area';
import type { WorkerRouteData } from '@app/core/config/navigation/role-navigation';

function worker(...types: AreaTypeValue[]): UserInfo {
  return {
    id: 2,
    name: 'Beto',
    document: '2',
    email: 'beto@rms.test',
    role: 'WORKER',
    areas: types.map((type, index) => ({ id: index + 1, name: type, type })),
  };
}

function route(data: WorkerRouteData): ActivatedRouteSnapshot {
  return { data } as unknown as ActivatedRouteSnapshot;
}

describe('AreaGuard', () => {
  let guard: AreaGuard;
  let router: Router;
  let auth: { getData: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { getData: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: auth },
        { provide: Logging, useValue: { warn: vi.fn(), routing: vi.fn(), info: vi.fn() } },
      ],
    });

    guard = TestBed.inject(AreaGuard);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function redirectUrl(result: GuardResult): string {
    expect(result).toBeInstanceOf(RedirectCommand);
    return router.serializeUrl((result as RedirectCommand).redirectTo);
  }

  const landing: WorkerRouteData = { workerLanding: true };

  describe('landing dispatch', () => {
    it('sends a SERVICE worker to the waiter home', () => {
      auth.getData.mockReturnValue(worker('SERVICE'));

      expect(redirectUrl(guard.canActivate(route(landing)) as GuardResult)).toBe('/worker/waiter');
    });

    it('sends a BAR worker to the waiter home', () => {
      auth.getData.mockReturnValue(worker('BAR'));

      expect(redirectUrl(guard.canActivate(route(landing)) as GuardResult)).toBe('/worker/waiter');
    });

    it('sends a KITCHEN-only worker to the kitchen', () => {
      auth.getData.mockReturnValue(worker('KITCHEN'));

      expect(redirectUrl(guard.canActivate(route(landing)) as GuardResult)).toBe('/worker/kitchen');
    });

    it('sends a GRILL-only worker to the kitchen (does not fall through)', () => {
      auth.getData.mockReturnValue(worker('GRILL'));

      expect(redirectUrl(guard.canActivate(route(landing)) as GuardResult)).toBe('/worker/kitchen');
    });

    it('sends a CASH-only worker to the cashier area (CASH is not CASHIER)', () => {
      auth.getData.mockReturnValue(worker('CASH'));

      expect(redirectUrl(guard.canActivate(route(landing)) as GuardResult)).toBe('/worker/cashier');
    });

    it('prefers the waiter home for a SERVICE + KITCHEN worker', () => {
      auth.getData.mockReturnValue(worker('SERVICE', 'KITCHEN'));

      expect(redirectUrl(guard.canActivate(route(landing)) as GuardResult)).toBe('/worker/waiter');
    });

    it('prefers the cashier area for a CASH + SERVICE worker', () => {
      auth.getData.mockReturnValue(worker('CASH', 'SERVICE'));

      expect(redirectUrl(guard.canActivate(route(landing)) as GuardResult)).toBe('/worker/cashier');
    });

    it('sends a worker with no recognized area to /forbidden', () => {
      auth.getData.mockReturnValue(worker());

      expect(redirectUrl(guard.canActivate(route(landing)) as GuardResult)).toBe('/forbidden');
    });

    it('sends an unauthenticated user to /login', () => {
      auth.getData.mockReturnValue(undefined);

      expect(redirectUrl(guard.canActivate(route(landing)) as GuardResult)).toBe('/login');
    });
  });

  describe('waiter workspace', () => {
    const waiterRoute: WorkerRouteData = { workerWorkspaces: ['waiter'] };

    it('allows SERVICE', () => {
      auth.getData.mockReturnValue(worker('SERVICE'));

      expect(guard.canActivate(route(waiterRoute))).toBe(true);
    });

    it('allows BAR', () => {
      auth.getData.mockReturnValue(worker('BAR'));

      expect(guard.canActivate(route(waiterRoute))).toBe(true);
    });

    it('denies CASH', () => {
      auth.getData.mockReturnValue(worker('CASH'));

      expect(redirectUrl(guard.canActivate(route(waiterRoute)) as GuardResult)).toBe('/forbidden');
    });

    it('denies KITCHEN', () => {
      auth.getData.mockReturnValue(worker('KITCHEN'));

      expect(redirectUrl(guard.canActivate(route(waiterRoute)) as GuardResult)).toBe('/forbidden');
    });
  });

  describe('kitchen workspace', () => {
    const kitchenRoute: WorkerRouteData = { workerWorkspaces: ['kitchen'] };

    it('allows KITCHEN', () => {
      auth.getData.mockReturnValue(worker('KITCHEN'));

      expect(guard.canActivate(route(kitchenRoute))).toBe(true);
    });

    it('allows GRILL', () => {
      auth.getData.mockReturnValue(worker('GRILL'));

      expect(guard.canActivate(route(kitchenRoute))).toBe(true);
    });

    it('denies SERVICE', () => {
      auth.getData.mockReturnValue(worker('SERVICE'));

      expect(redirectUrl(guard.canActivate(route(kitchenRoute)) as GuardResult)).toBe('/forbidden');
    });
  });

  describe('cashier workspace', () => {
    const cashierRoute: WorkerRouteData = { workerWorkspaces: ['cashier'] };

    it('allows CASH', () => {
      auth.getData.mockReturnValue(worker('CASH'));

      expect(guard.canActivate(route(cashierRoute))).toBe(true);
    });

    it('denies SERVICE (a waiter cannot take the cash register)', () => {
      auth.getData.mockReturnValue(worker('SERVICE'));

      expect(redirectUrl(guard.canActivate(route(cashierRoute)) as GuardResult)).toBe('/forbidden');
    });
  });

  it('allows any worker into an anyWorker route', () => {
    auth.getData.mockReturnValue(worker('CASH'));

    expect(guard.canActivate(route({ anyWorker: true }))).toBe(true);
  });

  it('denies a route that declares no workspace (deny by default)', () => {
    auth.getData.mockReturnValue(worker('SERVICE'));

    expect(redirectUrl(guard.canActivate(route({})) as GuardResult)).toBe('/forbidden');
  });

  it('denies a route with an empty workspace list', () => {
    auth.getData.mockReturnValue(worker('SERVICE'));

    expect(redirectUrl(guard.canActivate(route({ workerWorkspaces: [] })) as GuardResult)).toBe(
      '/forbidden',
    );
  });

  it('allows the intersection of a multi-workspace route', () => {
    auth.getData.mockReturnValue(worker('GRILL'));

    expect(
      guard.canActivate(route({ workerWorkspaces: ['waiter', 'kitchen'] })),
    ).toBe(true);
  });
});
