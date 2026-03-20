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
    this.transcriptMessages = page.locator('[data-testid="transcript-message"]');

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
  }

  /**
   * Stop a session
   */
  async stopSession(): Promise<void> {
    await this.stopButton.click();
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
    const text = await this.silenceTimer.textContent();
    if (!text) return 0;

    // Extract number from "Silence: 5s / 10s" format
    const match = text.match(/(\d+)s/);
    if (!match || !match[1]) return 0;
    return parseInt(match[1], 10);
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
    return await this.silenceTimer.isVisible();
  }

  /**
   * Get session duration
   */
  async getSessionDuration(): Promise<string> {
    return (await this.duration.textContent()) || '0:00';
  }
}
