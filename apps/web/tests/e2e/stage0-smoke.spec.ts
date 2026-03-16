/**
 * Stage 0: Smoke Tests
 *
 * Basic tests to verify the app is running and pages are accessible.
 * No authentication required.
 */

import { test, expect } from '@playwright/test';

test.describe('Stage 0: Smoke Tests', () => {
  test('S0-001: Home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Prance/i);
  });

  test('S0-002: Login page is accessible', async ({ page }) => {
    await page.goto('/login');

    // Verify login form elements
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('S0-003: Register page is accessible', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL('/register');
  });

  test('S0-004: Dashboard redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 });
    await expect(page).toHaveURL('/login');
  });

  test('S0-005: Test IDs are present on login page', async ({ page }) => {
    await page.goto('/login');

    // Check that basic form elements exist
    const emailInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });
});
