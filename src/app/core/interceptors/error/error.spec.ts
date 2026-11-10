/**
 * Tests for the global error interceptor (auth-aware status handling).
 *
 * Feature: Translates bodyless 401/403/5xx HTTP failures into the correct
 * recovery path.
 * Contract:
 *  - 401 on a non-auth request → ONE `POST auth/refresh`, then the original
 *    request is replayed once with the new bearer token (caller sees success)
 *  - 401 when the refresh fails → session cleared, `/login?returnUrl=<current>`,
 *    and the original error is propagated to the caller
 *  - concurrent 401s share a single refresh call
 *  - the outcome of the REPLAY is classified on its own:
 *      · 2xx → caller receives the value, no navigation, session untouched
 *      · 401 → session cleared, `/login?returnUrl=<current>`, no second refresh
 *      · 403 → `/forbidden`, session preserved
 *      · 0 / 5xx → `/server-error`, session preserved
 *    and the replay error is always propagated to the caller
 *  - 403 → `/forbidden`, error still propagated
 *  - 5xx / status 0 on the first attempt → no auth redirect,
 *    `ServerStatus.reportNetworkError()`
 *  - 401 from auth endpoints (`auth/login`, `auth/refresh`, …) never refreshes
 *    and never redirects
 *  - 401 while already on `/login` never redirects (no loop)
 *
 * Approach: TestBed with the real interceptor, real Auth and real Router;
 * HTTP is faked with HttpTestingController. Assert exact request counts,
 * Authorization headers, emitted payloads, cookie/token state and serialized
 * redirect URLs.
 */
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Router, UrlTree, provideRouter } from '@angular/router';
import type { MockInstance } from 'vitest';

import { errorInterceptor, isAuthEndpoint } from './error';
import { Auth } from '@services/auth/auth';
import { AuthResponse } from '@models/dto/auth/auth-response';
import { Logging } from '@core/services/logging/logging';
import { ServerStatus } from '@core/services/server-status/server-status';

@Component({ template: '', standalone: true })
class Blank {
  readonly kind = 'blank';
}

const ROUTES = [
  { path: 'login', component: Blank },
  { path: 'forbidden', component: Blank },
  { path: 'server-error', component: Blank },
  { path: 'admin/orders', component: Blank },
  { path: 'admin', component: Blank },
];

function authResponse(accessToken: string): AuthResponse {
  return {
    type: 'SUCCESS',
    username: 'admin',
    accessToken,
    refreshToken: `${accessToken}-refresh`,
  };
}

function clearCookies(): void {
  for (const name of ['rms_access', 'rms_refresh', 'rms_token_expiry']) {
    document.cookie = `${name}=; path=/; max-age=0`;
  }
}

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let navigateSpy: MockInstance<Router['navigateByUrl']>;
  let serverStatus: {
    reportSuccess: ReturnType<typeof vi.fn>;
    reportNetworkError: ReturnType<typeof vi.fn>;
  };

  function redirects(): string[] {
    return navigateSpy.mock.calls.map((call) => router.serializeUrl(call[0] as UrlTree));
  }

  beforeEach(async () => {
    clearCookies();
    document.cookie = 'rms_refresh=refresh-1; path=/; max-age=600';

    serverStatus = { reportSuccess: vi.fn(), reportNetworkError: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter(ROUTES),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        Auth,
        {
          provide: Logging,
          useValue: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            auth: vi.fn(),
            routing: vi.fn(),
            http: vi.fn(),
            setLogLevel: vi.fn(),
          },
        },
        { provide: ServerStatus, useValue: serverStatus },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    await router.navigateByUrl('/admin/orders');
    navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
    clearCookies();
    TestBed.resetTestingModule();
  });

  it('retries the original request once with the refreshed token after a 401', () => {
    const received: unknown[] = [];
    http.get('v1/products').subscribe((body) => received.push(body));

    const first = httpMock.expectOne('v1/products');
    expect(first.request.headers.has('Authorization')).toBe(false);
    first.flush(null, { status: 401, statusText: 'Unauthorized' });

    const refresh = httpMock.expectOne('auth/refresh');
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.headers.get('Authorization')).toBe('Bearer refresh-1');
    refresh.flush(authResponse('access-2'));

    const retried = httpMock.expectOne('v1/products');
    expect(retried.request.method).toBe('GET');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer access-2');
    retried.flush([{ id: 1 }]);

    expect(received).toEqual([[{ id: 1 }]]);
    expect(redirects()).toEqual([]);
  });

  it('does not surface the 401 to the caller when the refresh succeeds', () => {
    const errors: unknown[] = [];
    http.get('v1/products').subscribe({ error: (err: unknown) => errors.push(err) });

    httpMock.expectOne('v1/products').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('auth/refresh').flush(authResponse('access-2'));
    httpMock.expectOne('v1/products').flush([]);

    expect(errors).toEqual([]);
  });

  it('shares ONE refresh call between concurrent 401s and retries both requests', () => {
    const bodies: unknown[] = [];
    http.get('v1/a').subscribe((body) => bodies.push(body));
    http.get('v1/b').subscribe((body) => bodies.push(body));

    httpMock.expectOne('v1/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('v1/b').flush(null, { status: 401, statusText: 'Unauthorized' });

    const refreshes = httpMock.match('auth/refresh');
    expect(refreshes.length).toBe(1);
    refreshes[0].flush(authResponse('access-2'));

    const retriedA = httpMock.expectOne('v1/a');
    const retriedB = httpMock.expectOne('v1/b');
    expect(retriedA.request.headers.get('Authorization')).toBe('Bearer access-2');
    expect(retriedB.request.headers.get('Authorization')).toBe('Bearer access-2');

    retriedA.flush(['a']);
    retriedB.flush(['b']);

    expect(bodies).toEqual([['a'], ['b']]);
  });

  it('clears the session and redirects to login with returnUrl when the refresh fails', () => {
    const errors: number[] = [];
    const auth = TestBed.inject(Auth);
    http
      .get('v1/products')
      .subscribe({ error: (err: { status: number }) => errors.push(err.status) });

    httpMock.expectOne('v1/products').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(redirects()).toEqual(['/login?returnUrl=%2Fadmin%2Forders']);
    expect(errors).toEqual([401]);
    expect(auth.getToken()).toBeUndefined();
    expect(document.cookie).not.toContain('rms_refresh=refresh-1');
  });

  /**
   * Drives the common prefix of a retried request: original 401 → successful
   * refresh → the replay is issued and left PENDING for the caller to settle.
   */
  function refreshThenReplay(url = 'v1/products'): { received: unknown[]; errors: number[] } {
    const received: unknown[] = [];
    const errors: number[] = [];
    http.get(url).subscribe({
      next: (body: unknown) => received.push(body),
      error: (err: { status: number }) => errors.push(err.status),
    });

    httpMock.expectOne(url).flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('auth/refresh').flush(authResponse('access-2'));
    return { received, errors };
  }

  it('delivers the replayed response to the caller without navigating', () => {
    const { received, errors } = refreshThenReplay();

    httpMock.expectOne('v1/products').flush([{ id: 7 }]);

    expect(received).toEqual([[{ id: 7 }]]);
    expect(errors).toEqual([]);
    expect(redirects()).toEqual([]);
    expect(TestBed.inject(Auth).getToken()).toBe('access-2');
  });

  it('redirects a 403 on the replay to /forbidden and keeps the session', () => {
    const auth = TestBed.inject(Auth);
    const { received, errors } = refreshThenReplay();

    httpMock.expectOne('v1/products').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(redirects()).toEqual(['/forbidden']);
    expect(errors).toEqual([403]);
    expect(received).toEqual([]);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getToken()).toBe('access-2');
    expect(document.cookie).toContain('rms_access=access-2');
    expect(document.cookie).toContain('rms_refresh=access-2-refresh');
    httpMock.expectNone('auth/refresh');
  });

  it('redirects a 500 on the replay to /server-error and keeps the session', () => {
    const auth = TestBed.inject(Auth);
    const { received, errors } = refreshThenReplay();

    httpMock.expectOne('v1/products').flush(null, {
      status: 500,
      statusText: 'Server Error',
    });

    expect(redirects()).toEqual(['/server-error']);
    expect(errors).toEqual([500]);
    expect(received).toEqual([]);
    expect(auth.getToken()).toBe('access-2');
    expect(document.cookie).toContain('rms_access=access-2');
    httpMock.expectNone('auth/refresh');
  });

  it('redirects a network failure (status 0) on the replay to /server-error and keeps the session', () => {
    const auth = TestBed.inject(Auth);
    const { received, errors } = refreshThenReplay();

    httpMock.expectOne('v1/products').error(new ProgressEvent('error'));

    expect(redirects()).toEqual(['/server-error']);
    expect(errors).toEqual([0]);
    expect(received).toEqual([]);
    expect(auth.getToken()).toBe('access-2');
    expect(document.cookie).toContain('rms_access=access-2');
    httpMock.expectNone('auth/refresh');
  });

  it('clears the session and goes to login when the replay itself is rejected with 401, without a second refresh', () => {
    const auth = TestBed.inject(Auth);
    const { received, errors } = refreshThenReplay();

    httpMock.expectOne('v1/products').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(redirects()).toEqual(['/login?returnUrl=%2Fadmin%2Forders']);
    expect(errors).toEqual([401]);
    expect(received).toEqual([]);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getToken()).toBeUndefined();
    expect(document.cookie).not.toContain('rms_access=access-2');
    expect(document.cookie).not.toContain('rms_refresh');
    // One refresh was already spent — a 401 on the replay must not refresh again.
    httpMock.expectNone('auth/refresh');
  });

  it('redirects a 403 to /forbidden and propagates the error', () => {
    const errors: number[] = [];
    http
      .get('v1/admin-only')
      .subscribe({ error: (err: { status: number }) => errors.push(err.status) });

    httpMock.expectOne('v1/admin-only').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(redirects()).toEqual(['/forbidden']);
    expect(errors).toEqual([403]);
  });

  it('does not redirect auth failures that come from a server error', () => {
    const errors: number[] = [];
    http
      .get('v1/products')
      .subscribe({ error: (err: { status: number }) => errors.push(err.status) });

    httpMock.expectOne('v1/products').flush(null, { status: 500, statusText: 'Server Error' });

    expect(redirects()).toEqual([]);
    expect(errors).toEqual([500]);
    expect(serverStatus.reportNetworkError).toHaveBeenCalledTimes(1);
    httpMock.expectNone('auth/refresh');
  });

  it('reports a network failure (status 0) to ServerStatus without auth redirect', () => {
    const errors: number[] = [];
    http
      .get('v1/products')
      .subscribe({ error: (err: { status: number }) => errors.push(err.status) });

    httpMock.expectOne('v1/products').error(new ProgressEvent('error'));

    expect(errors).toEqual([0]);
    expect(redirects()).toEqual([]);
    expect(serverStatus.reportNetworkError).toHaveBeenCalledTimes(1);
  });

  it('never refreshes nor redirects for a 401 coming from auth/login', () => {
    const errors: number[] = [];
    http.post('auth/login', { username: 'a', password: 'b' }).subscribe({
      error: (err: { status: number }) => errors.push(err.status),
    });

    httpMock.expectOne('auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone('auth/refresh');
    expect(redirects()).toEqual([]);
    expect(errors).toEqual([401]);
  });

  it('never refreshes for a 401 coming from auth/refresh itself', () => {
    const errors: number[] = [];
    http
      .post('auth/refresh', {})
      .subscribe({ error: (err: { status: number }) => errors.push(err.status) });

    httpMock.expectOne('auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectNone('auth/refresh');

    expect(redirects()).toEqual([]);
    expect(errors).toEqual([401]);
  });

  it('does not redirect to /login when the user is already there', async () => {
    navigateSpy.mockRestore();
    await router.navigateByUrl('/login');
    navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    http.get('v1/products').subscribe({ error: () => undefined });
    httpMock.expectOne('v1/products').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(redirects()).toEqual([]);
  });
});

describe('isAuthEndpoint', () => {
  it('matches an absolute auth URL (production shape after urlInterceptor)', () => {
    expect(isAuthEndpoint('https://api.rms.aros.services/api/auth/refresh')).toBe(true);
  });

  it('matches a relative auth URL', () => {
    expect(isAuthEndpoint('auth/login')).toBe(true);
  });

  it('matches an auth URL with query params', () => {
    expect(isAuthEndpoint('https://api.rms.aros.services/api/auth/reset-password?token=abc')).toBe(
      true,
    );
  });

  it('does not match a business endpoint', () => {
    expect(isAuthEndpoint('v1/products')).toBe(false);
  });

  it('does not match the user-info endpoint used to hydrate the session', () => {
    expect(isAuthEndpoint('https://api.rms.aros.services/api/auth')).toBe(false);
  });

  it('does not match a path that only starts like an auth endpoint', () => {
    expect(isAuthEndpoint('v1/auth/refresh-tokens')).toBe(false);
  });
});
