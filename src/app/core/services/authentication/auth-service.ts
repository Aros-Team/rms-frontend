import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap, throwError, BehaviorSubject } from 'rxjs';
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

  private token: string | undefined = localStorage.getItem('access') || undefined;
  private data?: UserInfo;
  
  private tfaTokenSubject = new BehaviorSubject<string | null>(null);
  tfaToken$ = this.tfaTokenSubject.asObservable();
  
  private pendingUsername: string | null = null;

  constructor() {
    this.loggingService.auth('AuthService initialized - token exists:', !!this.token);
    this.loggingService.auth('AuthService initialized - access token:', this.token);
    this.loggingService.auth('AuthService initialized - refresh token:', localStorage.getItem('refresh'));

    if (this.token && !this.data) {
      this.loggingService.auth('Token exists but no user data, will load user info after initialization');
      setTimeout(() => {
        this.getUserInfo();
      }, 0);
    }
  }

  login(credentials: AuthRequest): Observable<AuthResponse> {
    const deviceHash = this.fingerprintService.getDeviceHash();
    this.loggingService.auth('Login called with username:', credentials.username, 'deviceHash:', deviceHash);

    return this.http
      .post<AuthResponse>('auth/login', {
        username: credentials.username,
        password: credentials.password,
        deviceHash: deviceHash,
      })
      .pipe(
        tap((response: AuthResponse) => {
          this.loggingService.auth('Login response received - type:', response.type);
          
          if (response.type === 'TFA_REQUIRED') {
            this.loggingService.auth('TFA required - saving TFA token');
            this.tfaTokenSubject.next(response.accessToken);
            this.pendingUsername = response.username;
          } else {
            this.loggingService.auth('Login successful - saving tokens');
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

    this.loggingService.auth('Verifying 2FA code for user:', this.pendingUsername);

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
          this.loggingService.auth('2FA verification successful - saving tokens');
          this.tfaTokenSubject.next(null);
          this.pendingUsername = null;
          this.saveTokens(response.accessToken, response.refreshToken);
          this.getUserInfo();
        }),
      );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem('refresh');
    this.loggingService.auth('Refresh called - refresh token exists:', !!refreshToken);

    return this.http.post<AuthResponse>('auth/refresh', {}, {
      headers: {
        'Authorization': `Bearer ${refreshToken}`
      }
    }).pipe(
      tap((response: AuthResponse) => {
        this.loggingService.auth('Refresh successful - new tokens received');
        this.saveTokens(response.accessToken, response.refreshToken);
        this.loggingService.auth('Tokens saved, calling getUserInfo');
        this.getUserInfo();
      }),
    );
  }

  logout(): void {
    this.token = undefined;
    this.data = undefined;
    this.tfaTokenSubject.next(null);
    this.pendingUsername = null;
    localStorage.removeItem('refresh');
    localStorage.removeItem('access');
  }

  isAuthenticated(): boolean {
    return this.token != undefined;
  }

  getToken(): string | undefined {
    return this.token;
  }

  getData(): UserInfo | undefined {
    this.loggingService.debug('getData called - current data:', this.data);
    return this.data;
  }

  private saveTokens(accessToken: string, refreshToken: string | null): void {
    this.token = accessToken;
    localStorage.setItem('access', accessToken);
    if (refreshToken) {
      localStorage.setItem('refresh', refreshToken);
    }
  }

  private getUserInfo(): void {
    this.loggingService.auth('getUserInfo called - current token exists:', !!this.token);
    this.http.get<UserInfo>('auth').subscribe({
      next: (userInfo: UserInfo) => {
        this.loggingService.auth('getUserInfo successful - user data received');
        this.data = userInfo;
        this.loggingService.auth('User data set successfully - role:', userInfo.role);
      },
      error: (err: unknown) => {
        this.loggingService.error('Error getting user info:', err);
      }
    });
  }
}
