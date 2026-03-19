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

  // Listen for failed requests (404, 500, etc.)
  page.on('response', (response) => {
    if (response.status() >= 400) {
      console.log(`❌ HTTP Error ${response.status()}: ${response.url()}`);
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

  // Listen for network requests BEFORE clicking button
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/auth/login') && response.request().method() === 'POST',
    { timeout: 10000 }
  );

  // Fill in credentials using ID selectors
  console.log(`📝 Filling email: ${TEST_USER.email}`);
  await page.locator('input#email').fill(TEST_USER.email);

  console.log('📝 Filling password');
  await page.locator('input#password').fill(TEST_USER.password);

  // Submit form
  console.log('🚀 Clicking login button...');
  await page.locator('button[type="submit"]').click();

  // Wait for login API response
  console.log('⏳ Waiting for login API response...');
  try {
    const loginResponse = await loginResponsePromise;
    const status = loginResponse.status();
    console.log(`🌐 Login API Response: ${status}`);

    if (status === 200) {
      try {
        const body = await loginResponse.json();
        console.log(`📦 Response body: ${JSON.stringify(body).substring(0, 200)}...`);
      } catch {
        console.log('⚠️  Could not parse response body');
      }
    } else {
      console.log(`❌ Login failed with status: ${status}`);
      const body = await loginResponse.text();
      console.log(`📦 Error body: ${body.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`❌ Login API request failed or timed out: ${error}`);
  }

  // Wait for redirect to dashboard (increased timeout to 30s)
  console.log('⏳ Waiting for redirect to /dashboard...');
  await page.waitForURL('/dashboard', { timeout: 30000 });
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
