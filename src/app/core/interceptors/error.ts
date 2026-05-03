import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { Logging } from '@core/services/logging/logging';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(Logging);

  return next(req).pipe(
    tap({
      next: () => { logger.http(`Response from ${req.method} ${req.url}`); },
      error: (err) => { logger.error(`Response from ${req.method} ${req.url} failed:`, err); },
    })
  );
};