import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { ConfirmationService, MessageService } from 'primeng/api';
import { LOCALE_ID } from '@angular/core';


import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { jwtInterceptor } from '@core/interceptors/jwt';
import { urlInterceptor } from '@core/interceptors/url-interceptor';
import { errorInterceptor } from '@core/interceptors/error';
import { routes } from './app.routes';

/**
 * Aros Hospitality Core — PrimeNG theme preset.
 *
 * Extends `@primeuix/themes/aura` with the Waiter Service Design System tokens
 * (functional palette + slate enterprise surface family). Token sources live
 * in `src/environments/theme.ts`. Reference: `docs/design/waiter-service.md`
 * § 2 (Color Tokens) and § 9 (PrimeNG + Tailwind v4 Mapping Cheat Sheet).
 *
 * - `Primary`  — brand gold `#F9BB0B` ramp.
 * - `Semantic` — info/success/warn ramps (functional state colors).
 * - `Surface`  — slate enterprise family `#f8fafc` → `#64748b` (App-in-Card).
 */
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { theme } from '../environments/theme';

const Primary = theme.primary;
const Semantic = theme.semantic;
const Surface = theme.surface;

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
    colorScheme: {
      light: {
        primary: {
          color: '{primary.500}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.600}',
          activeColor: '{primary.700}'
        },
        info: { color: '{Semantic.info.500}', contrastColor: '#ffffff' },
        success: { color: '{Semantic.success.500}', contrastColor: '#ffffff' },
        warn: { color: '{Semantic.warn.500}', contrastColor: '#1e1b19' },
        surface: {
          0: '{Surface.0}',
          50: '{Surface.50}',
          100: '{Surface.100}',
          200: '{Surface.200}',
          300: '{Surface.300}',
          400: '{Surface.400}',
          500: '{Surface.500}'
        }
      },
      dark: {
        primary: {
          color: '{Primary.400}',
          contrastColor: '#1e1b19',
          hoverColor: '{Primary.300}',
          activeColor: '{Primary.200}'
        },
        info: { color: '{Semantic.info.400}', contrastColor: '#0a0a0a' },
        success: { color: '{Semantic.success.400}', contrastColor: '#0a0a0a' },
        warn: { color: '{Semantic.warn.400}', contrastColor: '#0a0a0a' }
      }
    }
  },

  extend: {
    Primary: Primary,
    Semantic: Semantic,
    Surface: Surface
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
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
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode,
      registrationStrategy: 'registerWhenStable:15000'
    }),

  ],
};
