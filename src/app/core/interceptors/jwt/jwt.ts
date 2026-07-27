import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '@services/auth/auth';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(Auth);

  const publicPaths = [
    '/auth/login',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
    '/auth/register',
  ];

  const isPublicPath = publicPaths.some(path => req.url.includes(path));

  if (isPublicPath) {
    return next(req);
  }

  const newHeaders: Record<string, string> = {};

  if (authService.isAuthenticated()) {
    newHeaders['Authorization'] = `Bearer ${String(authService.getToken())}`;
  }

  const newReq = req.clone({
    setHeaders: newHeaders,
  });

  return next(newReq);
};