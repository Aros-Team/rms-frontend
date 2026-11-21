import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  GuardResult,
  MaybeAsync,
  RedirectCommand,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { Auth } from '@services/auth/auth';
import { redirectForFailure } from '@shared/lib/auth-navigation/auth-navigation';

/**
 * Protects authenticated areas.
 *
 * Failure matrix (401/403 are bodyless, status is the only signal):
 *  - no session → one refresh attempt; if it fails → `/login?returnUrl=<attempted>`
 *  - session but no user data → `GET auth`; 401 → login, 403 → `/forbidden`
 *  - 5xx / network → `/server-error` (the only case that shows a server error)
 */
@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate, CanActivateChild {
  private authService = inject(Auth);
  private router = inject(Router);

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): MaybeAsync<GuardResult> {
    return this.resolve(state.url);
  }

  canActivateChild(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): MaybeAsync<GuardResult> {
    return this.resolve(state.url);
  }

  private resolve(attemptedUrl: string): MaybeAsync<GuardResult> {
    if (this.authService.isAuthenticated()) {
      if (this.authService.getData()) {
        return true;
      }
      return this.authService.loadUserInfo().pipe(
        map(() => true as GuardResult),
        catchError((err: unknown) =>
          of<RedirectCommand>(redirectForFailure(this.router, err, attemptedUrl)),
        ),
      );
    }

    return this.authService.refreshOnce().pipe(
      map(() => true as GuardResult),
      catchError((err: unknown) =>
        of<RedirectCommand>(redirectForFailure(this.router, err, attemptedUrl)),
      ),
    );
  }
}
