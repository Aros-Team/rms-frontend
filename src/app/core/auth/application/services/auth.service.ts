import { Injectable, signal, computed } from '@angular/core';
import { Observable, of, throwError, delay } from 'rxjs';
import { User, UserRole, UserArea, AuthResponse, AuthCredentials } from '../../domain/models/user.model';

const AUTH_STORAGE_KEY = 'rms_auth';

const MOCK_USERS: Record<string, { password: string; user: User }> = {
  'admin@rms.com': {
    password: 'admin123',
    user: { username: 'admin@rms.com', role: UserRole.ADMIN, areas: [] }
  },
  'mesero@rms.com': {
    password: 'mesero123',
    user: { username: 'mesero@rms.com', role: UserRole.WORKER, areas: [UserArea.SERVICE] }
  },
  'cocina@rms.com': {
    password: 'cocina123',
    user: { username: 'cocina@rms.com', role: UserRole.WORKER, areas: [UserArea.KITCHEN] }
  },
  'bar@rms.com': {
    password: 'bar123',
    user: { username: 'bar@rms.com', role: UserRole.WORKER, areas: [UserArea.BAR] }
  }
};

function generateToken(): string {
  return 'mock_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUser = signal<User | null>(this.loadUserFromStorage());
  private readonly accessToken = signal<string | null>(this.loadTokenFromStorage());

  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => !!this.currentUser());
  readonly userRole = computed(() => this.currentUser()?.role ?? null);
  readonly userAreas = computed(() => this.currentUser()?.areas ?? []);

  login(credentials: AuthCredentials): Observable<AuthResponse> {
    const mockUser = MOCK_USERS[credentials.username];

    if (!mockUser || mockUser.password !== credentials.password) {
      return throwError(() => new Error('Credenciales inválidas')).pipe(delay(500));
    }

    const accessToken = generateToken();
    const refreshToken = generateToken();

    const response: AuthResponse = {
      type: 'SUCCESS',
      username: mockUser.user.username,
      accessToken,
      refreshToken,
      user: mockUser.user
    };

    this.saveToStorage(response);
    this.currentUser.set(mockUser.user);
    this.accessToken.set(accessToken);

    return of(response).pipe(delay(500));
  }

  logout(): void {
    this.clearStorage();
    this.currentUser.set(null);
    this.accessToken.set(null);
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  getUser(): User | null {
    return this.currentUser();
  }

  hasArea(area: UserArea): boolean {
    return this.userAreas().includes(area);
  }

  isAdmin(): boolean {
    return this.userRole() === UserRole.ADMIN;
  }

  private loadUserFromStorage(): User | null {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const auth = JSON.parse(stored);
        return auth.user;
      }
    } catch {
      return null;
    }
    return null;
  }

  private loadTokenFromStorage(): string | null {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const auth = JSON.parse(stored);
        return auth.accessToken;
      }
    } catch {
      return null;
    }
    return null;
  }

  private saveToStorage(response: AuthResponse): void {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response));
  }

  private clearStorage(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}
