import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, GuardResult, MaybeAsync, RedirectCommand, Router } from '@angular/router';
import { AuthService } from '@services/authentication/auth-service';
import { LoggingService } from '@app/core/services/logging/logging-service';

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);
  private loggingService = inject(LoggingService);

  canActivate(route: ActivatedRouteSnapshot): MaybeAsync<GuardResult> {
    const userData = this.authService.getData();

    if (!userData) {
      this.loggingService.error("RoleGuard: User data is undefined");
      return new RedirectCommand(this.router.parseUrl('/login'));
    }

    const isAdmin = userData.role === 'ADMIN';
    this.loggingService.routing('RoleGuard: User role:', userData.role, 'isAdmin:', isAdmin);

    const targetRoute = route.routeConfig?.path;
    this.loggingService.routing('RoleGuard: Target route:', targetRoute);

    if (isAdmin) {
      if (targetRoute === 'admin') {
        this.loggingService.routing('RoleGuard: Admin user allowed access to /admin');
        return true;
      } else {
        this.loggingService.warn('RoleGuard: Admin user attempted to access worker route, redirecting to /admin');
        return new RedirectCommand(this.router.parseUrl('/admin'));
      }
    }

    if (targetRoute === 'worker') {
      this.loggingService.routing('RoleGuard: Worker user allowed access to /worker');
      return true;
    } else {
      this.loggingService.warn('RoleGuard: Worker user attempted to access admin route, redirecting to /worker');
      return new RedirectCommand(this.router.parseUrl('/worker'));
    }
  }
}
