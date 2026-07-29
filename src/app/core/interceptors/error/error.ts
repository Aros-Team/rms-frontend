import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Logging } from '@core/services/logging/logging';
import { Auth } from '@services/auth/auth';
import { ServerStatus } from '@core/services/server-status/server-status';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(Logging);
  const router = inject(Router);
  const authService = inject(Auth);
  const serverStatus = inject(ServerStatus);

  return next(req).pipe(
    tap({
      next: () => {
        logger.http(`Response from ${req.method} ${req.url}`);
        serverStatus.reportSuccess();
      },
      error: (err: HttpErrorResponse) => {
        logger.error(`Response from ${req.method} ${req.url} failed:`, err);
        if (err.status === 0 || (err.status >= 500 && err.status < 600)) {
          serverStatus.reportNetworkError();
        }
      },
    }),
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        authService.logout();
        void router.navigate(['/login']);
      }
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw err;
    })
  );
};