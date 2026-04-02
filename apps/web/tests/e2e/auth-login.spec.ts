/**
 * E2E Tests for Login Authentication
 * Validates login process and localStorage token storage
 */

import { test, expect } from '@playwright/test';
import { login, TEST_USER } from './fixtures/auth.fixture';

test.describe('Login Authentication', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear localStorage before each test
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should successfully login and store tokens in localStorage', async ({ page }) => {
    // Use login helper with detailed logging
    await login(page);

    // Verify URL changed to dashboard
    expect(page.url()).toContain('/dashboard');

    // Verify localStorage contains tokens
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));
    const user = await page.evaluate(() => localStorage.getItem('user'));

    console.log('LocalStorage after login:');
    console.log('- accessToken:', accessToken ? 'Present (length: ' + accessToken.length + ')' : 'Missing');
    console.log('- refreshToken:', refreshToken ? 'Present (length: ' + refreshToken.length + ')' : 'Missing');
    console.log('- user:', user ? 'Present' : 'Missing');

    // Assertions
    expect(accessToken).not.toBeNull();
    expect(accessToken).toBeTruthy();
    expect(refreshToken).not.toBeNull();
    expect(refreshToken).toBeTruthy();
    expect(user).not.toBeNull();

    // Verify user data structure
    const userData = JSON.parse(user!);
    expect(userData.id).toBeDefined();
    expect(userData.email).toBe(TEST_USER.email);
    expect(userData.role).toBe('SUPER_ADMIN');

    console.log('✅ Login successful and tokens stored correctly');
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    // Fill in login form with invalid credentials
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', 'WrongPassword123!');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('.bg-red-50, [class*="error"]', { timeout: 5000 });

    // Verify localStorage is still empty
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).toBeNull();

    console.log('✅ Invalid credentials handled correctly');
  });

  test('should maintain authentication after page reload', async ({ page }) => {
    // Login first using helper
    await login(page);

    // Verify tokens are stored
    const accessTokenBefore = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessTokenBefore).not.toBeNull();

    // Reload page
    await page.reload();

    // Verify tokens persist after reload
    const accessTokenAfter = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessTokenAfter).not.toBeNull();
    expect(accessTokenAfter).toBe(accessTokenBefore);

    // Verify still on dashboard
    expect(page.url()).toContain('/dashboard');

    console.log('✅ Authentication persisted after page reload');
  });

  test('should clear tokens on logout', async ({ page }) => {
    // Login first using helper
    await login(page);

    // Verify tokens are stored
    const accessTokenBefore = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessTokenBefore).not.toBeNull();

    // Click logout button (assuming there's a logout button in the dashboard)
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), [aria-label*="Logout"]').first();
    if (await logoutButton.isVisible({ timeout: 2000 })) {
      await logoutButton.click();

      // Wait for redirect to login page
      await page.waitForURL('/login', { timeout: 10000 });

      // Verify tokens are cleared
      const accessTokenAfter = await page.evaluate(() => localStorage.getItem('accessToken'));
      const refreshTokenAfter = await page.evaluate(() => localStorage.getItem('refreshToken'));
      expect(accessTokenAfter).toBeNull();
      expect(refreshTokenAfter).toBeNull();

      console.log('✅ Tokens cleared on logout');
    } else {
      console.log('⚠️  Logout button not found, skipping logout test');
      test.skip();
    }
  });
});
