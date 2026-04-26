import { defineConfig, devices } from '@playwright/test';

// E2E tests run against deployed environments only (dev.app.prance.jp or app.prance.jp).
// Set BASE_URL in .env.e2e or as an environment variable before running tests.
if (!process.env.BASE_URL) {
  throw new Error('BASE_URL must be set. E2E tests run against deployed environments only.');
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
