import { Injectable, inject } from '@angular/core';
import { CanActivate, GuardResult, MaybeAsync, Router, RedirectCommand } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { UserInfo } from '@models/domain/user/user-info';
import { redirectForFailure } from '@shared/lib/auth-navigation/auth-navigation';

/**
 * Guards the `/login` screen: an already-authenticated user is sent to their area.
 *
 * When the session exists but `GET auth` fails, this guard never redirects to
 * `/server-error` for an auth failure and never loops back to `/login`:
 *  - 401 → session cleared, the login screen is shown (`true`)
 *  - 403 → `/forbidden`
 *  - 5xx / network → `/server-error`
 */
@Injectable({
  providedIn: 'root',
})
export class RedirectGuard implements CanActivate {
  private authService = inject(Auth);
  private router = inject(Router);
  private logger = inject(Logging);

  canActivate(): MaybeAsync<GuardResult> {
    this.logger.routing('RedirectGuard: Checking authentication status');
    if (!this.authService.isAuthenticated()) {
      this.logger.routing('User not authenticated, allowing access to login');
      return true;
    }

    const userData = this.authService.getData();
    this.logger.routing('User authenticated, checking user data:', userData);

    if (userData) {
      return this.redirectFor(userData);
    }

    return this.authService.loadUserInfo().pipe(
      map((u) => this.redirectFor(u)),
      catchError((err: unknown) => {
        const result = redirectForFailure(this.router, err);
        // Already on /login: a failed session simply means "show the form".
        if (result.redirectTo.toString() === '/login') {
          this.logger.warn('RedirectGuard: session rejected, allowing the login screen');
          return of(true as GuardResult);
        }
        return of<RedirectCommand>(result);
      }),
    );
  }

  private redirectFor(userData: UserInfo): RedirectCommand {
    const isAdmin = userData.role === 'ADMIN';
    if (isAdmin) {
      return new RedirectCommand(this.router.parseUrl('/admin'));
    }
    return new RedirectCommand(this.router.parseUrl('/worker'));
  }
}
