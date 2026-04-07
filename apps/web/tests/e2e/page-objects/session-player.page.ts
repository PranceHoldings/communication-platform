/**
 * Session Player Page Object Model
 *
 * Encapsulates selectors and actions for the Session Player component.
 */

import { Page, Locator, expect } from '@playwright/test';

export type SessionStatus = 'IDLE' | 'CONNECTING' | 'READY' | 'ACTIVE' | 'COMPLETED';
export type ProcessingStage = 'idle' | 'stt' | 'ai' | 'tts';

export class SessionPlayerPage {
  readonly page: Page;

  // Main container
  readonly container: Locator;

  // Status badge
  readonly statusBadge: Locator;

  // Action buttons
  readonly startButton: Locator;
  readonly stopButton: Locator;
  readonly pauseButton: Locator;

  // Audio indicators
  readonly microphoneIndicator: Locator;
  readonly speakerIndicator: Locator;
  readonly cameraIndicator: Locator;

  // Silence timer
  readonly silenceTimer: Locator;

  // Processing stage
  readonly processingStage: Locator;

  // Transcript
  readonly transcript: Locator;
  readonly transcriptMessages: Locator;

  // Duration
  readonly duration: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main container (adjust selector based on actual implementation)
    this.container = page.locator('[data-testid="session-player"]').first();

    // Status badge
    this.statusBadge = page.locator('[data-testid="status-badge"]').first();

    // Action buttons
    this.startButton = page.getByRole('button', { name: /start session/i });
    this.stopButton = page.getByRole('button', { name: /stop/i });
    this.pauseButton = page.getByRole('button', { name: /pause/i });

    // Audio indicators
    this.microphoneIndicator = page.locator('[data-testid="microphone-indicator"]').first();
    this.speakerIndicator = page.locator('[data-testid="speaker-indicator"]').first();
    this.cameraIndicator = page.locator('[data-testid="camera-indicator"]').first();

    // Silence timer
    this.silenceTimer = page.locator('[data-testid="silence-timer"]').first();

    // Processing stage
    this.processingStage = page.locator('[data-testid="processing-stage"]').first();

    // Transcript
    this.transcript = page.locator('[data-testid="transcript"]').first();
    // Match both AI messages (data-testid="ai-message") and USER messages (data-testid="transcript-message")
    this.transcriptMessages = page.locator('[data-testid="transcript-message"], [data-testid="ai-message"]');

    // Duration
    this.duration = page.locator('[data-testid="session-duration"]').first();
  }

  /**
   * Navigate to a session player page
   */
  async goto(sessionId: string): Promise<void> {
    await this.page.goto(`/dashboard/sessions/${sessionId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Start a session
   */
  async startSession(): Promise<void> {
    await this.startButton.click();
    // Handle scenario validation warning dialog if it appears
    const confirmDialog = this.page.locator('[data-testid="confirm-dialog"]');
    const isDialogVisible = await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false);
    if (isDialogVisible) {
      await this.page.locator('[data-testid="confirm-dialog-confirm"]').click();
    }
  }

  /**
   * Stop a session
   */
  async stopSession(): Promise<void> {
    // Wait for button to be ready
    await this.stopButton.waitFor({ state: 'visible', timeout: 5000 });

    // Force click to bypass any overlays
    await this.stopButton.click({ force: true, timeout: 10000 });
  }

  /**
   * Check if session has started (start button removed, pause/stop buttons visible)
   */
  async isSessionStarted(): Promise<boolean> {
    const startButtonCount = await this.startButton.count();
    const pauseButtonCount = await this.pauseButton.count();
    const stopButtonCount = await this.stopButton.count();

    return startButtonCount === 0 && pauseButtonCount > 0 && stopButtonCount > 0;
  }

  /**
   * Wait for session to start (start button removed, control buttons visible)
   * Robust strategy with retry logic for UI timing issues
   */
  async waitForSessionStarted(timeout = 15000): Promise<void> {
    console.log('[PageObject] Waiting for session to start...');
    const overallStartTime = Date.now();

    // 1. Wait for start button to disappear
    console.log('[PageObject] Step 1: Waiting for Start button to disappear...');
    await expect(this.startButton).not.toBeVisible({ timeout: Math.min(timeout * 0.4, 6000) });
    console.log('[PageObject] ✓ Start button is no longer visible');

    // 2. Wait for WebSocket connection (if available)
    console.log('[PageObject] Step 2: Checking WebSocket connection...');
    try {
      // Try to find WebSocket status indicator
      const wsStatus = this.page.locator('[data-testid="websocket-status"]');
      const wsCount = await wsStatus.count();

      if (wsCount > 0) {
        // WebSocket status element exists, wait for "Connected"
        await wsStatus.filter({ hasText: /connected/i }).waitFor({
          state: 'visible',
          timeout: Math.min(timeout * 0.3, 5000)
        });
        console.log('[PageObject] ✓ WebSocket is connected');
      } else {
        console.log('[PageObject] WebSocket status indicator not found (may not be implemented)');
      }
    } catch (error) {
      console.log('[PageObject] WebSocket status check skipped (non-blocking)');
    }

    // 3. Wait for control buttons to appear with retry logic
    console.log('[PageObject] Step 3: Waiting for Pause/Stop buttons...');
    const buttonWaitStartTime = Date.now();
    const buttonWaitTimeout = Math.min(timeout * 0.6, 8000);
    let attempts = 0;
    const maxAttempts = 15;

    while (Date.now() - buttonWaitStartTime < buttonWaitTimeout && attempts < maxAttempts) {
      attempts++;

      try {
        const pauseCount = await Promise.race([
          this.pauseButton.count(),
          new Promise<number>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]).catch(() => 0);

        const stopCount = await Promise.race([
          this.stopButton.count(),
          new Promise<number>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]).catch(() => 0);

        console.log(`[PageObject] Attempt ${attempts}: Pause=${pauseCount}, Stop=${stopCount}`);

        if (pauseCount > 0 && stopCount > 0) {
          // Both buttons exist, verify they are visible
          const pauseVisible = await this.pauseButton.isVisible().catch(() => false);
          const stopVisible = await this.stopButton.isVisible().catch(() => false);

          if (pauseVisible && stopVisible) {
            console.log('[PageObject] ✓ Both Pause and Stop buttons are visible');
            return;
          }
        }

        await this.page.waitForTimeout(200);
      } catch (error) {
        console.log(`[PageObject] Attempt ${attempts} error:`, error);
        await this.page.waitForTimeout(200);
      }
    }

    // 4. Final assertion with reduced timeout
    console.log('[PageObject] Step 4: Final visibility assertion...');
    const elapsed = Date.now() - overallStartTime;
    const remainingTimeout = Math.max(timeout - elapsed, 2000);

    await expect(this.pauseButton).toBeVisible({ timeout: remainingTimeout });
    await expect(this.stopButton).toBeVisible({ timeout: remainingTimeout });
    console.log('[PageObject] ✓ Session started successfully');
  }

  /**
   * Wait for status to change
   */
  async waitForStatus(status: SessionStatus, timeout = 10000): Promise<void> {
    // Map status to display text (adjust based on i18n)
    const statusText: Record<SessionStatus, RegExp> = {
      IDLE: /not started/i,
      CONNECTING: /connecting/i,
      READY: /ready/i,
      ACTIVE: /in progress|active/i,
      COMPLETED: /completed/i,
    };

    await expect(this.statusBadge).toContainText(statusText[status], { timeout });
  }

  /**
   * Wait for any of multiple statuses
   */
  async waitForAnyStatus(statuses: SessionStatus[], timeout = 10000): Promise<string> {
    const statusText: Record<SessionStatus, RegExp> = {
      IDLE: /not started/i,
      CONNECTING: /connecting/i,
      READY: /ready/i,
      ACTIVE: /in progress|active/i,
      COMPLETED: /completed/i,
    };

    // Combine all patterns
    const patterns = statuses.map(s => statusText[s].source).join('|');
    const combinedPattern = new RegExp(patterns, 'i');

    await expect(this.statusBadge).toContainText(combinedPattern, { timeout });

    // Return the actual status text
    const actualText = await this.statusBadge.textContent();
    return actualText || '';
  }

  /**
   * Wait for processing stage
   */
  async waitForProcessingStage(stage: ProcessingStage, timeout = 10000): Promise<void> {
    if (stage === 'idle') {
      // Processing stage should not be visible when idle
      // Check if element exists first (it may return null in mock environment)
      const count = await this.processingStage.count();
      if (count === 0) {
        // Element doesn't exist (conditional rendering) - OK for idle state
        console.log('[PageObject] Processing stage element not in DOM (idle state) - OK');
        return;
      }
      await expect(this.processingStage).toBeHidden({ timeout });
    } else {
      const stageText: Record<Exclude<ProcessingStage, 'idle'>, RegExp> = {
        stt: /transcribing|speech/i,
        ai: /generating|ai response/i,
        tts: /synthesizing|speech/i,
      };

      // Check if element exists
      const count = await this.processingStage.count();
      if (count === 0) {
        throw new Error(`Processing stage element not found (expected: ${stage}). Make sure to send processing_update messages in tests.`);
      }

      await expect(this.processingStage).toContainText(stageText[stage], { timeout });
    }
  }

  /**
   * Check if microphone is recording
   */
  async isMicrophoneRecording(): Promise<boolean> {
    const text = await this.microphoneIndicator.textContent();
    return text?.toLowerCase().includes('recording') || false;
  }

  /**
   * Check if speaker is playing
   */
  async isSpeakerPlaying(): Promise<boolean> {
    const text = await this.speakerIndicator.textContent();
    return text?.toLowerCase().includes('playing') || false;
  }

  /**
   * Check if camera is active
   */
  async isCameraActive(): Promise<boolean> {
    const text = await this.cameraIndicator.textContent();
    return text?.toLowerCase().includes('on') || text?.toLowerCase().includes('active') || false;
  }

  /**
   * Get silence timer elapsed time (in seconds)
   */
  async getSilenceElapsedTime(): Promise<number> {
    try {
      const text = await this.silenceTimer.textContent({ timeout: 1000 });
      if (!text) return 0;

      // Extract number from "Silence: 5s / 10s" format
      const match = text.match(/(\d+)s/);
      if (!match || !match[1]) return 0;
      return parseInt(match[1], 10);
    } catch (error) {
      // Element doesn't exist or can't be read
      return 0;
    }
  }

  /**
   * Wait for silence timer to reach a specific value
   */
  async waitForSilenceTimer(seconds: number, timeout = 15000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const elapsed = await this.getSilenceElapsedTime();
      if (elapsed >= seconds) {
        return;
      }
      await this.page.waitForTimeout(500); // Check every 500ms
    }

    throw new Error(`Silence timer did not reach ${seconds}s within ${timeout}ms`);
  }

  /**
   * Get transcript messages count
   */
  async getTranscriptMessageCount(): Promise<number> {
    return await this.transcriptMessages.count();
  }

  /**
   * Get latest transcript message
   */
  async getLatestTranscriptMessage(): Promise<{ speaker: string; text: string } | null> {
    const count = await this.getTranscriptMessageCount();
    if (count === 0) return null;

    const lastMessage = this.transcriptMessages.nth(count - 1);
    const text = await lastMessage.textContent();
    if (!text) return null;

    // Get speaker from data-speaker attribute
    const speaker = await lastMessage.getAttribute('data-speaker');
    if (!speaker) return { speaker: 'UNKNOWN', text };

    return {
      speaker,
      text,
    };
  }

  /**
   * Wait for transcript message containing specific text
   */
  async waitForTranscriptContaining(text: string, timeout = 30000): Promise<void> {
    console.log(`[PageObject] Waiting for transcript containing: "${text.substring(0, 50)}"`);
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const count = await this.getTranscriptMessageCount();

      for (let i = 0; i < count; i++) {
        const msg = this.transcriptMessages.nth(i);
        const content = await msg.textContent();
        if (content?.includes(text)) {
          console.log(`[PageObject] Found transcript message containing text at index ${i}`);
          return;
        }
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error(`No transcript message containing "${text.substring(0, 50)}" within ${timeout}ms`);
  }

  /**
   * Wait for new transcript message
   */
  async waitForNewTranscriptMessage(timeout = 30000): Promise<void> {
    const initialCount = await this.getTranscriptMessageCount();
    console.log(`[PageObject] waitForNewTranscriptMessage: initial count = ${initialCount}`);

    // Debug: Log all current transcript messages
    for (let i = 0; i < initialCount; i++) {
      const msg = this.transcriptMessages.nth(i);
      const text = await msg.textContent();
      console.log(`[PageObject] Initial transcript[${i}]: ${text?.substring(0, 100)}`);
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentCount = await this.getTranscriptMessageCount();

      if (currentCount > initialCount) {
        console.log(`[PageObject] Transcript message count increased: ${initialCount} → ${currentCount}`);
        // Debug: Log new message
        const newMsg = this.transcriptMessages.nth(currentCount - 1);
        const newText = await newMsg.textContent();
        console.log(`[PageObject] New transcript message: ${newText?.substring(0, 100)}`);
        return;
      }

      // Only log every 2 seconds to reduce noise
      if ((Date.now() - startTime) % 2000 < 500) {
        console.log(`[PageObject] Current transcript count: ${currentCount} (waiting for > ${initialCount})`);
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error(`No new transcript message within ${timeout}ms (initial: ${initialCount})`);
  }

  /**
   * Simulate user speech (for Stage 3 tests with fake audio device)
   */
  async simulateUserSpeech(durationMs = 3000): Promise<void> {
    // This method relies on Playwright's fake media stream
    // The fake device automatically generates audio data
    await this.page.waitForTimeout(durationMs);
  }

  /**
   * Check if silence timer is visible
   */
  async isSilenceTimerVisible(): Promise<boolean> {
    try {
      // First check if element exists
      const count = await this.silenceTimer.count();
      if (count === 0) return false;

      // Then check visibility
      return await this.silenceTimer.isVisible({ timeout: 1000 });
    } catch (error) {
      // Element doesn't exist or isn't visible
      return false;
    }
  }

  /**
   * Get session duration
   */
  async getSessionDuration(): Promise<string> {
    return (await this.duration.textContent()) || '0:00';
  }

  /**
   * Wait for toast notification
   */
  async waitForToast(expectedText?: string, timeout = 5000): Promise<boolean> {
    console.log(`[PageObject] Waiting for toast${expectedText ? `: "${expectedText}"` : ''}`);

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Try multiple toast selectors
      const selectors = [
        '[data-sonner-toaster]',
        '[data-sonner-toast]',
        '.toast',
        '[role="alert"]',
        '[role="status"]',
      ];

      for (const selector of selectors) {
        const element = this.page.locator(selector);
        const count = await element.count();

        if (count > 0) {
          const isVisible = await element.first().isVisible().catch(() => false);
          if (isVisible) {
            if (expectedText) {
              const text = await element.first().textContent().catch(() => '') || '';
              if (text.toLowerCase().includes(expectedText.toLowerCase())) {
                console.log(`[PageObject] Found toast with expected text`);
                return true;
              }
            } else {
              console.log(`[PageObject] Found toast notification`);
              return true;
            }
          }
        }
      }

      // Try text-based search
      if (expectedText) {
        const textLocator = this.page.getByText(expectedText, { exact: false });
        const count = await textLocator.count();
        if (count > 0) {
          const isVisible = await textLocator.first().isVisible().catch(() => false);
          if (isVisible) {
            console.log(`[PageObject] Found toast by text search`);
            return true;
          }
        }
      }

      await this.page.waitForTimeout(200);
    }

    console.log(`[PageObject] Toast not found within ${timeout}ms`);
    return false;
  }
}
