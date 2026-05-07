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

    // profile is available to all workers
    if (targetRoute === 'profile') {
      return true;
    }

    // kitchen route requires KITCHEN area
    if (targetRoute === 'kitchen') {
      const hasKitchen = userData?.areas.some(a => a.name === 'KITCHEN') ?? false;
      if (!hasKitchen) {
        this.logger.warn(`AreaGuard: User lacks KITCHEN area, redirecting from /worker/kitchen`);
        return new RedirectCommand(this.router.parseUrl('/worker/day-menu'));
      }
      return true;
    }

    // take-order, orders, day-menu require SERVICE area
    const serviceRoutes = ['take-order', 'orders', 'day-menu'];
    if (serviceRoutes.includes(targetRoute)) {
      const hasService = userData?.areas.some(a => a.name === 'SERVICE') ?? false;
      if (!hasService) {
        this.logger.warn(`AreaGuard: User lacks SERVICE area, redirecting from /worker/${targetRoute}`);
        return new RedirectCommand(this.router.parseUrl('/worker/kitchen'));
      }
      return true;
    }

    return true;
  }
}