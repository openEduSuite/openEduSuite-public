/// <reference types="vitest/config" />
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // intercom/ is the vendored broker app with its own jest suite (needs
    // express/supertest, not installed at this npm root) — exclude from root vitest.
    exclude: [...configDefaults.exclude, 'intercom/**'],
  },
});
