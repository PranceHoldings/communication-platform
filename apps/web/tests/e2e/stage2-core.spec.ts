/**
 * Stage 2: Core WebSocket Tests (Ultra-Simplified)
 *
 * Focuses on the most reliable, essential WebSocket functionality.
 * These tests should pass consistently in a mock environment.
 *
 * Test Coverage:
 * 1. Connection & Authentication
 * 2. Single message exchange
 * 3. Session termination
 */

import { test, expect } from './fixtures/session.fixture';
import { SessionPlayerPage } from './page-objects/session-player.page';
import { WebSocketMock } from './helpers/websocket-mock';

test.describe('Stage 2: Core WebSocket Tests', () => {
  let wsMock: WebSocketMock;
  let sessionPlayer: SessionPlayerPage;

  test.beforeEach(async ({ authenticatedPage, testSessionId }) => {
    wsMock = new WebSocketMock(authenticatedPage);
    await wsMock.setup();
    sessionPlayer = new SessionPlayerPage(authenticatedPage);
    await sessionPlayer.goto(testSessionId);
  });

  test('Core-001: Full session lifecycle', async ({ authenticatedPage }) => {
    // This test combines all essential functionality into one test
    // to avoid WebSocket state issues between tests

    console.log('[Test] === PHASE 1: Connection & Authentication ===');

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('READY', 5000);
    await wsMock.waitForConnection();
    await authenticatedPage.waitForTimeout(500);

    // Authenticate
    await wsMock.sendAuthenticated('test-session-id');
    await authenticatedPage.waitForTimeout(200);

    // Initial greeting
    const greetingText = 'Welcome to your session!';
    await wsMock.sendGreeting(greetingText);
    await sessionPlayer.waitForTranscriptContaining(greetingText, 5000);
    await sessionPlayer.waitForStatus('ACTIVE', 5000);

    console.log('[Test] ✓ Connection & Authentication successful');

    console.log('[Test] === PHASE 2: Message Exchange ===');

    // User speaks
    const userText = 'Hello, I am ready.';
    await wsMock.sendTranscript('USER', userText);
    await authenticatedPage.waitForTimeout(300);

    // Verify user message
    let latestMessage = await sessionPlayer.getLatestTranscriptMessage();
    expect(latestMessage?.speaker).toBe('USER');
    expect(latestMessage?.text).toContain(userText);

    // AI responds
    const aiText = 'Great! Let me ask you a question.';
    await wsMock.sendAvatarResponse(aiText);

    // Wait for AI message to appear in transcript
    await sessionPlayer.waitForTranscriptContaining(aiText, 5000);

    // Verify AI message
    latestMessage = await sessionPlayer.getLatestTranscriptMessage();
    expect(latestMessage?.speaker).toBe('AI');
    expect(latestMessage?.text).toContain(aiText);

    console.log('[Test] ✓ Message Exchange successful');

    console.log('[Test] === PHASE 3: Session Termination ===');

    // Clear sent messages
    await wsMock.clearSentMessages();

    // Stop session
    await sessionPlayer.stopSession();
    await authenticatedPage.waitForTimeout(1000);

    // Verify stop message sent
    const sentMessages = await wsMock.getSentMessages();
    const hasStopMessage = sentMessages.some((msg) => {
      try {
        const parsed = JSON.parse(msg);
        return parsed.type === 'speech_end' || parsed.type === 'session_end';
      } catch {
        return false;
      }
    });
    expect(hasStopMessage).toBe(true);

    // Server confirms completion
    await wsMock.sendSessionComplete();
    await sessionPlayer.waitForStatus('COMPLETED', 5000);

    console.log('[Test] ✓ Session Termination successful');
    console.log('[Test] ✅ All phases completed successfully');
  });
});
