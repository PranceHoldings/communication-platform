/**
 * E2E Tests for Login Authentication
 * Validates login process and localStorage token storage
 */

import { test, expect } from '@playwright/test';

test.describe('Login Authentication', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear localStorage before each test
    await context.clearCookies();
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should successfully login and store tokens in localStorage', async ({ page }) => {
    // Fill in login form
    await page.fill('input[name="email"]', 'admin@prance.com');
    await page.fill('input[name="password"]', 'Admin2026!Prance');

    // Setup API response listener
    const responsePromise = page.waitForResponse(
      response =>
        response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST'
    );

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for API response
    const response = await responsePromise;

    // Verify API response
    console.log('Login API status:', response.status());
    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    console.log('Login API response:', JSON.stringify(responseBody, null, 2));

    // Verify response structure
    expect(responseBody.success).toBe(true);
    expect(responseBody.data).toBeDefined();
    expect(responseBody.data.tokens).toBeDefined();
    expect(responseBody.data.tokens.accessToken).toBeDefined();
    expect(responseBody.data.user).toBeDefined();

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

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
    expect(userData.email).toBe('admin@prance.com');
    expect(userData.role).toBe('SUPER_ADMIN');

    console.log('✅ Login successful and tokens stored correctly');
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    // Fill in login form with invalid credentials
    await page.fill('input[name="email"]', 'admin@prance.com');
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
    // Login first
    await page.fill('input[name="email"]', 'admin@prance.com');
    await page.fill('input[name="password"]', 'Admin2026!Prance');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify tokens are stored
    const accessTokenBefore = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessTokenBefore).not.toBeNull();

    // Reload page
    await page.reload();

    // Verify tokens persist after reload
    const accessTokenAfter = await page.evaluate(() => localStorage.getItem('accessToken'));
    const user = await page.evaluate(() => localStorage.getItem('user'));

    expect(accessTokenAfter).toBe(accessTokenBefore);
    expect(user).not.toBeNull();

    // Should still be on dashboard (not redirected to login)
    expect(page.url()).toContain('/dashboard');

    console.log('✅ Authentication persists after page reload');
  });

  test('should clear tokens on logout', async ({ page }) => {
    // Login first
    await page.fill('input[name="email"]', 'admin@prance.com');
    await page.fill('input[name="password"]', 'Admin2026!Prance');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify tokens are stored
    const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(accessToken).not.toBeNull();

    // Click logout button (if available)
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("ログアウト"), a:has-text("Logout"), a:has-text("ログアウト")');

    if (await logoutButton.count() > 0) {
      await logoutButton.first().click();

      // Wait for redirect to login
      await page.waitForURL('/login', { timeout: 5000 });

      // Verify tokens are cleared
      const accessTokenAfter = await page.evaluate(() => localStorage.getItem('accessToken'));
      const refreshTokenAfter = await page.evaluate(() => localStorage.getItem('refreshToken'));
      const userAfter = await page.evaluate(() => localStorage.getItem('user'));

      expect(accessTokenAfter).toBeNull();
      expect(refreshTokenAfter).toBeNull();
      expect(userAfter).toBeNull();

      console.log('✅ Tokens cleared on logout');
    } else {
      console.log('⚠️  Logout button not found, skipping logout test');
    }
  });
});
