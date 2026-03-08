import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';
import { AuthService } from '../../../core/auth/application/services/auth.service';
import { AuthResponse, AuthCredentials, UserRole, UserArea } from '../../../core/auth/domain/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isLoggedIn = this.authService.isLoggedIn;
  readonly userRole = this.authService.userRole;
  readonly userAreas = this.authService.userAreas;

  login(credentials: AuthCredentials): Observable<AuthResponse> {
    this.loading.set(true);
    this.error.set(null);

    return this.authService.login(credentials).pipe(
      tap((response) => {
        this.loading.set(false);
        this.redirectByRole(response.user.role, response.user.areas);
      }),
      catchError((err) => {
        this.loading.set(false);
        this.error.set(err.message || 'Error al iniciar sesión');
        return of(null as unknown as AuthResponse);
      })
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  hasArea(area: UserArea): boolean {
    return this.authService.hasArea(area);
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  private redirectByRole(role: UserRole, areas: UserArea[]): void {
    if (role === UserRole.ADMIN) {
      this.router.navigate(['/admin/products']);
      return;
    }

    if (areas.includes(UserArea.KITCHEN)) {
      this.router.navigate(['/kitchen']);
      return;
    }

    this.router.navigate(['/']);
  }
}
