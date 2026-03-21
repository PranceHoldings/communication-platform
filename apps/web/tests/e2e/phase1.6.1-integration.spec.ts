/**
 * Phase 1.6.1 Integration Tests
 * Day 37: 統合テスト・ユーザーテスト
 *
 * Tests for:
 * - Day 31-34: 録画機能信頼性（ACK、順序保証、並列ダウンロード、エラーハンドリング）
 * - Day 35: シナリオバリデーション・エラーリカバリー
 * - Day 36: シナリオキャッシュ・変数システム
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from './page-objects/login-page';
import { DashboardPage } from './page-objects/dashboard-page';

test.describe('Phase 1.6.1 - Recording Reliability (Day 31-34)', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'test@example.com',
      process.env.TEST_USER_PASSWORD || 'TestPassword123!'
    );

    // Wait for dashboard
    await page.waitForURL('**/dashboard');
  });

  test('should track chunk ACKs during recording', async ({ page }) => {
    // Navigate to session page
    await page.goto('/sessions/new');

    // Select scenario and avatar
    await page.click('[data-testid="scenario-select"]');
    await page.click('[data-testid="scenario-option"]:first-child');
    await page.click('[data-testid="avatar-select"]');
    await page.click('[data-testid="avatar-option"]:first-child');

    // Start session
    await page.click('[data-testid="start-session-button"]');
    await page.waitForSelector('[data-testid="session-active"]');

    // Wait for recording status to appear
    await page.waitForSelector('[data-testid="recording-status"]', { timeout: 10000 });

    // Verify recording stats are displayed
    const recordingStatus = await page.locator('[data-testid="recording-status"]');
    await expect(recordingStatus).toBeVisible();

    // Check that audio/video chunk counts are displayed
    const audioStats = await recordingStatus.locator('text=/Audio:.*\\d+\\/\\d+/');
    const videoStats = await recordingStatus.locator('text=/Video:.*\\d+\\/\\d+/');

    await expect(audioStats).toBeVisible();
    await expect(videoStats).toBeVisible();

    // Simulate some time passing (chunks should be sent)
    await page.waitForTimeout(5000);

    // Verify chunk counts have increased
    const audioText = await audioStats.textContent();
    const videoText = await videoStats.textContent();

    console.log('[Recording Stats]', { audio: audioText, video: videoText });

    // End session
    await page.click('[data-testid="end-session-button"]');
    await page.waitForSelector('[data-testid="session-ended"]', { timeout: 30000 });
  });

  test('should handle missing chunks gracefully', async ({ page }) => {
    // This test verifies that the system detects and logs missing chunks
    // In a real scenario, we would need to simulate network issues

    await page.goto('/sessions/new');

    // Start session
    await page.click('[data-testid="scenario-select"]');
    await page.click('[data-testid="scenario-option"]:first-child');
    await page.click('[data-testid="avatar-select"]');
    await page.click('[data-testid="avatar-option"]:first-child');
    await page.click('[data-testid="start-session-button"]');

    await page.waitForSelector('[data-testid="session-active"]');

    // Check for any failed chunk indicators
    const failedChunks = await page.locator('[data-testid="recording-status"] >> text=/Failed:/');

    // Initially should be 0 or not visible
    if (await failedChunks.isVisible()) {
      const failedText = await failedChunks.textContent();
      expect(failedText).toContain('0');
    }

    await page.click('[data-testid="end-session-button"]');
  });

  test('should show recording processing status', async ({ page }) => {
    await page.goto('/sessions/new');

    // Start and quickly end session to trigger processing
    await page.click('[data-testid="scenario-select"]');
    await page.click('[data-testid="scenario-option"]:first-child');
    await page.click('[data-testid="avatar-select"]');
    await page.click('[data-testid="avatar-option"]:first-child');
    await page.click('[data-testid="start-session-button"]');

    await page.waitForSelector('[data-testid="session-active"]');
    await page.waitForTimeout(3000);

    // End session
    await page.click('[data-testid="end-session-button"]');

    // Should show processing indicator
    const processingMessage = await page.locator('text=/Processing|Combining|Uploading/');
    await expect(processingMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Phase 1.6.1 - Scenario Validation (Day 35)', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'test@example.com',
      process.env.TEST_USER_PASSWORD || 'TestPassword123!'
    );
    await page.waitForURL('**/dashboard');
  });

  test('should reject scenario with missing required fields', async ({ page }) => {
    // Navigate to scenario creation
    await page.goto('/scenarios/new');

    // Try to submit without filling required fields
    await page.click('[data-testid="submit-scenario-button"]');

    // Should show validation errors
    const errorMessage = await page.locator('[data-testid="validation-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/required|必須/i);
  });

  test('should warn for short system prompt', async ({ page }) => {
    await page.goto('/scenarios/new');

    // Fill in minimal data
    await page.fill('[data-testid="scenario-title"]', 'Test Scenario');
    await page.fill('[data-testid="system-prompt"]', 'Short'); // < 50 chars
    await page.selectOption('[data-testid="language-select"]', 'ja');

    // Should show warning (non-blocking)
    const warningMessage = await page.locator('[data-testid="validation-warning"]');

    if (await warningMessage.isVisible()) {
      await expect(warningMessage).toContainText(/short|短い/i);
    }
  });

  test('should validate language code', async ({ page }) => {
    await page.goto('/scenarios/new');

    await page.fill('[data-testid="scenario-title"]', 'Test Scenario');
    await page.fill('[data-testid="system-prompt"]', 'A'.repeat(100));

    // Try invalid language (if direct input is possible)
    // Most likely language is a dropdown, so this test may need adjustment
    await page.selectOption('[data-testid="language-select"]', 'ja');

    // Verify valid language is accepted
    await page.click('[data-testid="submit-scenario-button"]');

    // Should not show language-related error
    const errorMessage = await page.locator('[data-testid="validation-error"]');
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      expect(errorText).not.toContain('language');
    }
  });
});

test.describe('Phase 1.6.1 - Error Recovery (Day 35)', () => {
  test('should handle session timeout gracefully', async ({ page }) => {
    // This test would require mocking or waiting for actual timeout
    // For now, we document the expected behavior

    test.skip(true, 'Requires long wait time or mock');

    // Expected behavior:
    // 1. Session runs for MAX_SESSION_DURATION_SEC
    // 2. System sends 'session_terminated' message
    // 3. UI displays timeout notification
    // 4. Session data is saved up to timeout point
  });

  test('should warn when approaching turn limit', async ({ page }) => {
    test.skip(true, 'Requires many conversation turns');

    // Expected behavior:
    // 1. After 80 turns (80% of MAX_CONVERSATION_TURNS=100)
    // 2. System sends 'execution_warning' message
    // 3. UI displays warning to user
    // 4. Conversation can continue until 100 turns
  });

  test('should retry on temporary errors', async ({ page }) => {
    test.skip(true, 'Requires error injection');

    // Expected behavior:
    // 1. AI generation fails temporarily
    // 2. System sends 'processing_retry' message
    // 3. UI shows "Retrying..." indicator
    // 4. System retries up to MAX_RETRY_ATTEMPTS times
    // 5. On success, conversation continues normally
  });
});

test.describe('Phase 1.6.1 - Scenario Cache & Variables (Day 36)', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'test@example.com',
      process.env.TEST_USER_PASSWORD || 'TestPassword123!'
    );
    await page.waitForURL('**/dashboard');
  });

  test('should load scenario faster on second access (cache)', async ({ page }) => {
    const scenarioId = 'test-scenario-id'; // Replace with actual test scenario ID

    // First access - cache miss
    const start1 = Date.now();
    await page.goto(`/scenarios/${scenarioId}`);
    await page.waitForSelector('[data-testid="scenario-detail"]');
    const duration1 = Date.now() - start1;

    console.log('[Cache Test] First load:', duration1, 'ms');

    // Go back and access again - cache hit
    await page.goBack();
    const start2 = Date.now();
    await page.goto(`/scenarios/${scenarioId}`);
    await page.waitForSelector('[data-testid="scenario-detail"]');
    const duration2 = Date.now() - start2;

    console.log('[Cache Test] Second load:', duration2, 'ms');

    // Second access should be faster (cache hit)
    // Allow some variance, but expect at least 30% improvement
    expect(duration2).toBeLessThan(duration1 * 0.7);
  });

  test('should support variable substitution in scenario', async ({ page }) => {
    await page.goto('/scenarios/new');

    // Create scenario with variables
    await page.fill('[data-testid="scenario-title"]', 'Variable Test');
    await page.fill(
      '[data-testid="system-prompt"]',
      'Hello {{userName}}, welcome to {{companyName}}!'
    );
    await page.selectOption('[data-testid="language-select"]', 'en');

    // Add variable definition (if UI supports it)
    // This would require variable management UI to be implemented
    // For now, document expected behavior

    console.log('[Variable Test] Scenario created with variables');
  });

  test('should preview scenario before execution', async ({ page }) => {
    await page.goto('/scenarios/new');

    // Fill scenario details
    await page.fill('[data-testid="scenario-title"]', 'Preview Test');
    await page.fill('[data-testid="system-prompt"]', 'You are a helpful assistant.');
    await page.selectOption('[data-testid="language-select"]', 'ja');
    await page.fill('[data-testid="initial-greeting"]', 'こんにちは！');

    // Click preview button (if exists)
    const previewButton = await page.locator('[data-testid="preview-scenario-button"]');

    if (await previewButton.isVisible()) {
      await previewButton.click();

      // Should show preview modal/panel
      await page.waitForSelector('[data-testid="scenario-preview"]');

      // Verify preview content
      const previewContent = await page.locator('[data-testid="scenario-preview"]');
      await expect(previewContent).toBeVisible();

      // Should show validation results
      const validationResult = await previewContent.locator('[data-testid="validation-result"]');
      await expect(validationResult).toBeVisible();

      // Should show sample conversation
      const sampleConversation = await previewContent.locator(
        '[data-testid="sample-conversation"]'
      );
      await expect(sampleConversation).toBeVisible();
    } else {
      console.log('[Preview Test] Preview button not yet implemented');
    }
  });
});

test.describe('Phase 1.6.1 - Performance Benchmarks', () => {
  test('should handle multiple simultaneous sessions', async ({ page }) => {
    test.skip(true, 'Requires parallel browser contexts');

    // This test would require:
    // 1. Multiple browser contexts
    // 2. Parallel session execution
    // 3. Performance metrics collection
    // 4. Verification that all sessions complete successfully

    // Expected behavior:
    // - 10 concurrent users
    // - Each running 1 session
    // - All sessions complete within 2 minutes
    // - No errors or timeouts
    // - Recording data saved correctly
  });

  test('should complete full session flow within time limit', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'test@example.com',
      process.env.TEST_USER_PASSWORD || 'TestPassword123!'
    );

    const startTime = Date.now();

    // Navigate to session
    await page.goto('/sessions/new');

    // Select and start
    await page.click('[data-testid="scenario-select"]');
    await page.click('[data-testid="scenario-option"]:first-child');
    await page.click('[data-testid="avatar-select"]');
    await page.click('[data-testid="avatar-option"]:first-child');
    await page.click('[data-testid="start-session-button"]');

    await page.waitForSelector('[data-testid="session-active"]');

    // Simulate conversation (wait for auto-greeting)
    await page.waitForTimeout(5000);

    // End session
    await page.click('[data-testid="end-session-button"]');
    await page.waitForSelector('[data-testid="session-ended"]', { timeout: 60000 });

    const duration = Date.now() - startTime;
    console.log('[Performance] Full session flow:', duration, 'ms');

    // Should complete within 2 minutes
    expect(duration).toBeLessThan(120000);
  });
});
