import { HttpClient } from '@angular/common/http';
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap, throwError, BehaviorSubject, catchError } from 'rxjs';
import { UserInfo } from '@models/domain/user/user-info.model';
import { AuthRequest } from '@models/dto/auth/auth-request.model';
import { AuthResponse } from '@models/dto/auth/auth-response.model';
import { TwoFactorVerifyRequest } from '@models/dto/auth/two-factor-verify-request.model';
import { LoggingService } from '@app/core/services/logging/logging-service';
import { FingerprintService } from '@app/core/services/fingerprint/fingerprint.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private loggingService = inject(LoggingService);
  private fingerprintService = inject(FingerprintService);
  private platformId = inject(PLATFORM_ID);

  private _token: string | undefined;
  private _userData?: UserInfo;
  
  private tfaTokenSubject = new BehaviorSubject<string | null>(null);
  tfaToken$ = this.tfaTokenSubject.asObservable();
  
  private pendingUsername: string | null = null;

  private static readonly ACCESS_KEY = 'rms_access';
  private static readonly REFRESH_KEY = 'rms_refresh';
  private static readonly EXPIRY_KEY = 'rms_token_expiry';

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadStoredToken();
    }
  }

  private loadStoredToken(): void {
    const expiry = localStorage.getItem(AuthService.EXPIRY_KEY);
    const storedToken = localStorage.getItem(AuthService.ACCESS_KEY);
    
    if (storedToken && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        this._token = storedToken;
        this.loggingService.info('Session restored successfully');
        
        if (this._userData === undefined) {
          this.getUserInfo();
        }
      } else {
        this.loggingService.info('Token expired, clearing session');
        this.clearStorage();
      }
    }
  }

  login(credentials: AuthRequest): Observable<AuthResponse> {
    const deviceHash = this.fingerprintService.getDeviceHash();
    this.loggingService.info('Login attempt initiated');

    return this.http
      .post<AuthResponse>('auth/login', {
        username: credentials.username,
        password: credentials.password,
        deviceHash: deviceHash,
      })
      .pipe(
        tap((response: AuthResponse) => {
          this.loggingService.info('Login response received');
          
          if (response.type === 'TFA_REQUIRED') {
            this.loggingService.info('TFA required');
            this.tfaTokenSubject.next(response.accessToken);
            this.pendingUsername = response.username;
          } else {
            this.loggingService.info('Login successful, saving session');
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
      this.loggingService.error('TFA token not found');
      return throwError(() => new Error('TFA token not found'));
    }

    this.loggingService.info('Verifying 2FA code');

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
          this.loggingService.info('2FA verification successful');
          this.tfaTokenSubject.next(null);
          this.pendingUsername = null;
          this.saveTokens(response.accessToken, response.refreshToken);
          this.getUserInfo();
        }),
      );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    this.loggingService.info('Token refresh attempted');

    return this.http.post<AuthResponse>('auth/refresh', {}, {
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      }
    }).pipe(
      tap((response: AuthResponse) => {
        this.loggingService.info('Token refresh successful');
        this.saveTokens(response.accessToken, response.refreshToken);
        this.getUserInfo();
      }),
      catchError((err) => {
        this.loggingService.error('Token refresh failed', err);
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
    this.loggingService.info('User logged out');
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
      return localStorage.getItem(AuthService.REFRESH_KEY);
    }
    return null;
  }

  private saveTokens(accessToken: string, refreshToken: string | null): void {
    this._token = accessToken;
    
    if (isPlatformBrowser(this.platformId)) {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const expiry = Date.now() + sevenDaysMs;
      
      localStorage.setItem(AuthService.ACCESS_KEY, accessToken);
      localStorage.setItem(AuthService.EXPIRY_KEY, expiry.toString());
      
      if (refreshToken) {
        localStorage.setItem(AuthService.REFRESH_KEY, refreshToken);
      }
    }
  }

  private clearStorage(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(AuthService.ACCESS_KEY);
      localStorage.removeItem(AuthService.REFRESH_KEY);
      localStorage.removeItem(AuthService.EXPIRY_KEY);
    }
  }

  private getUserInfo(): void {
    this.http.get<UserInfo>('auth').subscribe({
      next: (userInfo: UserInfo) => {
        this._userData = userInfo;
        this.loggingService.info('User info loaded successfully');
      },
      error: (err: unknown) => {
        this.loggingService.error('Failed to load user info', err);
        const httpErr = err as { status?: number };
        if (httpErr.status === 401 || httpErr.status === 404) {
          this.loggingService.info('Session invalid, clearing');
          this.logout();
        }
      }
    });
  }
}
