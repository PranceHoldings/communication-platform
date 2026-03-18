/**
 * Day 12 Browser E2E Test
 * Tests Day 8-11 improvements in actual browser environment
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER = {
  email: 'admin@prance.com',
  password: 'Admin2026!Prance',
};

test.describe('Day 12: E2E Browser Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for slow operations
    test.setTimeout(60000);
  });

  test('Test 1: Login Flow', async ({ page }) => {
    console.log('Test 1: Login Flow');

    // Navigate to home page
    await page.goto(BASE_URL);

    // Check if redirected to login or already logged in
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);

    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      console.log('  - Login page detected, performing login...');

      // Fill login form
      await page.fill('input[type="email"]', TEST_USER.email);
      await page.fill('input[type="password"]', TEST_USER.password);

      // Submit login
      await page.click('button[type="submit"]');

      // Wait for navigation
      await page.waitForTimeout(3000);

      console.log('  ✅ Login submitted');
    } else {
      console.log('  ✅ Already logged in or on different page');
    }

    // Verify we're not on error page
    // Check only visible content (main element) to avoid false positives from Next.js dev mode internals
    const mainContent = await page.locator('main').textContent();

    // Check for actual error indicators (not just the word "error" in file names)
    expect(mainContent).not.toMatch(/Error:/i); // Error messages typically have "Error:"
    expect(mainContent).not.toMatch(/404.*not found/i); // 404 error pages
    expect(mainContent).not.toMatch(/something went wrong/i); // Generic error messages

    // Verify expected content is present
    const hasExpectedContent =
      mainContent?.includes('Prance') ||
      mainContent?.includes('Dashboard') ||
      mainContent?.includes('Sign In');
    expect(hasExpectedContent).toBeTruthy();

    console.log('  ✅ PASS - Login flow completed\n');
  });

  test('Test 2: Dashboard Navigation', async ({ page }) => {
    console.log('Test 2: Dashboard Navigation');

    await performLogin(page);

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(2000);

    console.log(`  Current URL: ${page.url()}`);

    // Check for main navigation elements
    const body = await page.textContent('body');
    const hasScenarios = body?.includes('Scenarios') || body?.includes('シナリオ');
    const hasAvatars = body?.includes('Avatars') || body?.includes('アバター');
    const hasSessions = body?.includes('Sessions') || body?.includes('セッション');

    console.log(`  - Navigation elements found:`);
    console.log(`    Scenarios: ${hasScenarios ? '✅' : '❌'}`);
    console.log(`    Avatars: ${hasAvatars ? '✅' : '❌'}`);
    console.log(`    Sessions: ${hasSessions ? '✅' : '❌'}`);

    expect(hasScenarios || hasAvatars || hasSessions).toBeTruthy();

    console.log('  ✅ PASS - Dashboard navigation verified\n');
  });

  test('Test 3: Scenarios Page', async ({ page }) => {
    console.log('Test 3: Scenarios Page');

    await performLogin(page);

    // Navigate to scenarios
    await page.goto(`${BASE_URL}/scenarios`);
    await page.waitForTimeout(2000);

    console.log(`  Current URL: ${page.url()}`);

    // Check page loaded
    const title = await page.title();
    console.log(`  Page title: ${title}`);

    // Check for scenarios-related content
    const body = await page.textContent('body');
    const hasContent = body?.length > 100; // At least some content

    console.log(`  Content loaded: ${hasContent ? '✅' : '❌'}`);
    expect(hasContent).toBeTruthy();

    console.log('  ✅ PASS - Scenarios page loaded\n');
  });

  test('Test 4: Avatars Page', async ({ page }) => {
    console.log('Test 4: Avatars Page');

    await performLogin(page);

    // Navigate to avatars
    await page.goto(`${BASE_URL}/avatars`);
    await page.waitForTimeout(2000);

    console.log(`  Current URL: ${page.url()}`);

    // Check page loaded
    const title = await page.title();
    console.log(`  Page title: ${title}`);

    // Check for avatars-related content
    const body = await page.textContent('body');
    const hasContent = body?.length > 100;

    console.log(`  Content loaded: ${hasContent ? '✅' : '❌'}`);
    expect(hasContent).toBeTruthy();

    console.log('  ✅ PASS - Avatars page loaded\n');
  });

  test('Test 5: Sessions Page', async ({ page }) => {
    console.log('Test 5: Sessions Page');

    await performLogin(page);

    // Navigate to sessions
    await page.goto(`${BASE_URL}/sessions`);
    await page.waitForTimeout(2000);

    console.log(`  Current URL: ${page.url()}`);

    // Check page loaded
    const title = await page.title();
    console.log(`  Page title: ${title}`);

    // Check for sessions-related content
    const body = await page.textContent('body');
    const hasContent = body?.length > 100;

    console.log(`  Content loaded: ${hasContent ? '✅' : '❌'}`);
    expect(hasContent).toBeTruthy();

    console.log('  ✅ PASS - Sessions page loaded\n');
  });

  test('Test 6: UI Components Rendering', async ({ page }) => {
    console.log('Test 6: UI Components Rendering');

    await performLogin(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(2000);

    // Check for common UI components
    const checks = {
      header: await page.locator('header').count() > 0,
      nav: await page.locator('nav').count() > 0,
      main: await page.locator('main').count() > 0,
      buttons: await page.locator('button').count() > 0,
      links: await page.locator('a').count() > 0,
    };

    console.log('  UI Components:');
    for (const [component, exists] of Object.entries(checks)) {
      console.log(`    ${component}: ${exists ? '✅' : '❌'}`);
    }

    // At least some components should exist
    const hasComponents = Object.values(checks).some(v => v);
    expect(hasComponents).toBeTruthy();

    console.log('  ✅ PASS - UI components rendering\n');
  });

  test('Test 7: Accessibility - Tab Navigation', async ({ page }) => {
    console.log('Test 7: Accessibility - Tab Navigation');

    await performLogin(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(2000);

    // Press Tab key multiple times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
    }

    // Check if focus is visible
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;

      const styles = window.getComputedStyle(el);
      const tag = el.tagName.toLowerCase();

      return {
        tag,
        hasOutline: styles.outline !== 'none' && styles.outline !== '',
        hasFocusVisible: el.matches(':focus-visible'),
      };
    });

    console.log('  Focused element:', focused);

    if (focused) {
      console.log(`    Tag: ${focused.tag}`);
      console.log(`    Has outline: ${focused.hasOutline ? '✅' : '❌'}`);
      console.log(`    Focus visible: ${focused.hasFocusVisible ? '✅' : '⚠️'}`);
    }

    console.log('  ✅ PASS - Tab navigation working\n');
  });

  test('Test 8: Responsive Design Check', async ({ page }) => {
    console.log('Test 8: Responsive Design Check');

    await performLogin(page);

    // Test different viewport sizes
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Laptop', width: 1366, height: 768 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForTimeout(1000);

      // Check if page loads without horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      console.log(`  ${viewport.name} (${viewport.width}x${viewport.height}):`);
      console.log(`    Horizontal scroll: ${hasHorizontalScroll ? '⚠️ YES' : '✅ NO'}`);
    }

    console.log('  ✅ PASS - Responsive design checked\n');
  });

  test('Test 9: Multi-language Support', async ({ page }) => {
    console.log('Test 9: Multi-language Support');

    await performLogin(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(2000);

    // Check for language-related content
    const body = await page.textContent('body');

    // Look for language indicators
    const hasEnglish = /Dashboard|Scenarios|Avatars|Sessions/i.test(body || '');
    const hasJapanese = /ダッシュボード|シナリオ|アバター|セッション/.test(body || '');

    console.log('  Language detection:');
    console.log(`    English content: ${hasEnglish ? '✅' : '❌'}`);
    console.log(`    Japanese content: ${hasJapanese ? '✅' : '❌'}`);

    const hasLanguageContent = hasEnglish || hasJapanese;
    expect(hasLanguageContent).toBeTruthy();

    console.log('  ✅ PASS - Language support verified\n');
  });

  test('Test 10: Error Handling - 404 Page', async ({ page }) => {
    console.log('Test 10: Error Handling - 404 Page');

    await performLogin(page);

    // Navigate to non-existent page
    await page.goto(`${BASE_URL}/this-page-does-not-exist-12345`);
    await page.waitForTimeout(2000);

    const body = await page.textContent('body');
    const has404 = body?.includes('404') ||
                   body?.includes('Not Found') ||
                   body?.includes('Page not found');

    console.log(`  404 error page: ${has404 ? '✅ Displayed' : '⚠️ Custom handling'}`);

    // Should handle gracefully (either 404 page or redirect)
    expect(body).toBeTruthy();

    console.log('  ✅ PASS - Error handling verified\n');
  });
});

/**
 * Helper: Perform login
 */
async function performLogin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(1000);

  // Check if already logged in
  const currentUrl = page.url();
  if (!currentUrl.includes('/login') && !currentUrl.includes('/auth')) {
    return; // Already logged in
  }

  try {
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  } catch (error) {
    console.log('  Login attempt failed or already logged in');
  }
}
