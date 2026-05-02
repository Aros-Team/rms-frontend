import { HttpClient } from '@angular/common/http';
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap, throwError, BehaviorSubject, catchError } from 'rxjs';
import { UserInfo } from '@models/domain/user/user-info.model';
import { AuthRequest } from '@models/dto/auth/auth-request.model';
import { AuthResponse } from '@models/dto/auth/auth-response.model';
import { TwoFactorVerifyRequest } from '@models/dto/auth/two-factor-verify-request.model';
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
  private _userData?: UserInfo;
  
  private tfaTokenSubject = new BehaviorSubject<string | null>(null);
  tfaToken$ = this.tfaTokenSubject.asObservable();
  
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
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
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
        this.logger.info('Session restored successfully');
        
        if (this._userData === undefined) {
          setTimeout(() => {
            this.getUserInfo();
          }, 0);
        }
      } else {
        this.logger.info('Token expired, clearing session');
        this.clearStorage();
      }
    }
  }

  login(credentials: AuthRequest): Observable<AuthResponse> {
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
            this.getUserInfo();
          }
        }),
      );
  }

  verifyTwoFactor(code: string): Observable<AuthResponse> {
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
          this.getUserInfo();
        }),
      );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    this.logger.info('Token refresh attempted');

    return this.http.post<AuthResponse>('auth/refresh', {}, {
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      }
    }).pipe(
      tap((response: AuthResponse) => {
        this.logger.info('Token refresh successful');
        this.saveTokens(response.accessToken, response.refreshToken);
        this.getUserInfo();
      }),
      catchError((err) => {
        this.logger.error('Token refresh failed', err);
        this.logout();
        return throwError(() => err);
      })
    );
  }

  logout(): void {
    this._token = undefined;
    this._userData = undefined;
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
    return this._userData;
  }

  private getRefreshToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return this.getCookie(Auth.REFRESH_KEY);
    }
    return null;
  }

  private saveTokens(accessToken: string, refreshToken: string | null): void {
    this._token = accessToken;
    
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

  private getUserInfo(): void {
    this.http.get<UserInfo>('auth').subscribe({
      next: (userInfo: UserInfo) => {
        this._userData = userInfo;
        this.logger.info('User info loaded successfully');
      },
      error: (err: unknown) => {
        this.logger.error('Failed to load user info', err);
        const httpErr = err as { status?: number };
        if (httpErr.status === 401 || httpErr.status === 404) {
          this.logger.info('Session invalid, clearing');
          this.logout();
        }
      }
    });
  }
}