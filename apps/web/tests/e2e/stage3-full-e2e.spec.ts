/**
 * Stage 3: Full E2E Tests
 *
 * Tests with real WebSocket connections, microphone permissions, and audio processing.
 *
 * Prerequisites:
 * - Backend WebSocket server running (or mock WebSocket server)
 * - Playwright configured with fake audio/video devices
 * - Microphone permissions auto-granted
 *
 * Test Coverage:
 * - Real WebSocket connection
 * - Microphone permission handling
 * - Audio recording and streaming
 * - Full conversation flow (end-to-end)
 * - Session completion
 */

import { test, expect } from './fixtures/session.fixture';
import { SessionPlayerPage } from './page-objects/session-player.page';

test.describe('Stage 3: Full E2E Tests', () => {
  let sessionPlayer: SessionPlayerPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    // Grant microphone and camera permissions
    await authenticatedPage.context().grantPermissions(['microphone', 'camera']);

    // Navigate to session player
    sessionPlayer = new SessionPlayerPage(authenticatedPage);
  });

  test('S3-001: Real WebSocket connection and authentication', async ({
    authenticatedPage,
    testSessionId,
  }) => {
    // Use real session ID from fixture
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();

    // Wait for WebSocket connection and authentication (READY → ACTIVE)
    // READY = button clicked, ACTIVE = WebSocket connected + authenticated + recording started
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Verify microphone is recording (startRecording() is called when ACTIVE)
    await authenticatedPage.waitForTimeout(1000);
    const isMicRecording = await sessionPlayer.isMicrophoneRecording();
    expect(isMicRecording).toBe(true);
  });

  test('S3-002: Initial greeting from backend', async ({ authenticatedPage, testSessionId }) => {
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();

    // Wait for ACTIVE state — text arrives almost immediately after authentication with Lambda fix
    // Use waitForAnyStatus to handle fast READY→ACTIVE transitions
    await sessionPlayer.waitForAnyStatus(['READY', 'ACTIVE'], 20000);
    console.log('[Test] Session started, checking for greeting...');

    // With Lambda fix, avatar_response_final text is sent before TTS generation.
    // The greeting may already be in the transcript by the time we check.
    await authenticatedPage.waitForTimeout(3000);
    const count = await sessionPlayer.getTranscriptMessageCount();
    if (count === 0) {
      // Greeting not yet arrived — wait for it
      console.log('[Test] Greeting not yet in transcript, waiting...');
      await sessionPlayer.waitForNewTranscriptMessage(30000);
    } else {
      console.log(`[Test] Greeting already in transcript (${count} messages)`);
    }

    // Verify greeting is from AI
    const greeting = await sessionPlayer.getLatestTranscriptMessage();
    expect(greeting?.speaker).toBe('AI');
    expect(greeting?.text).toBeTruthy();

    // Status should be ACTIVE
    await sessionPlayer.waitForStatus('ACTIVE', 10000);

    // Silence timer visibility depends on scenario settings (showSilenceTimer)
    await authenticatedPage.waitForTimeout(2000);
    // Not asserting timer visibility here - it depends on scenario configuration
  });

  test('S3-003: AI responds to silence with silence prompt', async ({ authenticatedPage, greetingTestSessionId }) => {
    test.slow(); // Cold start + AI processing can take 40-50s

    await sessionPlayer.goto(greetingTestSessionId);

    // Start session and wait for active state
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Wait for initial AI greeting (may already be in transcript when ACTIVE is reached)
    // Then wait for silence prompt (second AI message, fires after ~10s silence)
    // Backend processing: 10-20s → use 60s timeout for both
    console.log('[Test] Waiting for AI messages (greeting + silence prompt)...');
    await sessionPlayer.waitForNewTranscriptMessage(60000);
    const greeting = await sessionPlayer.getLatestTranscriptMessage();
    expect(greeting?.speaker).toBe('AI');
    expect(greeting?.text).toBeTruthy();

    // After greeting audio finishes, silence timer starts.
    // The silence prompt will fire after the configured timeout (~10s).
    // No user speech needed - silence prompt is triggered automatically.
    console.log('[Test] Waiting for silence prompt AI response (silence timer will fire)...');
    await sessionPlayer.waitForNewTranscriptMessage(60000);

    const silencePromptResponse = await sessionPlayer.getLatestTranscriptMessage();
    expect(silencePromptResponse?.speaker).toBe('AI');
    expect(silencePromptResponse?.text).toBeTruthy();

    // Processing should complete and return to idle
    await sessionPlayer.waitForProcessingStage('idle', 30000);

    // Session should still be active
    await sessionPlayer.waitForStatus('ACTIVE', 5000);
  });

  test('S3-004: Silence timer increments in real-time', async ({ authenticatedPage, testSessionId }) => {
    await sessionPlayer.goto(testSessionId);

    // Start session and wait for active state
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Check if silence timer is visible (depends on scenario showSilenceTimer setting)
    await authenticatedPage.waitForTimeout(2000);
    const isTimerVisible = await sessionPlayer.isSilenceTimerVisible();

    if (isTimerVisible) {
      // Record initial timer value
      const initialTime = await sessionPlayer.getSilenceElapsedTime();

      // Wait 3 seconds
      await authenticatedPage.waitForTimeout(3000);

      // Verify timer has incremented
      const currentTime = await sessionPlayer.getSilenceElapsedTime();
      expect(currentTime).toBeGreaterThan(initialTime);
      expect(currentTime).toBeGreaterThanOrEqual(initialTime + 2); // At least 2 seconds
    } else {
      // Timer not visible for this scenario - verify session is still active
      await sessionPlayer.waitForStatus('ACTIVE', 5000);
    }
  });

  test('S3-005: Manual stop during active session', async ({ authenticatedPage: _authenticatedPage, testSessionId }) => {
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Simulate user speech
    await sessionPlayer.simulateUserSpeech(2000);

    // Stop session while recording
    await sessionPlayer.stopSession();

    // Wait for session to complete
    await sessionPlayer.waitForStatus('COMPLETED', 15000);

    // In COMPLETED state, buttons are removed from DOM - verify status badge shows completed
    await expect(sessionPlayer.statusBadge).toContainText(/completed/i);
  });

  test('S3-006: Session completion and cleanup', async ({ authenticatedPage, testSessionId }) => {
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Simulate conversation
    await sessionPlayer.simulateUserSpeech(3000);
    await authenticatedPage.waitForTimeout(5000); // Wait for processing

    // Stop session
    await sessionPlayer.stopSession();

    // Wait for completion
    await sessionPlayer.waitForStatus('COMPLETED', 15000);

    // Verify UI is in final state - in COMPLETED state, buttons are removed from DOM
    await expect(sessionPlayer.statusBadge).toContainText(/completed/i);

    // Verify transcript is preserved
    const messageCount = await sessionPlayer.getTranscriptMessageCount();
    expect(messageCount).toBeGreaterThan(0);

    // Verify session duration is displayed
    const duration = await sessionPlayer.getSessionDuration();
    expect(duration).not.toBe('0:00');
  });

  test('S3-007: Multiple silence prompt cycles in one session', async ({ authenticatedPage: _authenticatedPage, greetingTestSessionId }) => {
    test.slow(); // Multiple AI exchanges with potential cold start delay

    await sessionPlayer.goto(greetingTestSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Wait for initial AI greeting (or first silence prompt if greeting already in transcript)
    console.log('[Test] Waiting for initial AI greeting...');
    await sessionPlayer.waitForNewTranscriptMessage(60000);

    // Silence prompt cycle 1: silence timer fires → AI responds
    console.log('[Test] Waiting for silence prompt response 1...');
    await sessionPlayer.waitForNewTranscriptMessage(60000);
    await sessionPlayer.waitForProcessingStage('idle', 30000);

    // Silence prompt cycle 2: timer resets after AI response → fires again
    console.log('[Test] Waiting for silence prompt response 2...');
    await sessionPlayer.waitForNewTranscriptMessage(60000);
    await sessionPlayer.waitForProcessingStage('idle', 30000);

    // Verify transcript has at least 3 messages (greeting + 2 silence prompts)
    const messageCount = await sessionPlayer.getTranscriptMessageCount();
    expect(messageCount).toBeGreaterThanOrEqual(3);
  });

  test('S3-008: Error recovery - continue after error', async ({ authenticatedPage, testSessionId }) => {
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Simulate very quiet speech (may trigger NO_AUDIO_DATA error)
    // Note: Fake audio device may not support volume control
    // This test validates that session can continue after error

    await sessionPlayer.simulateUserSpeech(500); // Very short speech
    await authenticatedPage.waitForTimeout(3000);

    // If error occurs, close error dialog and continue
    const errorDialog = authenticatedPage.locator('[role="alertdialog"], [role="dialog"]');
    const isErrorVisible = await errorDialog.isVisible().catch(() => false);

    if (isErrorVisible) {
      // Close error dialog
      const closeButton = errorDialog.locator('button', { hasText: /close|ok/i });
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }

    // Session should still be active
    const status = await sessionPlayer.statusBadge.textContent();
    expect(status).toMatch(/active|in progress/i);

    // User can continue speaking
    await sessionPlayer.simulateUserSpeech(3000);
    await authenticatedPage.waitForTimeout(3000);
  });

  test('S3-009: Silence timer resets after AI silence prompt response', async ({ authenticatedPage, greetingTestSessionId }) => {
    test.slow(); // Cold start + AI processing can take 40-50s

    await sessionPlayer.goto(greetingTestSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Wait for initial AI greeting (or first silence prompt if greeting already in transcript)
    await sessionPlayer.waitForNewTranscriptMessage(60000);

    // Wait 2s for silence timer to start after greeting
    await authenticatedPage.waitForTimeout(2000);

    const isTimerVisible = await sessionPlayer.isSilenceTimerVisible();

    if (isTimerVisible) {
      // Record elapsed time while silence timer is running
      const elapsedBefore = await sessionPlayer.getSilenceElapsedTime();
      expect(elapsedBefore).toBeGreaterThanOrEqual(0);

      // Wait for silence prompt to fire and AI to respond
      console.log('[Test] Waiting for silence prompt response to verify timer reset...');
      await sessionPlayer.waitForNewTranscriptMessage(60000);
      await sessionPlayer.waitForProcessingStage('idle', 30000);

      // After AI response, silence timer should reset to near 0
      await authenticatedPage.waitForTimeout(2000);
      const elapsedAfterReset = await sessionPlayer.getSilenceElapsedTime();
      expect(elapsedAfterReset).toBeLessThan(5); // Timer reset after AI response
    } else {
      // Silence timer not visible for this scenario configuration
      // Still verify that silence prompts generate AI responses
      console.log('[Test] Silence timer not visible - verifying silence prompt response instead');
      await sessionPlayer.waitForNewTranscriptMessage(60000);
      const msg = await sessionPlayer.getLatestTranscriptMessage();
      expect(msg?.speaker).toBe('AI');
    }
  });

  test('S3-010: Long session with multiple silence prompt exchanges (stress test)', async ({
    authenticatedPage,
    greetingTestSessionId,
  }) => {
    test.setTimeout(420000); // 7 minutes: cold start (~50s) + greeting + 3 silence prompts (~50s each) + stop

    await sessionPlayer.goto(greetingTestSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Wait for initial AI greeting (or first silence prompt if greeting already in transcript)
    console.log('[Test] Waiting for initial AI greeting...');
    await sessionPlayer.waitForNewTranscriptMessage(60000);

    // Wait for 3 silence prompt responses (silence timer fires repeatedly)
    for (let i = 0; i < 3; i++) {
      console.log(`[Test] Waiting for silence prompt response ${i + 1}/3`);
      await sessionPlayer.waitForNewTranscriptMessage(60000);
      await sessionPlayer.waitForProcessingStage('idle', 30000);

      // Small pause between cycles to allow timer to reset
      await authenticatedPage.waitForTimeout(1000);
    }

    // Verify transcript has all messages (greeting + 3 silence prompts = 4)
    const messageCount = await sessionPlayer.getTranscriptMessageCount();
    expect(messageCount).toBeGreaterThanOrEqual(4);

    // Stop session
    await sessionPlayer.stopSession();
    await sessionPlayer.waitForStatus('COMPLETED', 15000);
  });
});
