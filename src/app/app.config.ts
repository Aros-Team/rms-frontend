import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { appRoutes } from './app.routes';
import { provideOrdersInfrastructure } from './infrastructure/providers/orders.providers';
import { provideProductsInfrastructure } from './infrastructure/providers/products.providers';
import { provideTablesInfrastructure } from './infrastructure/providers/tables.providers';
import { RMSPreset } from './shared/theme/rms-preset';
import { authInterceptor } from './core/auth/application/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideRouter(appRoutes),
    provideOrdersInfrastructure(),
    ...provideProductsInfrastructure,
    provideTablesInfrastructure(),
    providePrimeNG({
      theme: {
        preset: RMSPreset,
        options: {
          darkModeSelector: '.dark',
          prefix: 'p'
        }
      }
    })
  ],
};
