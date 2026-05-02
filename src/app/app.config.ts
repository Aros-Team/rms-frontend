import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideAnimations } from '@angular/platform-browser/animations';
import { LOCALE_ID } from '@angular/core';


import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { jwtInterceptor } from '@core/interceptors/jwt';
import { urlInterceptor } from '@core/interceptors/url-interceptor';
import { errorInterceptor } from '@core/interceptors/error';
import { routes } from './app.routes';

import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { theme } from '../environments/theme';

const Primary = theme.primary;

const arosPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{Primary.50}',
      100: '{Primary.100}',
      200: '{Primary.200}',
      300: '{Primary.300}',
      400: '{Primary.400}',
      500: '{Primary.500}',
      600: '{Primary.600}',
      700: '{Primary.700}',
      800: '{Primary.800}',
      900: '{Primary.900}',
      950: '{Primary.950}'
    },
  },

  extend: {
    Primary: Primary
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([urlInterceptor, jwtInterceptor, errorInterceptor])
    ),
    {
      provide: LOCALE_ID,
      useValue: 'es-ES'
    },
    providePrimeNG({
      theme: {
        preset: arosPreset,
        options: {
          darkModeSelector: '.dark'
        }
      }
    }),
    MessageService,
    ConfirmationService,
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode,
      registrationStrategy: 'registerWhenStable:30000'
    }),

  ],
};
