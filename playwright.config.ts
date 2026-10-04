import { defineConfig } from '@playwright/test';

const PORT = 4323;

/**
 * Browser tests run against the production build of the example wiki, served
 * as plain static files.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    // Languages still in preview are built too, so that the tests can cover them.
    command: `cd example && PREVIEW_LOCALES=true npx astro build && node ../tests/e2e/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    },
  ],
});
