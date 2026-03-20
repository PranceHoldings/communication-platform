/**
 * Stage 3 Part 2: Initial Greeting Scenario Tests
 *
 * Tests WebSocket integration with scenarios that have initial greeting configured.
 *
 * Scenario Configuration:
 * - Title: [E2E Test] Initial Greeting Test
 * - Initial Greeting: "Hello! Welcome to your interview session. My name is AI Assistant. How are you feeling today?"
 * - Enable Silence Prompt: true
 * - Show Silence Timer: true
 * - Language: en
 *
 * Test Coverage:
 * - Initial greeting message reception
 * - WebSocket message flow with greeting
 * - Toast notifications (future)
 * - Multi-turn conversation (future)
 */

import { test, expect } from './fixtures/session.fixture';
import { SessionPlayerPage } from './page-objects/session-player.page';
import greetingScenarioData from './test-data/greeting-scenario.json';

// Expected greeting message content
const EXPECTED_GREETING = 'Hello! Welcome to your interview session';
// Use the specific session ID created with initial greeting
const GREETING_TEST_SESSION_ID = greetingScenarioData.sessionId;

test.describe('Stage 3 Part 2: Initial Greeting', () => {
  let sessionPlayer: SessionPlayerPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    // Grant microphone and camera permissions
    await authenticatedPage.context().grantPermissions(['microphone', 'camera']);

    // Navigate to session player
    sessionPlayer = new SessionPlayerPage(authenticatedPage);
  });

  test('S3-Part2-001: Initial greeting message reception', async ({ authenticatedPage }) => {
    console.log('[Test] === S3-Part2-001: Initial Greeting Reception ===');
    console.log(`[Test] Using greeting test session: ${GREETING_TEST_SESSION_ID}`);

    // Navigate to session with initial greeting
    await sessionPlayer.goto(GREETING_TEST_SESSION_ID);
    await authenticatedPage.waitForTimeout(1000);

    // Start session
    console.log('[Test] Starting session...');
    await sessionPlayer.startSession();

    // Wait for session to start
    console.log('[Test] Waiting for session to start...');
    await sessionPlayer.waitForSessionStarted(15000);
    console.log('[Test] ✓ Session started');

    // Wait for WebSocket connection
    const status = await sessionPlayer.waitForAnyStatus(['READY', 'ACTIVE'], 15000);
    console.log(`[Test] ✓ Status: ${status}`);

    // Initial greeting should already be displayed (sent during authentication)
    console.log('[Test] Checking for initial greeting message...');
    await authenticatedPage.waitForTimeout(2000); // Give time for message to render

    // Get the greeting message (should already exist)
    const greeting = await sessionPlayer.getLatestTranscriptMessage();
    console.log(`[Test] ✓ Greeting found from: ${greeting?.speaker}`);
    console.log(`[Test] ✓ Greeting text: ${greeting?.text}`);

    // Verify greeting
    expect(greeting?.speaker).toBe('AI');
    expect(greeting?.text).toBeTruthy();
    expect(greeting?.text).toContain(EXPECTED_GREETING);

    console.log('[Test] ✅ Initial greeting reception verified');

    // Clean up - stop session
    await sessionPlayer.stopSession();
    await sessionPlayer.waitForStatus('COMPLETED', 15000);
    console.log('[Test] ✓ Session stopped');
  });

  test('S3-Part2-002: WebSocket message flow with greeting', async ({ authenticatedPage }) => {
    console.log('[Test] === S3-Part2-002: Message Flow ===');
    console.log(`[Test] Using greeting test session: ${GREETING_TEST_SESSION_ID}`);

    await sessionPlayer.goto(GREETING_TEST_SESSION_ID);
    await authenticatedPage.waitForTimeout(1000);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForSessionStarted(15000);
    console.log('[Test] ✓ Session started');

    // Wait for connection
    const status = await sessionPlayer.waitForAnyStatus(['READY', 'ACTIVE'], 15000);
    console.log(`[Test] ✓ Status: ${status}`);

    // Initial greeting should already be displayed
    await authenticatedPage.waitForTimeout(2000);
    const greeting = await sessionPlayer.getLatestTranscriptMessage();
    console.log(`[Test] ✓ Initial greeting: ${greeting?.text?.substring(0, 50)}...`);

    // Verify WebSocket is connected and messages can flow
    expect(greeting).toBeTruthy();
    expect(greeting?.speaker).toBe('AI');

    // Verify control buttons are functional
    await expect(sessionPlayer.pauseButton).toBeVisible();
    await expect(sessionPlayer.stopButton).toBeVisible();
    console.log('[Test] ✓ Control buttons visible');

    // Verify session can be stopped
    await sessionPlayer.stopSession();
    await sessionPlayer.waitForStatus('COMPLETED', 15000);
    console.log('[Test] ✓ Session completed');

    console.log('[Test] ✅ WebSocket message flow verified');
  });

  test('S3-Part2-003: Complete session lifecycle with greeting', async ({ authenticatedPage }) => {
    console.log('[Test] === S3-Part2-003: Complete Lifecycle ===');
    console.log(`[Test] Using greeting test session: ${GREETING_TEST_SESSION_ID}`);

    await sessionPlayer.goto(GREETING_TEST_SESSION_ID);
    await authenticatedPage.waitForTimeout(1000);

    // Check initial status
    const initialStatus = await sessionPlayer.statusBadge.textContent();
    console.log(`[Test] Initial status: ${initialStatus}`);

    // Start session
    await sessionPlayer.startSession();
    await sessionPlayer.waitForSessionStarted(15000);
    console.log('[Test] ✓ Session started');

    // Wait for READY/ACTIVE status
    const activeStatus = await sessionPlayer.waitForAnyStatus(['READY', 'ACTIVE'], 15000);
    console.log(`[Test] ✓ Active status: ${activeStatus}`);

    // Initial greeting should already be displayed
    await authenticatedPage.waitForTimeout(2000);
    const greeting = await sessionPlayer.getLatestTranscriptMessage();
    console.log(`[Test] ✓ Greeting received: ${greeting?.text?.substring(0, 50)}...`);

    // Verify greeting content
    expect(greeting?.speaker).toBe('AI');
    expect(greeting?.text).toContain('Hello');
    expect(greeting?.text).toContain('Welcome');

    // Simulate user waiting (AI should be ready for response)
    await authenticatedPage.waitForTimeout(2000);

    // Stop session
    console.log('[Test] Stopping session...');
    await sessionPlayer.stopSession();

    // Wait for completion
    await sessionPlayer.waitForStatus('COMPLETED', 15000);
    console.log('[Test] ✓ Status: COMPLETED');

    // Verify control buttons are hidden after completion
    await expect(sessionPlayer.startButton).not.toBeVisible();
    await expect(sessionPlayer.pauseButton).not.toBeVisible();
    await expect(sessionPlayer.stopButton).not.toBeVisible();
    console.log('[Test] ✓ Control buttons hidden after completion');

    console.log('[Test] ✅ Complete lifecycle test passed');
  });
});
