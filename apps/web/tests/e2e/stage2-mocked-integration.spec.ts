/**
 * Stage 2: Mocked Integration Tests (Simplified)
 *
 * Tests basic WebSocket communication with mocked messages.
 * Focus: Core functionality that works reliably in mock environment.
 *
 * Test Coverage:
 * - WebSocket connection and authentication
 * - Message sending and receiving
 * - Session state transitions
 * - Transcript updates
 *
 * Out of Scope (moved to Stage 3):
 * - Processing stage UI (requires real processing_update messages)
 * - Silence timer (requires scenario configuration)
 * - Error dialogs (requires implementation verification)
 * - Audio playback details (requires real audio)
 */

import { test, expect } from './fixtures/session.fixture';
import { SessionPlayerPage } from './page-objects/session-player.page';
import { WebSocketMock } from './helpers/websocket-mock';

test.describe('Stage 2: Mocked Integration Tests (Core)', () => {
  let wsMock: WebSocketMock;
  let sessionPlayer: SessionPlayerPage;

  test.beforeEach(async ({ authenticatedPage, testSessionId }) => {
    // Setup WebSocket mock
    wsMock = new WebSocketMock(authenticatedPage);
    await wsMock.setup();

    // Navigate to session player with real session ID
    sessionPlayer = new SessionPlayerPage(authenticatedPage);
    await sessionPlayer.goto(testSessionId);
  });

  test('S2-CORE-001: WebSocket connection and authentication flow', async ({ authenticatedPage }) => {
    console.log('[Test] S2-CORE-001: Starting WebSocket authentication test');

    // Step 1: Start session (should transition to READY)
    await sessionPlayer.startSession();
    console.log('[Test] Session started, waiting for READY status');

    // Step 2: Wait for READY status (auto-transition)
    await sessionPlayer.waitForStatus('READY', 5000);
    console.log('[Test] READY status confirmed');

    // Step 3: Wait for WebSocket connection
    await wsMock.waitForConnection();
    console.log('[Test] WebSocket connected');

    // Step 4: Wait for onmessage handler setup (CRITICAL for message reception)
    await authenticatedPage.waitForTimeout(500);
    console.log('[Test] Handler setup complete');

    // Step 5: Send authenticated message
    await wsMock.sendAuthenticated('test-session-id');
    console.log('[Test] Authentication message sent');

    // Step 6: Wait for authentication to process (small delay)
    await authenticatedPage.waitForTimeout(200);

    // Step 7: Send initial greeting
    const greetingText = 'Hello! Welcome to your session.';
    await wsMock.sendGreeting(greetingText);
    console.log('[Test] Greeting sent');

    // Step 8: Verify greeting appears in transcript
    await sessionPlayer.waitForTranscriptContaining(greetingText, 5000);
    console.log('[Test] Greeting found in transcript');

    // Step 9: Verify status transitions to ACTIVE
    await sessionPlayer.waitForStatus('ACTIVE', 5000);
    console.log('[Test] ACTIVE status confirmed');

    // Step 10: Verify latest transcript message
    const latestMessage = await sessionPlayer.getLatestTranscriptMessage();
    expect(latestMessage?.speaker).toBe('AI');
    expect(latestMessage?.text).toContain(greetingText);
    console.log('[Test] ✅ All assertions passed');
  });

  test('S2-CORE-002: Simple conversation cycle', async ({ authenticatedPage }) => {
    console.log('[Test] S2-CORE-002: Starting conversation cycle test');

    // Setup: Establish authenticated session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('READY', 5000);
    await wsMock.waitForConnection();
    await authenticatedPage.waitForTimeout(500);
    await wsMock.sendAuthenticated('test-session-id');
    await wsMock.sendGreeting('Welcome!');
    await sessionPlayer.waitForStatus('ACTIVE', 5000);
    console.log('[Test] Setup complete - session is ACTIVE');

    // Step 1: Simulate user speaking
    const userText = 'Hello, I am ready to start.';
    await wsMock.sendTranscript('USER', userText);
    console.log('[Test] User transcript sent');

    // Step 2: Wait for transcript to update
    await authenticatedPage.waitForTimeout(300);

    // Step 3: Verify user message in transcript
    const userMessage = await sessionPlayer.getLatestTranscriptMessage();
    expect(userMessage?.speaker).toBe('USER');
    expect(userMessage?.text).toContain(userText);
    console.log('[Test] User message verified in transcript');

    // Step 4: Simulate AI response
    const aiText = 'Great! Let me ask you a question.';
    await wsMock.sendAvatarResponse(aiText);
    console.log('[Test] AI response sent');

    // Step 5: Wait for AI message to appear in transcript
    // Use text-based wait to avoid race condition where message arrives before count is captured
    await sessionPlayer.waitForTranscriptContaining(aiText, 5000);

    // Step 6: Verify AI message in transcript
    const aiMessage = await sessionPlayer.getLatestTranscriptMessage();
    expect(aiMessage?.speaker).toBe('AI');
    expect(aiMessage?.text).toContain(aiText);
    console.log('[Test] AI message verified in transcript');

    // Step 7: Verify session is still ACTIVE
    await sessionPlayer.waitForStatus('ACTIVE', 2000);
    console.log('[Test] ✅ Conversation cycle completed successfully');
  });

  test('S2-CORE-003: Session termination flow', async ({ authenticatedPage }) => {
    console.log('[Test] S2-CORE-003: Starting session termination test');

    // Setup: Establish active session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('READY', 5000);
    await wsMock.waitForConnection();
    await authenticatedPage.waitForTimeout(500);
    await wsMock.sendAuthenticated('test-session-id');
    await wsMock.sendGreeting('Welcome!');
    await sessionPlayer.waitForStatus('ACTIVE', 5000);
    console.log('[Test] Setup complete - session is ACTIVE');

    // Step 1: Clear sent messages (to verify session_end is sent)
    await wsMock.clearSentMessages();
    console.log('[Test] Cleared sent messages');

    // Step 2: User clicks stop button
    await sessionPlayer.stopSession();
    console.log('[Test] Stop button clicked');

    // Step 3: Wait for client to send stop messages
    // Implementation sends speech_end first (if recording), then session_end
    await authenticatedPage.waitForTimeout(1000);

    // Step 4: Verify stop-related messages were sent
    const sentMessages = await wsMock.getSentMessages();
    const hasSpeechEnd = sentMessages.some((msg) => {
      try {
        const parsed = JSON.parse(msg);
        return parsed.type === 'speech_end';
      } catch {
        return false;
      }
    });
    const hasSessionEnd = sentMessages.some((msg) => {
      try {
        const parsed = JSON.parse(msg);
        return parsed.type === 'session_end';
      } catch {
        return false;
      }
    });

    // Either speech_end or session_end should be sent (depends on recording state)
    expect(hasSpeechEnd || hasSessionEnd).toBe(true);
    console.log(`[Test] Stop messages verified (speech_end: ${hasSpeechEnd}, session_end: ${hasSessionEnd})`);

    // Step 5: Server sends session_complete
    await wsMock.sendSessionComplete();
    console.log('[Test] session_complete sent');

    // Step 6: Verify status transitions to COMPLETED
    await sessionPlayer.waitForStatus('COMPLETED', 5000);
    console.log('[Test] ✅ Session termination completed successfully');
  });

  test('S2-CORE-004: Multiple conversation exchanges', async ({ authenticatedPage }) => {
    console.log('[Test] S2-CORE-004: Starting multiple exchanges test');

    // Setup: Establish active session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForStatus('READY', 5000);
    await wsMock.waitForConnection();
    await authenticatedPage.waitForTimeout(500);
    await wsMock.sendAuthenticated('test-session-id');
    await wsMock.sendGreeting('Hello!');
    await sessionPlayer.waitForStatus('ACTIVE', 5000);
    console.log('[Test] Setup complete');

    // Exchange 1
    console.log('[Test] Starting exchange 1');
    await wsMock.simulateConversation(
      'I am excited to start.',
      'Great! Tell me about your background.',
      'https://example.com/q1.mp3'
    );
    await authenticatedPage.waitForTimeout(1000);

    // Exchange 2
    console.log('[Test] Starting exchange 2');
    await wsMock.simulateConversation(
      'I have 5 years of experience.',
      'Excellent! What technologies do you use?',
      'https://example.com/q2.mp3'
    );
    await authenticatedPage.waitForTimeout(1000);

    // Exchange 3
    console.log('[Test] Starting exchange 3');
    await wsMock.simulateConversation(
      'I specialize in React and Node.js.',
      'Very good! Let me ask you a technical question.',
      'https://example.com/q3.mp3'
    );
    await authenticatedPage.waitForTimeout(1000);

    // Verify transcript has all messages (1 greeting + 3 exchanges * 2 messages)
    const messageCount = await sessionPlayer.getTranscriptMessageCount();
    expect(messageCount).toBeGreaterThanOrEqual(7); // 1 + 3*2
    console.log(`[Test] ✅ Transcript contains ${messageCount} messages (expected >= 7)`);
  });
});

/**
 * Stage 2: Extended Tests (requires Mock enhancements)
 *
 * These tests are skipped until Mock environment is enhanced with:
 * - Automatic processing_update message sending
 * - Configurable scenario settings
 * - Toast notification selectors
 */
test.describe.skip('Stage 2: Extended Tests (TODO)', () => {
  let wsMock: WebSocketMock;
  let sessionPlayer: SessionPlayerPage;

  test.beforeEach(async ({ authenticatedPage, testSessionId }) => {
    wsMock = new WebSocketMock(authenticatedPage);
    await wsMock.setup();
    sessionPlayer = new SessionPlayerPage(authenticatedPage);
    await sessionPlayer.goto(testSessionId);
  });

  test('S2-EXT-001: Processing stage transitions', async ({ authenticatedPage }) => {
    // TODO: Requires automatic processing_update messages in Mock
    // - Send user transcript
    // - Verify 'ai' processing stage
    // - Send AI response
    // - Verify 'tts' processing stage
    // - Verify 'idle' stage after completion
  });

  test('S2-EXT-002: Silence timer behavior', async ({ authenticatedPage }) => {
    // TODO: Requires scenario with showSilenceTimer=true
    // - Verify timer starts after greeting
    // - Verify timer resets on user speech
    // - Verify timer pauses during AI playback
  });

  test('S2-EXT-003: Error handling with toast notifications', async ({ authenticatedPage }) => {
    // TODO: Requires correct toast notification selectors
    // - Send error message
    // - Verify toast appears with error text
  });
});
