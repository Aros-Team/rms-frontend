import { Injectable, inject } from '@angular/core';
import { CanActivate, GuardResult, MaybeAsync, Router, RedirectCommand } from '@angular/router';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';

@Injectable({
  providedIn: 'root',
})
export class RedirectGuard implements CanActivate {
  private authService = inject(Auth);
  private router = inject(Router);
  private logger = inject(Logging);

  canActivate(): MaybeAsync<GuardResult> {
    this.logger.routing('RedirectGuard: Checking authentication status');
    if (this.authService.isAuthenticated()) {
      const userData = this.authService.getData();
      this.logger.routing('User authenticated, checking user data:', userData);

      if (userData) {
        const isAdmin = userData.role === 'ADMIN';
        this.logger.routing('User data available, isAdmin:', isAdmin);
        if (isAdmin) {
          this.logger.routing('Redirecting admin user to /admin');
          return new RedirectCommand(this.router.parseUrl('/admin'));
        } else {
          this.logger.routing('Redirecting worker user to /worker');
          return new RedirectCommand(this.router.parseUrl('/worker'));
        }
      } else {
        this.logger.routing('User authenticated but no data yet, waiting for data...');
        return new Promise<GuardResult>((resolve) => {
          const checkUserData = () => {
            const currentUserData = this.authService.getData();
            if (currentUserData) {
              const isAdmin = currentUserData.role === 'ADMIN';
              this.logger.routing('User data now available, isAdmin:', isAdmin);
              if (isAdmin) {
                this.logger.routing('Redirecting admin user to /admin after wait');
                resolve(new RedirectCommand(this.router.parseUrl('/admin')));
              } else {
                this.logger.routing('Redirecting worker user to /worker after wait');
                resolve(new RedirectCommand(this.router.parseUrl('/worker')));
              }
            } else {
              this.logger.debug('Still waiting for user data...');
              setTimeout(checkUserData, 100);
            }
          };
          setTimeout(checkUserData, 100);
        });
      }
    }

    this.logger.routing('User not authenticated, allowing access to login');
    return true;
  }


}
