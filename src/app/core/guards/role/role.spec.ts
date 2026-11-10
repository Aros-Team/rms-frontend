/**
 * Tests for the RoleGuard (top-level area permission).
 *
 * Feature: A user may only enter the area that matches their role.
 * Contract:
 *  - ADMIN on `/admin` → allowed; on `/worker` → `/forbidden` (403, not a server error)
 *  - WORKER on `/worker` → allowed; on `/admin` → `/forbidden`
 *  - lazy user data: 401 → login with returnUrl, 403 → `/forbidden`, 5xx → `/server-error`
 *
 * Approach: real Router for UrlTree serialization, stubbed Auth + Logging,
 * route snapshots carrying the top-level path.
 */
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  RedirectCommand,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom, isObservable, of, throwError } from 'rxjs';

import { RoleGuard } from './role';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { UserInfo } from '@models/domain/user/user-info';

const ADMIN: UserInfo = {
  id: 1,
  name: 'Ana',
  document: '1',
  email: 'ana@rms.test',
  role: 'ADMIN',
  areas: [],
};

const WORKER: UserInfo = { ...ADMIN, id: 2, name: 'Beto', role: 'WORKER' };

interface AuthStub {
  getData: ReturnType<typeof vi.fn>;
  loadUserInfo: ReturnType<typeof vi.fn>;
}

function route(path: string): ActivatedRouteSnapshot {
  return { routeConfig: { path } } as unknown as ActivatedRouteSnapshot;
}

function state(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

async function resolve(result: MaybeAsync<GuardResult>): Promise<GuardResult> {
  if (isObservable(result)) {
    return firstValueFrom(result);
  }
  return result;
}

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let router: Router;
  let auth: AuthStub;

  beforeEach(() => {
    auth = { getData: vi.fn(), loadUserInfo: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: auth },
        { provide: Logging, useValue: { routing: vi.fn(), warn: vi.fn(), info: vi.fn() } },
      ],
    });

    guard = TestBed.inject(RoleGuard);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function redirectUrl(result: GuardResult): string {
    expect(result).toBeInstanceOf(RedirectCommand);
    return router.serializeUrl((result as RedirectCommand).redirectTo);
  }

  it('allows an ADMIN into /admin', () => {
    auth.getData.mockReturnValue(ADMIN);

    expect(guard.canActivate(route('admin'), state('/admin'))).toBe(true);
  });

  it('sends an ADMIN who tries /worker to /forbidden', () => {
    auth.getData.mockReturnValue(ADMIN);

    expect(redirectUrl(guard.canActivate(route('worker'), state('/worker')) as GuardResult)).toBe(
      '/forbidden',
    );
  });

  it('allows a WORKER into /worker', () => {
    auth.getData.mockReturnValue(WORKER);

    expect(guard.canActivate(route('worker'), state('/worker'))).toBe(true);
  });

  it('sends a WORKER who tries /admin to /forbidden', () => {
    auth.getData.mockReturnValue(WORKER);

    expect(redirectUrl(guard.canActivate(route('admin'), state('/admin')) as GuardResult)).toBe(
      '/forbidden',
    );
  });

  it('redirects to /forbidden when lazy user data loading returns 403', async () => {
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    const result = await resolve(guard.canActivate(route('admin'), state('/admin/orders')));

    expect(redirectUrl(result)).toBe('/forbidden');
  });

  it('redirects to login with returnUrl when lazy user data loading returns 401', async () => {
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    const result = await resolve(guard.canActivate(route('admin'), state('/admin/orders')));

    expect(redirectUrl(result)).toBe('/login?returnUrl=%2Fadmin%2Forders');
  });

  it('redirects to /server-error when lazy user data loading fails with 503', async () => {
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));

    const result = await resolve(guard.canActivate(route('admin'), state('/admin')));

    expect(redirectUrl(result)).toBe('/server-error');
  });

  it('checks the role of lazily loaded user data', async () => {
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(of(WORKER) as unknown as Observable<UserInfo>);

    const result = await resolve(guard.canActivate(route('admin'), state('/admin')));

    expect(redirectUrl(result)).toBe('/forbidden');
  });
});
