/**
 * Tests for the RedirectGuard (the `/login` screen guard).
 *
 * Feature: Keeps an already-authenticated user off the login screen and never
 * loops back to it when the stored session turns out to be invalid.
 * Contract:
 *  - not authenticated → the login screen is allowed (`true`)
 *  - authenticated ADMIN → `/admin`, WORKER → `/worker`
 *  - `loadUserInfo()` 401 → allow the login screen (`true`, no redirect loop)
 *  - `loadUserInfo()` 403 → `/forbidden`
 *  - `loadUserInfo()` 5xx → `/server-error`
 *
 * Approach: real Router (UrlTree serialization) + stubbed Auth and Logging;
 * assert the exact guard result.
 */
import { TestBed } from '@angular/core/testing';
import { GuardResult, MaybeAsync, RedirectCommand, Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom, isObservable, of, throwError } from 'rxjs';

import { RedirectGuard } from './redirect-guard';
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
  isAuthenticated: ReturnType<typeof vi.fn>;
  getData: ReturnType<typeof vi.fn>;
  loadUserInfo: ReturnType<typeof vi.fn>;
}

async function resolve(result: MaybeAsync<GuardResult>): Promise<GuardResult> {
  if (isObservable(result)) {
    return firstValueFrom(result);
  }
  return result;
}

describe('RedirectGuard', () => {
  let guard: RedirectGuard;
  let router: Router;
  let auth: AuthStub;

  beforeEach(() => {
    auth = {
      isAuthenticated: vi.fn(),
      getData: vi.fn(),
      loadUserInfo: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: auth },
        { provide: Logging, useValue: { routing: vi.fn(), warn: vi.fn(), info: vi.fn() } },
      ],
    });

    guard = TestBed.inject(RedirectGuard);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function redirectUrl(result: GuardResult): string {
    expect(result).toBeInstanceOf(RedirectCommand);
    return router.serializeUrl((result as RedirectCommand).redirectTo);
  }

  it('allows the login screen when there is no session', () => {
    auth.isAuthenticated.mockReturnValue(false);

    expect(guard.canActivate()).toBe(true);
    expect(auth.loadUserInfo).not.toHaveBeenCalled();
  });

  it('sends an authenticated ADMIN to /admin', () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(ADMIN);

    expect(redirectUrl(guard.canActivate() as GuardResult)).toBe('/admin');
  });

  it('sends an authenticated WORKER to /worker', () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(WORKER);

    expect(redirectUrl(guard.canActivate() as GuardResult)).toBe('/worker');
  });

  it('allows the login screen when loadUserInfo returns 401 (no redirect loop)', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    const result = await resolve(guard.canActivate());

    expect(result).toBe(true);
  });

  it('redirects to /forbidden when loadUserInfo returns 403', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    const result = await resolve(guard.canActivate());

    expect(redirectUrl(result)).toBe('/forbidden');
  });

  it('redirects to /server-error when loadUserInfo fails with a server error', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    const result = await resolve(guard.canActivate());

    expect(redirectUrl(result)).toBe('/server-error');
  });

  it('redirects to the area of the user loaded lazily', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(of(ADMIN) as unknown as Observable<UserInfo>);

    const result = await resolve(guard.canActivate());

    expect(redirectUrl(result)).toBe('/admin');
  });
});
