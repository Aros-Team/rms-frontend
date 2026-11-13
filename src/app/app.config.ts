import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  isDevMode,
} from '@angular/core';
import {
  provideRouter,
  withPreloading,
  withComponentInputBinding,
  withInMemoryScrolling,
  TitleStrategy,
} from '@angular/router';
import { AppTitleStrategy } from './core/title-strategy/title-strategy';
import { SelectivePreloadingStrategy } from './core/preloading/selective-preloading-strategy';
import { provideServiceWorker } from '@angular/service-worker';
import { ConfirmationService, MessageService } from 'primeng/api';
import { LOCALE_ID } from '@angular/core';


import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { jwtInterceptor } from '@core/interceptors/jwt/jwt';
import { urlInterceptor } from '@core/interceptors/url-interceptor/url-interceptor';
import { errorInterceptor } from '@core/interceptors/error/error';
import { envelopeInterceptor } from '@core/interceptors/envelope/envelope';
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
          // Dark text on brand gold: white on #F9BB0B is 1.8:1 (WCAG needs 4.5).
          contrastColor: '#1e1b19',
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
  },

  components: {
    /**
     * Severity buttons use Aura's raw 500 shades with white text, which fails
     * WCAG AA on light surfaces (warn #f97316 → 2.8:1, success → 2.6:1,
     * info → 3.4:1, danger → 3.8:1). Keep the hues, move them one step darker
     * — or, for amber, keep the bright fill and switch to dark ink.
     */
    button: {
      colorScheme: {
        light: {
          root: {
            info: {
              background: '{Semantic.info.600}',
              hoverBackground: '{Semantic.info.700}',
              activeBackground: '{Semantic.info.800}',
              borderColor: '{Semantic.info.600}',
              color: '#ffffff',
            },
            success: {
              background: '{Semantic.success.700}',
              hoverBackground: '{Semantic.success.800}',
              activeBackground: '{Semantic.success.900}',
              borderColor: '{Semantic.success.700}',
              color: '#ffffff',
            },
            warn: {
              background: '{Semantic.warn.500}',
              hoverBackground: '{Semantic.warn.600}',
              activeBackground: '{Semantic.warn.700}',
              borderColor: '{Semantic.warn.500}',
              color: '#1e1b19',
            },
            danger: {
              background: '#dc2626',
              hoverBackground: '#b91c1c',
              activeBackground: '#991b1b',
              borderColor: '#dc2626',
              color: '#ffffff',
            },
          },
        },
      },
    },
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withPreloading(SelectivePreloadingStrategy),
      withComponentInputBinding(),
      // Reset scroll on navigation and honour #anchors, otherwise a long page
      // leaves the next route scrolled halfway down.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(
      withInterceptors([urlInterceptor, jwtInterceptor, errorInterceptor, envelopeInterceptor])
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
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    MessageService,
    ConfirmationService,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode,
      registrationStrategy: 'registerWhenStable:15000'
    }),

  ],
};
