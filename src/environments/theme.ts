/**
 * Aros Hospitality Core — theme tokens.
 *
 * Functional palette (primary + semantic + slate enterprise surface family).
 * Source of truth: `docs/design/waiter-service.md` § 2 (Color Tokens).
 *
 * - `primary`            — gold `#F9BB0B` (brand, active CTAs).
 * - `semantic.info`      — blue `#3b82f6` (secondary container / "Preparing in Kitchen").
 * - `semantic.success`   — emerald `#10b981` (tertiary container / "Ready at Pass").
 * - `semantic.warn`      — amber `#f59e0b` (pending / "In Queue" status).
 * - `surface`            — slate family for enterprise sober tone (page + cards + borders).
 */
export const theme = {
  primary: {
    50: '#fefbf6',
    100: '#fcf6e9',
    200: '#f8ecd1',
    300: '#f5e3b8',
    400: '#f2daa2',
    500: '#F9BB0B',
    600: '#c69409',
    700: '#392d11',
    800: '#57441a',
    900: '#725a23',
    950: '#ab8734'
  },

  semantic: {
    info: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6', // secondary container blue (Stitch)
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    },
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981', // tertiary emerald (Stitch)
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22'
    },
    warn: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b', // pending amber (Stitch)
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03'
    }
  },

  surface: {
    0: '#ffffff',   // card surface — pure white (enterprise clean)
    50: '#f8fafc',   // page background — slate-50 (sober neutral)
    100: '#f1f5f9',   // slate-100
    200: '#e2e8f0',   // slate-200 — hairline borders
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b'
  }
};
