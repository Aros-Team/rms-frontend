import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '@services/authentication/auth-service';
import { LoggingService } from '@app/core/services/logging/logging-service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly publicPaths = [
    '/auth/login',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
    '/auth/register',
  ];

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const loggingService = inject(LoggingService);
    const authService = inject(AuthService);

    loggingService.http(`Intercepting ${req.method} request to ${req.url}`);

    if (this.isPublicPath(req.url)) {
      loggingService.http('Public endpoint detected, skipping Authorization header. URL:', req.url);
      return next.handle(req);
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

    return next.handle(newReq);
  }

  private isPublicPath(url: string): boolean {
    return this.publicPaths.some(path => url.includes(path));
  }
}
