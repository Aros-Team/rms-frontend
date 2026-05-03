import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '@services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(Logging);
  const authService = inject(Auth);

  logger.http(`Intercepting ${req.method} request to ${req.url}`);

  const publicPaths = [
    '/auth/login',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
    '/auth/register',
  ];

  const isPublicPath = publicPaths.some(path => req.url.includes(path));

  if (isPublicPath) {
    logger.http('Public endpoint detected, skipping Authorization header. URL:', req.url);
    return next(req);
  }

  const newHeaders: Record<string, string> = {};

  if (authService.isAuthenticated()) {
    newHeaders['Authorization'] = `Bearer ${String(authService.getToken())}`;
    logger.http('Adding Authorization header to request');
  } else {
    logger.http('No authentication token available, proceeding without Authorization header');
  }

  const newReq = req.clone({
    setHeaders: newHeaders,
  });

  return next(newReq);
};