// @ts-check
import angular from 'angular-eslint';
import { defineConfig } from 'eslint/config';

// TypeScript is linted by Oxlint (`.oxlintrc.json`, with the type-aware
// `tsgolint` backend). ESLint is kept *only* for Angular templates, because
// Oxlint has no template linting yet (oxc-project/oxc#15761). Do not add
// `**/*.ts` here: that path is the slow (30 s) one we moved to Oxlint (2-6 s).
export default defineConfig([
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
  {
    // Feature code only: primitives legitimately use inline styles for
    // dynamic geometry (skeleton width, treemap areas, dialog width).
    files: ['src/app/areas/**/*.html', 'src/app/shared/features/**/*.html'],
    rules: {
      // Inline styles cannot follow light/dark/high-contrast tokens.
      // Data-driven geometry documents its exception inline.
      '@angular-eslint/template/no-inline-styles': 'error',
    },
  },
]);
