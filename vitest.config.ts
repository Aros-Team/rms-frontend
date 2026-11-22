import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'tests/**/*.spec.ts'],
    // Playwright specs live under tests/e2e and are run by `npx playwright test`.
    exclude: ['tests/e2e/**', 'node_modules/**'],
    globals: true,
    setupFiles: ['src/test-setup.ts'],
  },
});
