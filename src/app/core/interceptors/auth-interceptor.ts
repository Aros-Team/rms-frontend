import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@services/authentication/auth-service';
import { LoggingService } from '@app/core/services/logging/logging-service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const loggingService = inject(LoggingService);
  const authService = inject(AuthService);

  loggingService.http(`Intercepting ${req.method} request to ${req.url}`);

  const publicPaths = [
    '/auth/login',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
    '/auth/register',
  ];

  const isPublicPath = publicPaths.some(path => req.url.includes(path));

  if (isPublicPath) {
    loggingService.http('Public endpoint detected, skipping Authorization header. URL:', req.url);
    return next(req);
  }

  const newHeaders: Record<string, string> = {};

  if (authService.isAuthenticated()) {
    newHeaders['Authorization'] = `Bearer ${authService.getToken()}`;
    loggingService.http('Adding Authorization header to request');
  } else {
    loggingService.http('No authentication token available, proceeding without Authorization header');
  }

  const newReq = req.clone({
    setHeaders: newHeaders,
  });

  return next(newReq);
};