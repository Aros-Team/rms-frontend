import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const RMSPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e6f2ff',
      100: '#bfdeff',
      200: '#99caff',
      300: '#73b6ff',
      400: '#4da2ff',
      500: '#268eff',
      600: '#1a71cc',
      700: '#135499',
      800: '#0c3d66',
      900: '#062633',
      950: '#031319',
      contrastColor: '#ffffff'
    },
    colorScheme: {
      light: {
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
        }
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
        }
      }
    },
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#4ade80',
      600: '#22c55e',
      700: '#16a34a',
      800: '#15803d',
      900: '#14532d',
      950: '#052e16',
      contrastColor: '#ffffff'
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#dc2626',
      600: '#b91c1c',
      700: '#991b1b',
      800: '#7f1d1d',
      900: '#7f1d1d',
      950: '#450a0a',
      contrastColor: '#ffffff'
    }
  },
  components: {
    button: {
      root: {
        borderRadius: '8px'
      }
    },
    inputtext: {
      root: {
        borderRadius: '8px'
      }
    },
    dialog: {
      root: {
        borderRadius: '12px'
      }
    },
    card: {
      root: {
        borderRadius: '12px'
      }
    }
  }
});
