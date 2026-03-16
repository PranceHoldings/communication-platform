/**
 * Authentication Fixture for E2E Tests
 *
 * Provides authenticated context for tests that require login.
 */

import { test as base, Page } from '@playwright/test';

// Test user credentials (using existing admin user)
export const TEST_USER = {
  email: 'admin@prance.com',
  password: 'Admin2026!Prance',
};

/**
 * Login helper function
 * @param page Playwright Page object
 * @returns Promise<void>
 */
export async function login(page: Page): Promise<void> {
  // Listen for console messages (for debugging)
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`❌ Browser Console Error: ${msg.text()}`);
    }
  });

  // Listen for page errors
  page.on('pageerror', (error) => {
    console.log(`❌ Page Error: ${error.message}`);
  });

  // Navigate to login page
  console.log('📍 Navigating to /login...');
  await page.goto('/login');

  // Wait for page to load
  await page.waitForLoadState('networkidle');
  console.log('✅ Page loaded (networkidle)');

  // Fill in credentials using ID selectors
  console.log(`📝 Filling email: ${TEST_USER.email}`);
  await page.locator('input#email').fill(TEST_USER.email);

  console.log('📝 Filling password');
  await page.locator('input#password').fill(TEST_USER.password);

  // Listen for network requests
  page.on('response', async (response) => {
    if (response.url().includes('/auth/login')) {
      const status = response.status();
      console.log(`🌐 Login API Response: ${status}`);
      try {
        const body = await response.json();
        console.log(`📦 Response body: ${JSON.stringify(body).substring(0, 200)}...`);
      } catch {
        console.log('⚠️  Could not parse response body');
      }
    }
  });

  // Submit form
  console.log('🚀 Clicking login button...');
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard (increased timeout)
  console.log('⏳ Waiting for redirect to /dashboard...');
  await page.waitForURL('/dashboard', { timeout: 15000 });
  console.log('✅ Successfully redirected to /dashboard');
}

/**
 * Extended test fixture with authenticated context
 */
export const test = base.extend<{
  authenticatedPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Login before each test
    await login(page);

    // Use authenticated page
    await use(page);

    // Cleanup: logout or clear storage
    await page.context().clearCookies();
  },
});

export { expect } from '@playwright/test';
