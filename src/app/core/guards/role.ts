import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, GuardResult, MaybeAsync, RedirectCommand, Router } from '@angular/router';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  private authService = inject(Auth);
  private router = inject(Router);
  private logger = inject(Logging);

  canActivate(route: ActivatedRouteSnapshot): MaybeAsync<GuardResult> {
    const userData = this.authService.getData();

    if (!userData) {
      this.logger.info("RoleGuard: User data not loaded yet, waiting...");
      return new Promise<GuardResult>((resolve) => {
        const checkUserData = () => {
          const currentUserData = this.authService.getData();
          if (currentUserData) {
            resolve(this.checkRole(currentUserData, route));
          } else {
            setTimeout(checkUserData, 100);
          }
        };
        setTimeout(checkUserData, 100);
      });
    }

    return this.checkRole(userData, route);
  }

  private checkRole(userData: ReturnType<typeof this.authService.getData>, route: ActivatedRouteSnapshot): GuardResult {
    if (!userData) {
      return new RedirectCommand(this.router.parseUrl('/login'));
    }

    const isAdmin = userData.role === 'ADMIN';
    this.logger.routing('RoleGuard: User role:', userData.role, 'isAdmin:', isAdmin);

    const targetRoute = route.routeConfig?.path;
    this.logger.routing('RoleGuard: Target route:', targetRoute);

    if (isAdmin) {
      if (targetRoute === 'admin') {
        this.logger.routing('RoleGuard: Admin user allowed access to /admin');
        return true;
      } else {
        this.logger.warn('RoleGuard: Admin user attempted to access worker route, redirecting to /admin');
        return new RedirectCommand(this.router.parseUrl('/admin'));
      }
    }

    if (targetRoute === 'worker') {
      this.logger.routing('RoleGuard: Worker user allowed access to /worker');
      return true;
    } else {
      this.logger.warn('RoleGuard: Worker user attempted to access admin route, redirecting to /worker');
      return new RedirectCommand(this.router.parseUrl('/worker'));
    }
  }
}