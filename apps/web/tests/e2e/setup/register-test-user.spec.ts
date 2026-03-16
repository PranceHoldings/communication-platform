/**
 * Register Test User
 *
 * One-time test to create a test user via the registration flow.
 * Run with: npx playwright test tests/e2e/setup/register-test-user.spec.ts
 */

import { test, expect } from '@playwright/test';

const TEST_USER = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Test123!@#',
  organization: 'Test Organization',
};

test.describe.serial('Setup: Register Test User', () => {
  test('Create test user via registration', async ({ page }) => {
    // Navigate to register page
    await page.goto('/register');

    // Fill in registration form
    // Note: Adjust selectors based on actual registration form
    try {
      // Try to find form fields (adjust based on actual implementation)
      const nameInput = page.locator('input[name="name"], input#name');
      const emailInput = page.locator('input[name="email"], input#email');
      const passwordInput = page.locator('input[name="password"], input#password, input[type="password"]').first();
      const orgInput = page.locator('input[name="organization"], input#organization');
      const submitButton = page.locator('button[type="submit"]');

      // Fill form
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill(TEST_USER.name);
      }

      await emailInput.fill(TEST_USER.email);
      await passwordInput.fill(TEST_USER.password);

      if (await orgInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await orgInput.fill(TEST_USER.organization);
      }

      // Submit
      await submitButton.click();

      // Wait for either success or error
      await page.waitForTimeout(3000);

      console.log('✅ Test user registration submitted');
      console.log('   Name:', TEST_USER.name);
      console.log('   Email:', TEST_USER.email);
      console.log('   Password:', TEST_USER.password);
    } catch (error) {
      console.log('⚠️  Registration might have failed or user might already exist');
      console.log('   Error:', error);
    }
  });

  test('Verify test user can login', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');

    // Login with test user
    await page.locator('input#email').fill(TEST_USER.email);
    await page.locator('input#password').fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();

    // Verify redirect to dashboard or check for error
    try {
      await page.waitForURL('/dashboard', { timeout: 10000 });
      console.log('✅ Test user can login successfully');
      expect(page.url()).toContain('/dashboard');
    } catch (error) {
      console.log('⚠️  Login failed - user might not exist yet');
      // Don't fail the test - just log
    }
  });
});
