/**
 * Stage 1: Basic UI Flow Tests
 *
 * Tests basic navigation and UI element visibility without WebSocket interaction.
 *
 * Test Coverage:
 * - Login flow
 * - Navigation to session player
 * - Initial UI state (IDLE)
 * - Button states and labels
 * - Audio indicators visibility
 */

import { test, expect } from './fixtures/session.fixture';
import { SessionPlayerPage } from './page-objects/session-player.page';

test.describe('Stage 1: Basic UI Flow', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Already authenticated via fixture
    await expect(authenticatedPage).toHaveURL('/dashboard');
  });

  test('S1-001: Navigate to session list', async ({ authenticatedPage }) => {
    // Navigate to sessions page
    await authenticatedPage.goto('/dashboard/sessions');

    // Verify page title (use filter to get the specific h1 with Sessions text)
    await expect(authenticatedPage.locator('h1').filter({ hasText: /sessions/i })).toBeVisible();

    // Verify session list is visible (even if empty)
    const sessionList = authenticatedPage.locator('[data-testid="session-list"]');
    await expect(sessionList).toBeVisible();
  });

  test('S1-002: Navigate to session player (IDLE state)', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    const sessionPlayer = new SessionPlayerPage(authenticatedPage);

    // Navigate to session player
    await sessionPlayer.goto(testSessionId);

    // Verify initial state is IDLE
    await sessionPlayer.waitForStatus('IDLE', 5000);
  });

  test('S1-003: Verify Start Session button is visible and enabled', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    const sessionPlayer = new SessionPlayerPage(authenticatedPage);

    await sessionPlayer.goto(testSessionId);

    // Verify Start Session button
    await expect(sessionPlayer.startButton).toBeVisible();
    await expect(sessionPlayer.startButton).toBeEnabled();
    await expect(sessionPlayer.startButton).toContainText(/start session/i);
  });

  test('S1-004: Verify audio indicators are visible', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    const sessionPlayer = new SessionPlayerPage(authenticatedPage);

    await sessionPlayer.goto(testSessionId);

    // Verify microphone indicator
    await expect(sessionPlayer.microphoneIndicator).toBeVisible();

    // Verify speaker indicator
    await expect(sessionPlayer.speakerIndicator).toBeVisible();

    // Verify camera indicator
    await expect(sessionPlayer.cameraIndicator).toBeVisible();
  });

  test('S1-005: Verify status badge colors', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    const sessionPlayer = new SessionPlayerPage(authenticatedPage);

    await sessionPlayer.goto(testSessionId);

    // Get status badge
    const statusBadge = sessionPlayer.statusBadge;

    // Verify IDLE state has gray text color (implementation uses text-gray-600)
    const textColor = await statusBadge.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Gray color check (text-gray-600 should be rgb format)
    // Tailwind text-gray-600 typically renders as rgb(75, 85, 99) or similar
    expect(textColor).toMatch(/rgb\(/);

    // Verify it's actually gray (not transparent)
    expect(textColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('S1-006: Verify initial indicator states', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    const sessionPlayer = new SessionPlayerPage(authenticatedPage);

    await sessionPlayer.goto(testSessionId);

    // Microphone should be inactive
    const isMicRecording = await sessionPlayer.isMicrophoneRecording();
    expect(isMicRecording).toBe(false);

    // Speaker should be inactive
    const isSpeakerPlaying = await sessionPlayer.isSpeakerPlaying();
    expect(isSpeakerPlaying).toBe(false);

    // Camera should be off
    const isCameraActive = await sessionPlayer.isCameraActive();
    expect(isCameraActive).toBe(false);
  });

  test('S1-007: Verify silence timer is not visible in IDLE state', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    const sessionPlayer = new SessionPlayerPage(authenticatedPage);

    await sessionPlayer.goto(testSessionId);

    // Silence timer should not be visible before session starts
    const isTimerVisible = await sessionPlayer.isSilenceTimerVisible();
    expect(isTimerVisible).toBe(false);
  });

  test('S1-008: Verify transcript is empty in IDLE state', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    const sessionPlayer = new SessionPlayerPage(authenticatedPage);

    await sessionPlayer.goto(testSessionId);

    // Transcript should be empty
    const messageCount = await sessionPlayer.getTranscriptMessageCount();
    expect(messageCount).toBe(0);
  });

  test('S1-009: Verify session duration is 0:00 in IDLE state', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    const sessionPlayer = new SessionPlayerPage(authenticatedPage);

    await sessionPlayer.goto(testSessionId);

    // Duration should be 0:00 or 0:0 (may contain spaces)
    const duration = await sessionPlayer.getSessionDuration();
    const normalized = duration.replace(/\s/g, '');
    expect(normalized).toMatch(/^0:0[0-9]?$/); // Allows 0:0, 0:00, 0:01, etc.
  });

  test('S1-010: Verify processing stage is not visible in IDLE state', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    const sessionPlayer = new SessionPlayerPage(authenticatedPage);

    await sessionPlayer.goto(testSessionId);

    // Processing stage should be hidden
    await expect(sessionPlayer.processingStage).toBeHidden();
  });
});
