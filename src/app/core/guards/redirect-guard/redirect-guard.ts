import { Injectable, inject } from '@angular/core';
import { CanActivate, GuardResult, MaybeAsync, Router, RedirectCommand } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { UserInfo } from '@models/domain/user/user-info.model';

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
      catchError(() => of<RedirectCommand>(new RedirectCommand(this.router.parseUrl('/login')))),
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