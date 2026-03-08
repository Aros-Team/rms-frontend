import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole, UserArea } from '../../domain/models/user.model';

export function authGuard(): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) {
      return true;
    }

    router.navigate(['/auth/login']);
    return false;
  };
}

export function adminGuard(): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/auth/login']);
      return false;
    }

    if (authService.isAdmin()) {
      return true;
    }

    router.navigate(['/']);
    return false;
  };
}

export function kitchenGuard(): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/auth/login']);
      return false;
    }

    if (authService.hasArea(UserArea.KITCHEN)) {
      return true;
    }

    router.navigate(['/']);
    return false;
  };
}

export function serviceAreaGuard(): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/auth/login']);
      return false;
    }

    if (authService.isAdmin() || authService.hasArea(UserArea.SERVICE)) {
      return true;
    }

    router.navigate(['/']);
    return false;
  };
}
