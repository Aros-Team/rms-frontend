// Quick verification: emit the CSS PrimeNG Aura injects at runtime for the
// updated arosPreset. Run with: node scripts/verify-preset.mjs
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const theme = {
  primary: {
    50: '#fefbf6', 100: '#fcf6e9', 200: '#f8ecd1', 300: '#f5e3b8',
    400: '#f2daa2', 500: '#F9BB0B', 600: '#c69409', 700: '#392d11',
    800: '#57441a', 900: '#725a23', 950: '#ab8734',
  },
  semantic: {
    info:    { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a',950:'#172554' },
    success: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b',950:'#022c22' },
    warn:    { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f',950:'#451a03' },
  },
  surface: {
    0:'#ffffff', 50:'#fff8f5', 100:'#faf2ee', 200:'#f4ece8',
    300:'#eee7e3', 400:'#e9e1dd', 500:'#e0d8d5',
  },
};

const Primary  = theme.primary;
const Semantic = theme.semantic;
const Surface  = theme.surface;

const arosPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50:'{Primary.50}',100:'{Primary.100}',200:'{Primary.200}',300:'{Primary.300}',
      400:'{Primary.400}',500:'{Primary.500}',600:'{Primary.600}',700:'{Primary.700}',
      800:'{Primary.800}',900:'{Primary.900}',950:'{Primary.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color:'{primary.500}', contrastColor:'#ffffff',
          hoverColor:'{primary.600}', activeColor:'{primary.700}',
        },
        info:    { color:'{Semantic.info.500}',    contrastColor:'#ffffff' },
        success: { color:'{Semantic.success.500}', contrastColor:'#ffffff' },
        warn:    { color:'{Semantic.warn.500}',    contrastColor:'#1e1b19' },
        surface: {
          0:'{Surface.0}',50:'{Surface.50}',100:'{Surface.100}',
          200:'{Surface.200}',300:'{Surface.300}',400:'{Surface.400}',500:'{Surface.500}',
        },
      },
      dark: {
        primary: {
          color:'{Primary.400}', contrastColor:'#1e1b19',
          hoverColor:'{Primary.300}', activeColor:'{Primary.200}',
        },
        info:    { color:'{Semantic.info.400}',    contrastColor:'#0a0a0a' },
        success: { color:'{Semantic.success.400}', contrastColor:'#0a0a0a' },
        warn:    { color:'{Semantic.warn.400}',    contrastColor:'#0a0a0a' },
      },
    },
  },
  extend: { Primary, Semantic, Surface },
});

// PrimeNG calls useTheme/usePreset at runtime. We can synthesize what
// getCommonStyleSheet returns. Access via the styled package Theme module.
const styled = await import('@primeuix/styled');
const Theme = styled.Theme;
const params = { darkModeSelector: '.dark', prefix: 'p' };
Theme.setTheme({ preset: arosPreset, options: params });
const css = Theme.getCommonStyleSheet('common');

// Print a filtered set of declarations we care about.
const interesting = [
  '--p-primary-50','--p-primary-100','--p-primary-500','--p-primary-color',
  '--p-primary-hover-color','--p-primary-active-color','--p-primary-contrast-color',
  '--p-surface-0','--p-surface-50','--p-surface-100','--p-surface-200',
  '--p-surface-300','--p-surface-400','--p-surface-500',
  '--p-info-color','--p-info-contrast-color',
  '--p-success-color','--p-success-contrast-color',
  '--p-warn-color','--p-warn-contrast-color',
];

const declRegex = new RegExp(`(?:${interesting.map(s => s.replace(/-/g, '\\-')).join('|')})\\s*:[^;]+`, 'g');
console.log('--- Variables of interest (runtime injection) ---');
const seen = new Set();
const matches = css.match(declRegex) || [];
for (const m of matches) {
  if (!seen.has(m)) { console.log(m.trim() + ';'); seen.add(m); }
}
console.log('--- End ---');
