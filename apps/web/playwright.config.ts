import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local (root directory)
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

/**
 * Playwright Configuration for Prance Session Player E2E Tests
 *
 * Test Stages:
 * - Stage 1: Basic UI Flow (login, navigation, button states)
 * - Stage 2: Mocked Integration (WebSocket mocks, state transitions)
 * - Stage 3: Full E2E (real WebSocket, audio permissions, full flow)
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '/tmp/playwright-test-results',

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Local: 1 retry for flaky tests
  workers: 1, // Sequential execution to avoid connection issues

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: './playwright-report' }],
    ['json', { outputFile: './playwright-results/results.json' }],
    ['list'],
  ],

  // Global test configuration
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Grant permissions for microphone/camera (Stage 3 tests)
    permissions: ['microphone', 'camera'],

    // Increase timeout for WebSocket connections
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Test timeout configuration
  timeout: 60000, // 1 minute per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  // Web server configuration (auto-start Next.js dev server)
  // Disabled: Start dev server manually with 'npm run dev' in a separate terminal
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000, // 2 minutes to start
  // },

  // Browser configurations
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable audio/video capture for Stage 3 tests
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream', // Auto-grant microphone permission
            '--use-fake-device-for-media-stream', // Use fake audio/video devices
            '--autoplay-policy=no-user-gesture-required', // Allow audio autoplay
          ],
        },
      },
    },

    // Optional: Firefox (Stage 1-2 only, audio APIs different)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // Optional: WebKit (Safari)
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
