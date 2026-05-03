import { Injectable, inject } from '@angular/core';
import {
    CanActivate,
    CanActivateChild,
    GuardResult,
    MaybeAsync,
    RedirectCommand,
    Router,
} from '@angular/router';
import { map, catchError } from 'rxjs';
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
      } else {
        return new Promise<GuardResult>((resolve) => {
          const checkUserData = () => {
            const currentUserData = this.authService.getData();
            if (currentUserData) {
              resolve(true);
            } else {
              setTimeout(checkUserData, 100);
            }
          };
          setTimeout(checkUserData, 100);
        });
      }
    }

    return this.authService.refresh().pipe(
      map(() => {
        return true;
      }),
      catchError(() => {
        return [new RedirectCommand(this.router.parseUrl('/login'))];
      })
    );
  }

  canActivateChild(): MaybeAsync<GuardResult> {
    return this.canActivate();
  }
}