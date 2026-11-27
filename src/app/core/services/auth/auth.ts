import { HttpClient } from '@angular/common/http';
import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Observable,
  tap,
  throwError,
  BehaviorSubject,
  catchError,
  switchMap,
  of,
  map,
  finalize,
  shareReplay,
} from 'rxjs';
import { UserInfo } from '@models/domain/user/user-info';
import { AuthRequest } from '@models/dto/auth/auth-request';
import { AuthResponse } from '@models/dto/auth/auth-response';
import { TwoFactorVerifyRequest } from '@models/dto/auth/two-factor-verify-request';
import { jwtDecode } from 'jwt-decode';
import { Logging } from '@app/core/services/logging/logging';
import { Fingerprint } from '@app/core/services/fingerprint/fingerprint';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private http = inject(HttpClient);
  private logger = inject(Logging);
  private fingerprintService = inject(Fingerprint);
  private platformId = inject(PLATFORM_ID);

  private _token: string | undefined;
  private _userData = signal<UserInfo | undefined>(undefined);
  private _restricted = signal<boolean>(false);

  /** Reactive session user, so chrome (headers, menus) updates when it loads. */
  readonly userData = this._userData.asReadonly();

  private tfaTokenSubject = new BehaviorSubject<string | null>(null);
  tfaToken$ = this.tfaTokenSubject.asObservable();

  /** In-flight refresh shared by every concurrent 401 (single-flight). */
  private refreshInFlight$: Observable<AuthResponse> | undefined;
  
  private pendingUsername: string | null = null;

  private static readonly ACCESS_KEY = 'rms_access';
  private static readonly REFRESH_KEY = 'rms_refresh';
  private static readonly EXPIRY_KEY = 'rms_token_expiry';

  private static readonly COOKIE_OPTIONS = {
    path: '/',
    sameSite: 'Strict' as const,
    secure: true,
  };

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadStoredToken();
    }
  }

  private getCookie(name: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const match = new RegExp(`(^| )${name}=([^;]+)`).exec(document.cookie);
    return match ? match[2] : null;
  }

  private setCookie(name: string, value: string, maxAgeSeconds: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const maxAge = maxAgeSeconds.toString();
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; samesite=Strict; secure`;
  }

  private deleteCookie(name: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.cookie = `${name}=; path=/; max-age=0; samesite=Strict; secure`;
  }

  private loadStoredToken(): void {
    const expiry = this.getCookie(Auth.EXPIRY_KEY);
    const storedToken = this.getCookie(Auth.ACCESS_KEY);
    
    if (storedToken && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        this._token = storedToken;
        this.extractRestrictedClaim(storedToken);
        this.logger.info('Session restored successfully');
        
        if (this._userData() === undefined) {
          setTimeout(() => {
            this.loadUserInfo();
          }, 0);
        }
      } else {
        this.logger.info('Token expired, clearing session');
        this.clearStorage();
      }
    }
  }

  login(credentials: AuthRequest): Observable<AuthResponse | UserInfo> {
    const deviceHash = this.fingerprintService.getDeviceHash();
    this.logger.info('Login attempt initiated');

    return this.http
      .post<AuthResponse>('auth/login', {
        username: credentials.username,
        password: credentials.password,
        deviceHash: deviceHash,
      })
      .pipe(
        tap((response: AuthResponse) => {
          this.logger.info('Login response received');

          if (response.type === 'TFA_REQUIRED') {
            this.logger.info('TFA required');
            this.tfaTokenSubject.next(response.accessToken);
            this.pendingUsername = response.username;
          } else {
            this.logger.info('Login successful, saving session');
            this.saveTokens(response.accessToken, response.refreshToken);
          }
        }),
        switchMap((response: AuthResponse): Observable<AuthResponse | UserInfo> => {
          if (response.type === 'TFA_REQUIRED') {
            return of(response);
          }
          return this.loadUserInfo();
        }),
      );
  }

  verifyTwoFactor(code: string): Observable<AuthResponse | UserInfo> {
    const tfaToken = this.tfaTokenSubject.value;
    const deviceHash = this.fingerprintService.getDeviceHash();

    if (!tfaToken) {
      this.logger.error('TFA token not found');
      return throwError(() => new Error('TFA token not found'));
    }

    this.logger.info('Verifying 2FA code');

    return this.http
      .post<AuthResponse>('auth/verify', {
        code: code,
        deviceHash: deviceHash,
      } as TwoFactorVerifyRequest, {
        headers: {
          'Authorization': `Bearer ${tfaToken}`
        }
      })
      .pipe(
        tap((response: AuthResponse) => {
          this.logger.info('2FA verification successful');
          this.tfaTokenSubject.next(null);
          this.pendingUsername = null;
          this.saveTokens(response.accessToken, response.refreshToken);
        }),
        switchMap((): Observable<AuthResponse | UserInfo> => {
          return this.loadUserInfo();
        }),
      );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    this.logger.info('Token refresh attempted');

    if (!refreshToken) {
      this.logger.error('No refresh token available');
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<AuthResponse>('auth/refresh', {}, {
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      }
    }).pipe(
      tap((response: AuthResponse) => {
        this.logger.info('Token refresh successful');
        this.saveTokens(response.accessToken, response.refreshToken);
        this.loadUserInfo();
      }),
      catchError((err: Error) => {
        this.logger.error('Token refresh failed', err);
        this.logout();
        return throwError(() => err);
      })
    );
  }

  /**
   * Single-flight wrapper around {@link refresh}.
   *
   * Concurrent callers (several requests failing with 401 at once, or a guard
   * racing the interceptor) share ONE `POST auth/refresh`; the resulting
   * observable is multicast. The in-flight slot is released as soon as the
   * refresh settles, so a later 401 starts a new refresh.
   */
  refreshOnce(): Observable<AuthResponse> {
    this.refreshInFlight$ ??= this.refresh().pipe(
      finalize(() => {
        this.refreshInFlight$ = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight$;
  }

  logout(): void {
    this._token = undefined;
    this._userData.set(undefined);
    this._restricted.set(false);
    this.tfaTokenSubject.next(null);
    this.pendingUsername = null;
    this.clearStorage();
    this.logger.info('User logged out');
  }

  isAuthenticated(): boolean {
    return this._token !== undefined;
  }

  getToken(): string | undefined {
    return this._token;
  }

  getData(): UserInfo | undefined {
    return this._userData();
  }

  isRestricted(): boolean {
    return this._restricted();
  }

  private extractRestrictedClaim(token: string): void {
    try {
      const decoded: { restricted?: boolean } = jwtDecode(token);
      this._restricted.set(decoded.restricted ?? false);
      this.logger.info('Auth: restricted claim:', decoded.restricted);
    } catch {
      this._restricted.set(false);
    }
  }

  private getRefreshToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return this.getCookie(Auth.REFRESH_KEY);
    }
    return null;
  }

  private saveTokens(accessToken: string, refreshToken: string | null): void {
    this._token = accessToken;
    this.extractRestrictedClaim(accessToken);
    
    if (isPlatformBrowser(this.platformId)) {
      const sevenDaysSeconds = 7 * 24 * 60 * 60;
      
      this.setCookie(Auth.ACCESS_KEY, accessToken, sevenDaysSeconds);
      this.setCookie(Auth.EXPIRY_KEY, (Date.now() + sevenDaysSeconds * 1000).toString(), sevenDaysSeconds);
      
      if (refreshToken) {
        this.setCookie(Auth.REFRESH_KEY, refreshToken, sevenDaysSeconds);
      }
    }
  }

  private clearStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.deleteCookie(Auth.ACCESS_KEY);
      this.deleteCookie(Auth.REFRESH_KEY);
      this.deleteCookie(Auth.EXPIRY_KEY);
    }
  }

  loadUserInfo(): Observable<UserInfo> {
    return this.http.get<UserInfo>('auth').pipe(
      tap((userInfo: UserInfo) => {
        this._userData.set(userInfo);
        this.logger.info('User info loaded successfully');
      }),
      switchMap((userInfo: UserInfo) => {
        if (this.getRefreshToken() === null || !this.areaClaimsAreStale(userInfo)) {
          return of(userInfo);
        }
        this.logger.info('Auth: area claims changed, refreshing the access token');
        return this.refreshOnce().pipe(
          map(() => userInfo),
          catchError((error: unknown) => {
            this.logger.error('Auth: stale area claim refresh failed', error);
            if (!this.isAuthenticated()) {
              return throwError(() => error);
            }
            return of(userInfo);
          }),
        );
      }),
      catchError((err: unknown) => {
        this.logger.error('Failed to load user info', err);
        const httpErr = err as { status?: number };
        if (httpErr.status === 401 || httpErr.status === 404) {
          this.logger.info('Session invalid, clearing');
          this.logout();
        }
        return throwError(() => err);
      }),
    );
  }

  /**
   * The access token is a snapshot of the worker's activities at login time.
   * When an admin changes the assignment, `/auth` already reports the new
   * activities but the token still carries the old claim, so area actions are
   * denied with a 403. Refreshing once realigns the token with the database.
   */
  private areaClaimsAreStale(user: UserInfo): boolean {
    const current = this.tokenAreaTypes();
    if (current === null) return false;
    const expected = this.userActivityNames(user);
    return [...new Set(current)].sort().join('|') !== [...new Set(expected)].sort().join('|');
  }

  private tokenAreaTypes(): string[] | null {
    const token = this._token;
    if (!token) return null;
    try {
      const decoded = jwtDecode<{ areaTypes?: unknown }>(token);
      if (!Array.isArray(decoded.areaTypes)) return null;
      return decoded.areaTypes.filter((value): value is string => typeof value === 'string');
    } catch {
      return null;
    }
  }

  private userActivityNames(user: UserInfo): string[] {
    const explicit = (user.areaActivities ?? []).flatMap((assignment) => assignment.activities);
    if (explicit.length > 0) return explicit;
    return user.areas.flatMap((area) => area.activities ?? []);
  }
}