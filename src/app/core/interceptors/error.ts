import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Logging } from '@core/services/logging/logging';
import { Auth } from '@services/auth/auth';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(Logging);
  const router = inject(Router);
  const authService = inject(Auth);

  return next(req).pipe(
    tap({
      next: () => { logger.http(`Response from ${req.method} ${req.url}`); },
      error: (err) => { logger.error(`Response from ${req.method} ${req.url} failed:`, err); },
    }),
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        authService.logout();
        void router.navigate(['/login']);
      }
      throw new Error(err.message || 'HTTP Error');
    })
  );
};