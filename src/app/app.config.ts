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
 * - `Primary`  — cream `#FDEFC7` fill with dark-gold ink `#896511`.
 * - `Semantic` — info/success/warn ramps (functional state colors).
 * - `Surface`  — slate enterprise family `#f8fafc` → `#64748b` (App-in-Card).
 */
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { theme } from '../environments/theme';

const Semantic = theme.semantic;

const arosPreset = definePreset(Aura, {
  semantic: {
    /**
     * Brand ramp. Gold is a fill: `primary.color` is the CTA background and
     * `primary.contrastColor` is the ink on it. The numbered scale only feeds
     * tints (hover backgrounds, highlighted rows, tags).
     */
    primary: {
      50: '#fef7e0',
      100: '#fdf0c8',
      200: '#fbe08f',
      300: '#f9cf52',
      400: '#fdefc7',
      500: '#fdefc7',
      600: '#d9a209',
      700: '#b07e06',
      800: '#8a6508',
      900: '#6b4e06',
      950: '#2e2202'
    },

    /** One focus ring for every component; same value as `--rms-focus`. */
    focusRing: {
      width: '2px',
      style: 'solid',
      color: 'var(--rms-focus)',
      offset: '2px',
      shadow: 'none'
    },

    colorScheme: {
      light: {
        /* Same slate ramp as `--rms-neutral-*`, both themes. Never zinc. */
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        primary: {
          color: 'var(--rms-brand-500)',
          // Legacy templates use `bg-primary-contrast` as the card surface.
          // Keep it white; button labels get their own ink token below.
          contrastColor: '#ffffff',
          hoverColor: 'var(--rms-brand-600)',
          activeColor: 'var(--rms-brand-700)'
        },
        text: {
          color: '#0f172a',
          hoverColor: '#020617',
          mutedColor: '#64748b',
          hoverMutedColor: '#475569'
        },
        content: {
          background: '#ffffff',
          hoverBackground: '#f1f5f9',
          borderColor: '#e2e8f0',
          color: '#0f172a',
          hoverColor: '#020617'
        },
        highlight: {
          background: 'var(--rms-bg-selected)',
          focusBackground: 'var(--rms-bg-selected)',
          color: 'var(--rms-brand-text)',
          focusColor: 'var(--rms-brand-text)'
        },
        formField: {
          background: '#ffffff',
          disabledBackground: '#f1f5f9',
          filledBackground: '#f8fafc',
          filledHoverBackground: '#f8fafc',
          filledFocusBackground: '#ffffff',
          borderColor: '#cbd5e1',
          hoverBorderColor: '#94a3b8',
          focusBorderColor: 'var(--rms-focus)',
          invalidBorderColor: '#b91c1c',
          color: '#0f172a',
          disabledColor: '#94a3b8',
          placeholderColor: '#64748b',
          invalidPlaceholderColor: '#b91c1c',
          floatLabelColor: '#64748b',
          floatLabelFocusColor: 'var(--rms-brand-text)',
          floatLabelActiveColor: '#475569',
          iconColor: '#64748b',
          shadow: 'none'
        },
        overlay: {
          select: { background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' },
          popover: { background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' },
          modal: { background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }
        },
        list: {
          option: {
            focusBackground: '#f1f5f9',
            selectedBackground: 'var(--rms-bg-selected)',
            selectedFocusBackground: 'var(--rms-bg-selected)',
            color: '#0f172a',
            focusColor: '#020617',
            selectedColor: 'var(--rms-brand-text)',
            selectedFocusColor: 'var(--rms-brand-text)'
          }
        },
        mask: { background: 'var(--rms-bg-overlay)', color: '#e2e8f0' },
        info: { color: '#1d4ed8', contrastColor: '#ffffff' },
        success: { color: '#047857', contrastColor: '#ffffff' },
        warn: { color: '#b45309', contrastColor: '#ffffff' },
        danger: { color: '#b91c1c', contrastColor: '#ffffff' }
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        primary: {
          color: 'var(--rms-brand-500)',
          contrastColor: '#ffffff',
          hoverColor: 'var(--rms-brand-600)',
          activeColor: 'var(--rms-brand-700)'
        },
        text: {
          color: '#e2e8f0',
          hoverColor: '#f8fafc',
          mutedColor: '#94a3b8',
          hoverMutedColor: '#cbd5e1'
        },
        content: {
          background: '#1e293b',
          hoverBackground: '#172033',
          borderColor: '#334155',
          color: '#e2e8f0',
          hoverColor: '#f8fafc'
        },
        highlight: {
          background: 'var(--rms-bg-selected)',
          focusBackground: 'var(--rms-bg-selected)',
          color: 'var(--rms-brand-text)',
          focusColor: 'var(--rms-brand-text)'
        },
        formField: {
          background: '#1e293b',
          disabledBackground: '#172033',
          filledBackground: '#172033',
          filledHoverBackground: '#172033',
          filledFocusBackground: '#1e293b',
          borderColor: '#475569',
          hoverBorderColor: '#64748b',
          focusBorderColor: 'var(--rms-focus)',
          invalidBorderColor: '#ef4444',
          color: '#e2e8f0',
          disabledColor: '#64748b',
          placeholderColor: '#94a3b8',
          invalidPlaceholderColor: '#fca5a5',
          floatLabelColor: '#94a3b8',
          floatLabelFocusColor: 'var(--rms-brand-text)',
          floatLabelActiveColor: '#cbd5e1',
          iconColor: '#94a3b8',
          shadow: 'none'
        },
        overlay: {
          select: { background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' },
          popover: { background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' },
          modal: { background: '#1e293b', borderColor: '#334155', color: '#e2e8f0' }
        },
        list: {
          option: {
            focusBackground: '#172033',
            selectedBackground: 'var(--rms-bg-selected)',
            selectedFocusBackground: 'var(--rms-bg-selected)',
            color: '#e2e8f0',
            focusColor: '#f8fafc',
            selectedColor: 'var(--rms-brand-text)',
            selectedFocusColor: 'var(--rms-brand-text)'
          }
        },
        mask: { background: 'var(--rms-bg-overlay)', color: '#e2e8f0' },
        info: { color: '#60a5fa', contrastColor: '#1e1b19' },
        success: { color: '#34d399', contrastColor: '#1e1b19' },
        warn: { color: '#fbbf24', contrastColor: '#1e1b19' },
        danger: { color: '#f87171', contrastColor: '#1e1b19' }
      }
    }
  },

  extend: {
    Semantic: Semantic
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
            primary: {
              color: '#896511',
              hoverColor: '#896511',
              activeColor: '#896511',
            },
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
          // Where primary is used as *foreground* (text / outlined / link
          // buttons) the brand gold is only 1.7:1 on light surfaces. These
          // point at the theme-aware brand-text token instead.
          text: {
            primary: {
              color: 'var(--rms-brand-text)',
              hoverBackground: 'var(--rms-brand-soft)',
              activeBackground: 'var(--rms-brand-soft)',
            },
          },
          outlined: {
            primary: {
              color: 'var(--rms-brand-text)',
              borderColor: 'var(--rms-brand-text)',
              hoverBackground: 'var(--rms-brand-soft)',
              activeBackground: 'var(--rms-brand-soft)',
            },
          },
          link: {
            color: 'var(--rms-brand-text)',
            hoverColor: 'var(--rms-brand-text)',
            activeColor: 'var(--rms-brand-text)',
          },
        },
        dark: {
          root: {
            primary: {
              color: '#896511',
              hoverColor: '#896511',
              activeColor: '#896511',
            },
          },
          text: {
            primary: {
              color: 'var(--rms-brand-text)',
              hoverBackground: 'var(--rms-brand-soft)',
              activeBackground: 'var(--rms-brand-soft)',
            },
          },
          outlined: {
            primary: {
              color: 'var(--rms-brand-text)',
              borderColor: 'var(--rms-brand-text)',
              hoverBackground: 'var(--rms-brand-soft)',
              activeBackground: 'var(--rms-brand-soft)',
            },
          },
          link: {
            color: 'var(--rms-brand-text)',
            hoverColor: 'var(--rms-brand-text)',
            activeColor: 'var(--rms-brand-text)',
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
    // Production only: `isDevMode()` is true for the development configuration
    // served by `npm start`, so the dev server never registers the worker and
    // can never serve a stale shell. In production the worker waits for the app
    // to be stable (max 5 s) and then caches the assets actually visited.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode,
      registrationStrategy: 'registerWhenStable:5000'
    }),

  ],
};
