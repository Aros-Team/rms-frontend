import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { inject, Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from '@services/authentication/auth-service';
import { LoggingService } from '@app/core/services/logging/logging-service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private injector = inject(Injector);
  private loggingService = inject(LoggingService);
  private authService?: AuthService;
  
  private readonly publicPaths = [
    '/auth/login',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
    '/auth/register',
  ];

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Lazy inject AuthService to avoid circular dependency
    if (!this.authService) {
      this.authService = this.injector.get(AuthService);
    }
    
    this.loggingService.http(`Intercepting ${req.method} request to ${req.url}`);

    if (this.isPublicPath(req.url)) {
      this.loggingService.http('Public endpoint detected, skipping Authorization header. URL:', req.url);
      return next.handle(req);
    }

    const newHeaders: Record<string, string> = {};

    if (this.authService.isAuthenticated()) {
      newHeaders['Authorization'] = `Bearer ${this.authService.getToken()}`;
      this.loggingService.http('Adding Authorization header to request');
    } else {
      this.loggingService.http('No authentication token available, proceeding without Authorization header');
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
