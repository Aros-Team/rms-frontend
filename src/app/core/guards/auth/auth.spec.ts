/**
 * Tests for the AuthGuard status matrix.
 *
 * Feature: Protects authenticated areas and routes auth failures to the correct
 * screen (the backend sends bodyless 401/403, so only the status matters).
 * Contract:
 *  - valid session + user data → access granted
 *  - no session → ONE refresh attempt; success → access, failure → login
 *  - refresh failure → `/login?returnUrl=<attempted url>` (URL-encoded)
 *  - refresh failure with 5xx → `/server-error` (only server failures show it)
 *  - session without user data → `loadUserInfo()`; 401 → login, 403 → `/forbidden`
 *
 * Approach: real Router (to build and serialize UrlTrees) + stubbed Auth
 * (external collaborator). Assert the exact serialized redirect target.
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

import { AuthGuard } from './auth';
import { Auth } from '@services/auth/auth';

interface AuthStub {
  isAuthenticated: ReturnType<typeof vi.fn>;
  getData: ReturnType<typeof vi.fn>;
  loadUserInfo: ReturnType<typeof vi.fn>;
  refreshOnce: ReturnType<typeof vi.fn>;
}

const USER = {
  id: 1,
  name: 'Ana',
  document: '1',
  email: 'a@b.c',
  role: 'ADMIN' as const,
  areas: [],
};

function snapshot(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

const ROUTE = {} as ActivatedRouteSnapshot;

async function resolve(result: MaybeAsync<GuardResult>): Promise<GuardResult> {
  if (isObservable(result)) {
    return firstValueFrom(result);
  }
  return result;
}

function isRedirect(result: GuardResult): result is RedirectCommand {
  return result instanceof RedirectCommand;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let router: Router;
  let auth: AuthStub;

  beforeEach(() => {
    auth = {
      isAuthenticated: vi.fn(),
      getData: vi.fn(),
      loadUserInfo: vi.fn(),
      refreshOnce: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });

    guard = TestBed.inject(AuthGuard);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function redirectUrl(result: GuardResult): string {
    expect(isRedirect(result)).toBe(true);
    return router.serializeUrl((result as RedirectCommand).redirectTo);
  }

  it('grants access when the session is valid and user data is loaded', () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(USER);

    expect(guard.canActivate(ROUTE, snapshot('/admin'))).toBe(true);
    expect(auth.refreshOnce).not.toHaveBeenCalled();
    expect(auth.loadUserInfo).not.toHaveBeenCalled();
  });

  it('grants access after a successful refresh when there is no session token', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.refreshOnce.mockReturnValue(
      of({ type: 'SUCCESS', accessToken: 'a2', refreshToken: 'r2' }),
    );

    const result = await resolve(guard.canActivate(ROUTE, snapshot('/admin')));

    expect(result).toBe(true);
    expect(auth.refreshOnce).toHaveBeenCalledTimes(1);
  });

  it('redirects to login with the URL-encoded returnUrl when the refresh fails', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.refreshOnce.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    const result = await resolve(guard.canActivate(ROUTE, snapshot('/admin/manage/products')));

    expect(redirectUrl(result)).toBe('/login?returnUrl=%2Fadmin%2Fmanage%2Fproducts');
  });

  it('redirects to login when the refresh fails because no refresh token exists', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.refreshOnce.mockReturnValue(throwError(() => new Error('No refresh token available')));

    const result = await resolve(guard.canActivate(ROUTE, snapshot('/worker/kitchen')));

    expect(redirectUrl(result)).toBe('/login?returnUrl=%2Fworker%2Fkitchen');
  });

  it('redirects to /server-error only when the refresh fails with a server error', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.refreshOnce.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));

    const result = await resolve(guard.canActivate(ROUTE, snapshot('/admin')));

    expect(redirectUrl(result)).toBe('/server-error');
  });

  it('redirects to /forbidden when loading user data returns 403', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    const result = await resolve(guard.canActivate(ROUTE, snapshot('/admin')));

    expect(redirectUrl(result)).toBe('/forbidden');
  });

  it('does not send a 403 to /server-error', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    const result = await resolve(guard.canActivate(ROUTE, snapshot('/admin')));

    expect(redirectUrl(result)).not.toBe('/server-error');
  });

  it('redirects to login when loading user data returns 401', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    const result = await resolve(guard.canActivate(ROUTE, snapshot('/admin/orders')));

    expect(redirectUrl(result)).toBe('/login?returnUrl=%2Fadmin%2Forders');
  });

  it('grants access when user data loads successfully', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.getData.mockReturnValue(undefined);
    auth.loadUserInfo.mockReturnValue(of(USER) as unknown as Observable<typeof USER>);

    const result = await resolve(guard.canActivate(ROUTE, snapshot('/admin')));

    expect(result).toBe(true);
  });

  it('applies the same matrix on canActivateChild', async () => {
    auth.isAuthenticated.mockReturnValue(false);
    auth.refreshOnce.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    const result = await resolve(guard.canActivateChild(ROUTE, snapshot('/admin/orders')));

    expect(redirectUrl(result)).toBe('/login?returnUrl=%2Fadmin%2Forders');
  });
});
