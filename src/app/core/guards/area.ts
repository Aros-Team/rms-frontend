// Activity: fix/waiter-enterprise-theme-and-landing (t4)
// Routes `/worker` default to WaiterHome for SERVICE users; KITCHEN-only users are sent to `/worker/kitchen`.
import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, GuardResult, MaybeAsync, RedirectCommand, Router } from '@angular/router';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { UserInfo } from '@models/domain/user/user-info.model';

@Injectable({
  providedIn: 'root',
})
export class AreaGuard implements CanActivate {
  private authService = inject(Auth);
  private router = inject(Router);
  private logger = inject(Logging);

  canActivate(route: ActivatedRouteSnapshot): MaybeAsync<GuardResult> {
    const userData: UserInfo | undefined = this.authService.getData();
    const targetRoute = route.routeConfig?.path ?? '';

    // Default '/' inside /worker — dispatch by assigned area
    if (targetRoute === '') {
      const hasService = userData?.areas.some(a => a.type === 'SERVICE' || a.type === 'WAITER') ?? false;
      const hasKitchen = userData?.areas.some(a => a.type === 'KITCHEN') ?? false;

      if (hasService) {
        // Waiter lands on the 3-tile home
        return true;
      }
      if (hasKitchen) {
        // No SERVICE area → send to kitchen queue
        this.logger.warn(`AreaGuard: User lacks SERVICE area at /worker, redirecting to /worker/kitchen`);
        return new RedirectCommand(this.router.parseUrl('/worker/kitchen'));
      }
      // No recognized worker area → safe default
      this.logger.warn(`AreaGuard: User has no SERVICE or KITCHEN area at /worker, redirecting to profile`);
      return new RedirectCommand(this.router.parseUrl('/worker/profile'));
    }

    // profile is available to all workers
    if (targetRoute === 'profile') {
      return true;
    }

    // kitchen route requires KITCHEN area
    if (targetRoute === 'kitchen') {
      const hasKitchen = userData?.areas.some(a => a.type === 'KITCHEN') ?? false;
      const hasService = userData?.areas.some(a => a.type === 'SERVICE' || a.type === 'WAITER') ?? false;
      if (!hasKitchen) {
        if (!hasService) {
          // No kitchen AND no service → redirect to profile (safe default)
          this.logger.warn(`AreaGuard: User lacks both KITCHEN and SERVICE areas, redirecting to profile`);
          return new RedirectCommand(this.router.parseUrl('/worker/profile'));
        }
        this.logger.warn(`AreaGuard: User lacks KITCHEN area, redirecting from /worker/kitchen`);
        return new RedirectCommand(this.router.parseUrl('/worker/day-menu'));
      }
      return true;
    }

    // take-order, orders, day-menu require SERVICE area
    const serviceRoutes = ['take-order', 'orders', 'day-menu'];
    if (serviceRoutes.includes(targetRoute)) {
      const hasService = userData?.areas.some(a => a.type === 'SERVICE') ?? false;
      const hasKitchen = userData?.areas.some(a => a.type === 'KITCHEN') ?? false;
      if (!hasService) {
        if (!hasKitchen) {
          // No service AND no kitchen → redirect to profile (safe default)
          this.logger.warn(`AreaGuard: User lacks both SERVICE and KITCHEN areas, redirecting to profile`);
          return new RedirectCommand(this.router.parseUrl('/worker/profile'));
        }
        this.logger.warn(`AreaGuard: User lacks SERVICE area, redirecting from /worker/${targetRoute}`);
        return new RedirectCommand(this.router.parseUrl('/worker/kitchen'));
      }
      return true;
    }

    return true;
  }
}