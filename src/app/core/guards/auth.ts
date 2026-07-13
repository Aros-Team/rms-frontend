import { Injectable, inject } from '@angular/core';
import {
    CanActivate,
    CanActivateChild,
    GuardResult,
    MaybeAsync,
    RedirectCommand,
    Router,
} from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { Auth } from '@services/auth/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate, CanActivateChild {
  private authService = inject(Auth);
  private router = inject(Router);

  canActivate(): MaybeAsync<GuardResult> {
    if (this.authService.isAuthenticated()) {
      const userData = this.authService.getData();
      if (userData) {
        return true;
      }
      return this.authService.loadUserInfo().pipe(
        map(() => true as GuardResult),
        catchError(() => of<RedirectCommand>(new RedirectCommand(this.router.parseUrl('/login')))),
      );
    }

    return this.authService.refresh().pipe(
      map(() => true as GuardResult),
      catchError(() => of<RedirectCommand>(new RedirectCommand(this.router.parseUrl('/login')))),
    );
  }

  canActivateChild(): MaybeAsync<GuardResult> {
    return this.canActivate();
  }
}