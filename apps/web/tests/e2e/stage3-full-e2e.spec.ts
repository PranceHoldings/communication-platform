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

import { test, expect } from './fixtures/auth.fixture';
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
  }) => {
    // Create a real session (or use test session)
    const testSessionId = 'real-session-id';
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();

    // Wait for WebSocket connection (CONNECTING → READY)
    await sessionPlayer.waitForStatus('READY', 15000);

    // Verify microphone is recording
    await authenticatedPage.waitForTimeout(1000);
    const isMicRecording = await sessionPlayer.isMicrophoneRecording();
    expect(isMicRecording).toBe(true);
  });

  test('S3-002: Initial greeting from backend', async ({ authenticatedPage }) => {
    const testSessionId = 'real-session-id';
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('READY', 15000);

    // Wait for initial greeting message
    await sessionPlayer.waitForNewTranscriptMessage(30000);

    // Verify greeting is from AI
    const greeting = await sessionPlayer.getLatestTranscriptMessage();
    expect(greeting?.speaker).toBe('AI');
    expect(greeting?.text).toBeTruthy();

    // Status should transition to ACTIVE after greeting
    await sessionPlayer.waitForStatus('ACTIVE', 10000);

    // Silence timer should start
    await authenticatedPage.waitForTimeout(2000);
    const isTimerVisible = await sessionPlayer.isSilenceTimerVisible();
    expect(isTimerVisible).toBe(true);
  });

  test('S3-003: Full conversation cycle with real audio', async ({ authenticatedPage }) => {
    const testSessionId = 'real-session-id';
    await sessionPlayer.goto(testSessionId);

    // Start session and wait for greeting
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Simulate user speech (fake audio device generates data)
    console.log('[Test] Simulating user speech (3 seconds)...');
    await sessionPlayer.simulateUserSpeech(3000);

    // Wait for speech_end to be detected (automatic after silence)
    await authenticatedPage.waitForTimeout(2000); // Wait for silence detection

    // Wait for processing: STT → AI → TTS
    await sessionPlayer.waitForProcessingStage('stt', 10000);
    console.log('[Test] STT processing started');

    // Wait for user transcript to appear
    await sessionPlayer.waitForNewTranscriptMessage(30000);
    const userMessage = await sessionPlayer.getLatestTranscriptMessage();
    expect(userMessage?.speaker).toBe('USER');

    // Wait for AI response
    await sessionPlayer.waitForNewTranscriptMessage(30000);
    const aiMessage = await sessionPlayer.getLatestTranscriptMessage();
    expect(aiMessage?.speaker).toBe('AI');

    // Wait for audio playback
    await authenticatedPage.waitForTimeout(2000);
    // const isSpeakerPlaying = await sessionPlayer.isSpeakerPlaying();

    // Processing should complete and return to idle
    await sessionPlayer.waitForProcessingStage('idle', 30000);
  });

  test('S3-004: Silence timer increments in real-time', async ({ authenticatedPage }) => {
    const testSessionId = 'real-session-id';
    await sessionPlayer.goto(testSessionId);

    // Start session and wait for active state
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Wait for silence timer to become visible
    await authenticatedPage.waitForTimeout(2000);
    const isTimerVisible = await sessionPlayer.isSilenceTimerVisible();
    expect(isTimerVisible).toBe(true);

    // Record initial timer value
    const initialTime = await sessionPlayer.getSilenceElapsedTime();

    // Wait 3 seconds
    await authenticatedPage.waitForTimeout(3000);

    // Verify timer has incremented
    const currentTime = await sessionPlayer.getSilenceElapsedTime();
    expect(currentTime).toBeGreaterThan(initialTime);
    expect(currentTime).toBeGreaterThanOrEqual(initialTime + 2); // At least 2 seconds
  });

  test('S3-005: Manual stop during active session', async ({ authenticatedPage: _authenticatedPage }) => {
    const testSessionId = 'real-session-id';
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

    // Verify stop button is disabled
    await expect(sessionPlayer.stopButton).toBeDisabled();
  });

  test('S3-006: Session completion and cleanup', async ({ authenticatedPage }) => {
    const testSessionId = 'real-session-id';
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

    // Verify UI is in final state
    await expect(sessionPlayer.startButton).toBeDisabled();

    // Verify transcript is preserved
    const messageCount = await sessionPlayer.getTranscriptMessageCount();
    expect(messageCount).toBeGreaterThan(0);

    // Verify session duration is displayed
    const duration = await sessionPlayer.getSessionDuration();
    expect(duration).not.toBe('0:00');
  });

  test('S3-007: Multiple speech cycles in one session', async ({ authenticatedPage }) => {
    const testSessionId = 'real-session-id';
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Cycle 1
    await sessionPlayer.simulateUserSpeech(2000);
    await authenticatedPage.waitForTimeout(3000); // Silence detection
    await sessionPlayer.waitForNewTranscriptMessage(30000); // USER message
    await sessionPlayer.waitForNewTranscriptMessage(30000); // AI response

    // Wait for processing to complete
    await sessionPlayer.waitForProcessingStage('idle', 30000);

    // Cycle 2
    await sessionPlayer.simulateUserSpeech(2000);
    await authenticatedPage.waitForTimeout(3000);
    await sessionPlayer.waitForNewTranscriptMessage(30000); // USER message
    await sessionPlayer.waitForNewTranscriptMessage(30000); // AI response

    // Wait for processing to complete
    await sessionPlayer.waitForProcessingStage('idle', 30000);

    // Verify transcript has at least 5 messages (1 greeting + 2 cycles * 2)
    const messageCount = await sessionPlayer.getTranscriptMessageCount();
    expect(messageCount).toBeGreaterThanOrEqual(5);
  });

  test('S3-008: Error recovery - continue after error', async ({ authenticatedPage }) => {
    const testSessionId = 'real-session-id';
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

  test('S3-009: Silence timer resets after AI response', async ({ authenticatedPage }) => {
    const testSessionId = 'real-session-id';
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // User speaks
    await sessionPlayer.simulateUserSpeech(3000);
    await authenticatedPage.waitForTimeout(3000);

    // Wait for AI response to complete
    await sessionPlayer.waitForNewTranscriptMessage(30000); // USER
    await sessionPlayer.waitForNewTranscriptMessage(30000); // AI
    await sessionPlayer.waitForProcessingStage('idle', 30000);

    // Wait for silence timer to start
    await authenticatedPage.waitForTimeout(2000);

    // Verify silence timer is counting
    const elapsedTime = await sessionPlayer.getSilenceElapsedTime();
    expect(elapsedTime).toBeGreaterThan(0);
    expect(elapsedTime).toBeLessThan(5); // Should be reset after AI response
  });

  test('S3-010: Long session with multiple exchanges (stress test)', async ({
    authenticatedPage,
  }) => {
    test.slow(); // Mark as slow test (3x timeout)

    const testSessionId = 'real-session-id';
    await sessionPlayer.goto(testSessionId);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('ACTIVE', 15000);

    // Perform 5 conversation cycles
    for (let i = 0; i < 5; i++) {
      console.log(`[Test] Conversation cycle ${i + 1}/5`);

      // User speaks
      await sessionPlayer.simulateUserSpeech(2000);
      await authenticatedPage.waitForTimeout(3000);

      // Wait for responses
      await sessionPlayer.waitForNewTranscriptMessage(30000);
      await sessionPlayer.waitForNewTranscriptMessage(30000);
      await sessionPlayer.waitForProcessingStage('idle', 30000);

      // Small pause between cycles
      await authenticatedPage.waitForTimeout(1000);
    }

    // Verify transcript has all messages (1 greeting + 5 cycles * 2)
    const messageCount = await sessionPlayer.getTranscriptMessageCount();
    expect(messageCount).toBeGreaterThanOrEqual(11);

    // Stop session
    await sessionPlayer.stopSession();
    await sessionPlayer.waitForStatus('COMPLETED', 15000);
  });
});
