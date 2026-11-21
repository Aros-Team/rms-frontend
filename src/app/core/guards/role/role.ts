import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  GuardResult,
  MaybeAsync,
  RedirectCommand,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { UserInfo } from '@models/domain/user/user-info';
import { redirectForFailure } from '@shared/lib/auth-navigation/auth-navigation';

/**
 * Enforces the role of the top-level area (`/admin` vs `/worker`).
 *
 * A role mismatch is a permission failure, so it lands on `/forbidden` (403
 * semantics), never on `/server-error`. Loading the user data follows the same
 * matrix as {@link AuthGuard}.
 */
@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  private authService = inject(Auth);
  private router = inject(Router);
  private logger = inject(Logging);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): MaybeAsync<GuardResult> {
    const userData = this.authService.getData();
    if (userData) {
      return this.checkRole(userData, route);
    }
    return this.authService.loadUserInfo().pipe(
      map((u) => this.checkRole(u, route)),
      catchError((err: unknown) =>
        of<RedirectCommand>(redirectForFailure(this.router, err, state.url)),
      ),
    );
  }

  private checkRole(userData: UserInfo | undefined, route: ActivatedRouteSnapshot): GuardResult {
    if (!userData) {
      return new RedirectCommand(this.router.parseUrl('/login'));
    }

    const isAdmin = userData.role === 'ADMIN';
    this.logger.routing('RoleGuard: User role:', userData.role, 'isAdmin:', isAdmin);

    const targetRoute = route.routeConfig?.path;
    this.logger.routing('RoleGuard: Target route:', targetRoute);

    const allowedRoute = isAdmin ? 'admin' : 'worker';
    if (targetRoute === allowedRoute) {
      this.logger.routing(`RoleGuard: ${userData.role} user allowed access to /${targetRoute}`);
      return true;
    }

    this.logger.warn(
      `RoleGuard: ${userData.role} user attempted to access /${String(targetRoute)}, redirecting to /forbidden`,
    );
    return new RedirectCommand(this.router.parseUrl('/forbidden'));
  }
}
