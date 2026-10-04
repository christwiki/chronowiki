import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // In a wiki the integration provides the wiki's settings under this name. Here a fixture stands in.
    alias: { 'virtual:chronowiki/config': fileURLToPath(new URL('./tests/fixtures/wiki.config.ts', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
