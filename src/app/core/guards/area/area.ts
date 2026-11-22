/**
 * AreaGuard — workspace permission for `/worker` children.
 *
 * Feature: A worker may only enter the routes their assigned area allows, and
 * `/worker` dispatches them to the workspace they work in.
 *
 * Contract (deny by default):
 *  - `data.workerLanding` → redirect to the user's landing (`workerHome`),
 *    `/forbidden` when the user has no recognized area
 *  - `data.anyWorker` → allowed (profile, schedule)
 *  - `data.workerWorkspaces` → allowed only when one of the workspaces matches
 *    the user's areas; CASH only grants the cashier workspace, GRILL only
 *    grants kitchen
 *  - no recognized `data` → `/forbidden` (an unhandled route is never allowed)
 *
 * Approach: the route table declares the workspace; this guard only evaluates
 * the pure matrix in `role-navigation.ts`.
 */
import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  GuardResult,
  MaybeAsync,
  RedirectCommand,
  Router,
} from '@angular/router';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import type { WorkerRouteData } from '@app/core/config/navigation/role-navigation';
import { canAccessWorkspace, workerHome } from '@app/core/config/navigation/role-navigation';

@Injectable({
  providedIn: 'root',
})
export class AreaGuard implements CanActivate {
  private authService = inject(Auth);
  private router = inject(Router);
  private logger = inject(Logging);

  canActivate(route: ActivatedRouteSnapshot): MaybeAsync<GuardResult> {
    const userData = this.authService.getData();
    if (!userData) {
      this.logger.warn('AreaGuard: no user data, redirecting to login');
      return new RedirectCommand(this.router.parseUrl('/login'));
    }

    const data = route.data as WorkerRouteData;

    if (data.workerLanding === true) {
      const home = workerHome(userData);
      if (home) {
        return new RedirectCommand(this.router.parseUrl(home));
      }
      this.logger.warn('AreaGuard: worker has no recognized area, redirecting to /forbidden');
      return new RedirectCommand(this.router.parseUrl('/forbidden'));
    }

    if (data.anyWorker === true) {
      return true;
    }

    const required = data.workerWorkspaces ?? [];
    if (required.length === 0) {
      this.logger.warn('AreaGuard: route declares no workspace, denying by default');
      return new RedirectCommand(this.router.parseUrl('/forbidden'));
    }

    if (required.some((workspace) => canAccessWorkspace(userData, workspace))) {
      return true;
    }

    this.logger.warn(
      `AreaGuard: user lacks ${required.join(', ')} area(s), redirecting to /forbidden`,
    );
    return new RedirectCommand(this.router.parseUrl('/forbidden'));
  }
}
