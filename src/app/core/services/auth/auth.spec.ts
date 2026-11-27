/**
 * Tests for the Auth service token refresh (single-flight contract).
 *
 * Feature: `refreshOnce()` wraps `refresh()` so concurrent 401 handlers share a
 * single `POST auth/refresh` instead of firing one request each.
 * Contract:
 *  - two concurrent `refreshOnce()` calls → exactly ONE POST auth/refresh
 *  - both subscribers receive the same refreshed access token
 *  - the refresh call carries `Authorization: Bearer <refresh token>`
 *  - after the flight settles, a new `refreshOnce()` starts a NEW request
 *  - with no stored refresh token, no HTTP call is made and the session is cleared
 *
 * Approach: TestBed + HttpTestingController (real Auth, HTTP mocked at the
 * boundary); assert the exact request count, headers and emitted values.
 */
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { Auth } from './auth';
import { AuthResponse } from '@models/dto/auth/auth-response';
import { AuthRequest } from '@models/dto/auth/auth-request';
import { provideRouter } from '@angular/router';
import { jwtInterceptor } from '@core/interceptors/jwt/jwt';
import { errorInterceptor } from '@core/interceptors/error/error';
import { envelopeInterceptor } from '@core/interceptors/envelope/envelope';

const REFRESH_COOKIE = 'rms_refresh';
function setRefreshCookie(value: string): void {
  document.cookie = `${REFRESH_COOKIE}=${value}; path=/; max-age=600`;
}

function clearCookies(): void {
  for (const name of ['rms_access', 'rms_refresh', 'rms_token_expiry']) {
    document.cookie = `${name}=; path=/; max-age=0`;
  }
}

function authResponse(accessToken: string, refreshToken: string): AuthResponse {
  return { type: 'SUCCESS', username: 'admin', accessToken, refreshToken };
}

describe('Auth.refreshOnce', () => {
  let auth: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearCookies();
    setRefreshCookie('refresh-1');

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Auth],
    });

    auth = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    clearCookies();
    TestBed.resetTestingModule();
  });

  it('shares ONE POST auth/refresh between concurrent callers', () => {
    const received: AuthResponse[] = [];

    auth.refreshOnce().subscribe((response) => received.push(response));
    auth.refreshOnce().subscribe((response) => received.push(response));

    const refreshes = httpMock.match('auth/refresh');
    expect(refreshes.length).toBe(1);
    expect(refreshes[0].request.method).toBe('POST');
    expect(refreshes[0].request.headers.get('Authorization')).toBe('Bearer refresh-1');

    refreshes[0].flush(authResponse('access-2', 'refresh-2'));

    expect(received.length).toBe(2);
    expect(received[0].accessToken).toBe('access-2');
    expect(received[1].accessToken).toBe('access-2');
    expect(auth.getToken()).toBe('access-2');
  });

  it('starts a new refresh once the previous flight settled', () => {
    auth.refreshOnce().subscribe();
    httpMock.expectOne('auth/refresh').flush(authResponse('access-2', 'refresh-2'));

    auth.refreshOnce().subscribe();
    const second = httpMock.expectOne('auth/refresh');
    expect(second.request.headers.get('Authorization')).toBe('Bearer refresh-2');

    second.flush(authResponse('access-3', 'refresh-3'));
    expect(auth.getToken()).toBe('access-3');
  });

  it('propagates the refresh failure to every concurrent caller', () => {
    const errors: number[] = [];

    auth
      .refreshOnce()
      .subscribe({ error: (err: { status?: number }) => errors.push(err.status ?? -1) });
    auth
      .refreshOnce()
      .subscribe({ error: (err: { status?: number }) => errors.push(err.status ?? -1) });

    httpMock.expectOne('auth/refresh').flush('', { status: 401, statusText: 'Unauthorized' });

    expect(errors).toEqual([401, 401]);
    expect(auth.getToken()).toBeUndefined();
  });

  it('does not hit the network when no refresh token is stored', () => {
    clearCookies();

    let thrown: Error | undefined;
    auth.refreshOnce().subscribe({ error: (err: Error) => (thrown = err) });

    httpMock.expectNone('auth/refresh');
    expect(thrown?.message).toBe('No refresh token available');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('persists the rotated tokens for the next page load', () => {
    auth.refreshOnce().subscribe();
    httpMock.expectOne('auth/refresh').flush(authResponse('fresh-access', 'fresh-refresh'));

    expect(document.cookie).toContain('rms_access=fresh-access');
    expect(document.cookie).toContain('rms_refresh=fresh-refresh');
  });
});

/**
 * End-to-end regression for the `{"data": …}` response envelope.
 *
 * Feature: `Auth.login()` consumes the REAL wire payload the backend now sends —
 * `{"data":{"type":"SUCCESS","username":…,"accessToken":…,"refreshToken":…}}` —
 * through the real interceptor chain (`jwtInterceptor` + `errorInterceptor` +
 * `envelopeInterceptor`, in production order).
 * Contract:
 *  - the unwrapped `accessToken` is stored, so `getToken()` is it and
 *    `isAuthenticated()` is `true`
 *  - the follow-up `GET auth` is therefore sent WITH `Authorization: Bearer <token>`
 *  - `login()` emits the user info resolved from that follow-up call
 * This is the test that would have caught the outage: without envelope
 * unwrapping `type` is `undefined`, no tokens are saved, `isAuthenticated()` is
 * false and `GET auth` goes out unauthenticated (bodyless 401 → logout).
 *
 * Approach: TestBed with the real interceptors and the real Auth; HTTP faked at
 * the boundary with HttpTestingController flushing the live payload shape;
 * assert token state, the Authorization header and the emitted value.
 */
describe('Auth.login with the real {"data": …} envelope', () => {
  const ACCESS_TOKEN =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJlc3RyaWN0ZWQiOmZhbHNlfQ.c2lnbmF0dXJl';
  const USER_INFO = {
    id: 'u-1',
    username: 'admin@dev.local',
    role: 'ADMIN',
    restricted: false,
  };

  let auth: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearCookies();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([jwtInterceptor, errorInterceptor, envelopeInterceptor]),
        ),
        provideHttpClientTesting(),
        provideRouter([]),
        Auth,
      ],
    });

    auth = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    clearCookies();
    TestBed.resetTestingModule();
  });

  it('stores the wrapped access token and sends the next request authenticated', () => {
    let emitted: unknown;
    auth
      .login({ username: 'admin@dev.local', password: 'secret' } as AuthRequest)
      .subscribe((value) => (emitted = value));

    httpMock.expectOne('auth/login').flush({
      data: {
        type: 'SUCCESS',
        username: 'admin@dev.local',
        accessToken: ACCESS_TOKEN,
        refreshToken: 'refresh-wrapped',
      },
    });

    const userInfoRequest = httpMock.expectOne('auth');
    expect(userInfoRequest.request.method).toBe('GET');
    expect(userInfoRequest.request.headers.get('Authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);

    userInfoRequest.flush({ data: USER_INFO });

    expect(auth.getToken()).toBe(ACCESS_TOKEN);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getData()).toEqual(USER_INFO);
    expect(emitted).toEqual(USER_INFO);
  });
});

/**
 * Feature: when an admin changes a worker's areas, the access token still
 * carries the old `areaTypes` claim while `/auth` already returns the new
 * activities. The service refreshes once so area actions do not 403.
 */
describe('Auth stale area claims', () => {
  const STALE_TOKEN = fakeJwt({ role: 'WORKER', areaTypes: ['SERVE'] });
  const FRESH_TOKEN = fakeJwt({ role: 'WORKER', areaTypes: ['PREPARATION', 'SERVE'] });
  const WORKER = {
    id: 1013,
    name: 'Renata',
    document: '1',
    email: 'renata@rms.test',
    role: 'WORKER',
    areas: [
      { id: 2, name: 'Salón', activities: ['SERVE'] },
      { id: 3, name: 'Bar', activities: ['PREPARATION', 'SERVE'] },
    ],
    areaActivities: [
      { areaId: 2, activities: ['SERVE'] },
      { areaId: 3, activities: ['PREPARATION', 'SERVE'] },
    ],
  };

  let auth: Auth;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearCookies();
    document.cookie = `rms_access=${STALE_TOKEN}; path=/; max-age=600`;
    document.cookie = `rms_token_expiry=${String(Date.now() + 3_600_000)}; path=/; max-age=600`;
    setRefreshCookie('refresh-stale');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor, envelopeInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        Auth,
      ],
    });

    auth = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    clearCookies();
    TestBed.resetTestingModule();
  });

  it('refreshes once when the token activities differ from /auth', () => {
    let emitted: unknown;
    auth.loadUserInfo().subscribe((value) => (emitted = value));

    const userRequest = httpMock.expectOne('auth');
    expect(userRequest.request.headers.get('Authorization')).toBe(`Bearer ${STALE_TOKEN}`);
    userRequest.flush({ data: WORKER });

    const refreshRequest = httpMock.expectOne('auth/refresh');
    refreshRequest.flush({ data: authResponse(FRESH_TOKEN, 'refresh-fresh') });

    expect(auth.getToken()).toBe(FRESH_TOKEN);
    expect(emitted).toEqual(WORKER);
  });

  it('does not refresh when the token already matches /auth', () => {
    document.cookie = `rms_access=${FRESH_TOKEN}; path=/; max-age=600`;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor, envelopeInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        Auth,
      ],
    });
    auth = TestBed.inject(Auth);
    httpMock = TestBed.inject(HttpTestingController);

    auth.loadUserInfo().subscribe();
    httpMock.expectOne('auth').flush({ data: WORKER });
    httpMock.expectNone('auth/refresh');

    expect(auth.getToken()).toBe(FRESH_TOKEN);
  });
});

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/=+$/u, '').replace(/\+/gu, '-').replace(/\//gu, '_');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
}
