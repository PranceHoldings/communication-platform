/**
 * Recording Player Page Object Model
 *
 * Encapsulates selectors and actions for the Recording Player component.
 */

import { Page, Locator } from '@playwright/test';

export class RecordingPlayerPage {
  readonly page: Page;

  // Main container
  readonly container: Locator;

  // Video element
  readonly video: Locator;

  // Playback controls
  readonly playPauseButton: Locator;
  readonly timeline: Locator;
  readonly currentTime: Locator;
  readonly duration: Locator;

  // Playback rate controls
  readonly playbackRateControls: Locator;
  readonly volumeSlider: Locator;

  // Transcript
  readonly transcriptSection: Locator;
  readonly transcriptItems: Locator;

  // Recording info
  readonly recordingInfo: Locator;
  readonly recordingFormat: Locator;
  readonly recordingResolution: Locator;
  readonly recordingFileSize: Locator;
  readonly recordingDurationInfo: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main container
    this.container = page.locator('[data-testid="recording-player"]');

    // Video element
    this.video = page.locator('[data-testid="recording-player-video"]');

    // Playback controls
    this.playPauseButton = page.locator('[data-testid="recording-play-pause-button"]');
    this.timeline = page.locator('[data-testid="recording-timeline"]');
    this.currentTime = page.locator('[data-testid="recording-current-time"]');
    this.duration = page.locator('[data-testid="recording-duration"]');

    // Playback rate controls
    this.playbackRateControls = page.locator('[data-testid="recording-playback-rate-controls"]');
    this.volumeSlider = page.locator('[data-testid="recording-volume-slider"]');

    // Transcript
    this.transcriptSection = page.locator('[data-testid="recording-transcript-section"]');
    this.transcriptItems = page.locator('[data-testid^="transcript-item-"]');

    // Recording info
    this.recordingInfo = page.locator('[data-testid="recording-info"]');
    this.recordingFormat = page.locator('[data-testid="recording-format"]');
    this.recordingResolution = page.locator('[data-testid="recording-resolution"]');
    this.recordingFileSize = page.locator('[data-testid="recording-file-size"]');
    this.recordingDurationInfo = page.locator('[data-testid="recording-duration-info"]');
  }

  /**
   * Navigate to session detail page with recording
   */
  async goto(sessionId: string) {
    await this.page.goto(`/dashboard/sessions/${sessionId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for recording player to be visible
   */
  async waitForRecordingPlayer() {
    await this.container.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Check if video is loaded
   */
  async isVideoLoaded(): Promise<boolean> {
    const videoElement = await this.video.elementHandle();
    if (!videoElement) return false;

    const readyState = await videoElement.evaluate((video: HTMLVideoElement) => video.readyState);
    // readyState >= 2 means HAVE_CURRENT_DATA or higher
    return readyState >= 2;
  }

  /**
   * Play video
   */
  async play() {
    await this.playPauseButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Pause video
   */
  async pause() {
    await this.playPauseButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if video is playing
   */
  async isPlaying(): Promise<boolean> {
    const videoElement = await this.video.elementHandle();
    if (!videoElement) return false;

    return await videoElement.evaluate((video: HTMLVideoElement) => !video.paused);
  }

  /**
   * Set playback rate
   */
  async setPlaybackRate(rate: number) {
    const rateButton = this.page.locator(`[data-testid="recording-playback-rate-${rate}"]`);
    await rateButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Get current playback rate
   */
  async getPlaybackRate(): Promise<number> {
    const videoElement = await this.video.elementHandle();
    if (!videoElement) return 1.0;

    return await videoElement.evaluate((video: HTMLVideoElement) => video.playbackRate);
  }

  /**
   * Set volume
   */
  async setVolume(volume: number) {
    await this.volumeSlider.fill(volume.toString());
    await this.page.waitForTimeout(300);
  }

  /**
   * Get volume
   */
  async getVolume(): Promise<number> {
    const videoElement = await this.video.elementHandle();
    if (!videoElement) return 1.0;

    return await videoElement.evaluate((video: HTMLVideoElement) => video.volume);
  }

  /**
   * Seek to specific time (seconds)
   */
  async seekTo(seconds: number) {
    const videoElement = await this.video.elementHandle();
    if (!videoElement) throw new Error('Video element not found');

    await videoElement.evaluate((video: HTMLVideoElement, time: number) => {
      video.currentTime = time;
    }, seconds);

    await this.page.waitForTimeout(500);
  }

  /**
   * Get current time
   */
  async getCurrentTime(): Promise<number> {
    const videoElement = await this.video.elementHandle();
    if (!videoElement) return 0;

    return await videoElement.evaluate((video: HTMLVideoElement) => video.currentTime);
  }

  /**
   * Get duration
   */
  async getDuration(): Promise<number> {
    const videoElement = await this.video.elementHandle();
    if (!videoElement) return 0;

    return await videoElement.evaluate((video: HTMLVideoElement) => video.duration);
  }

  /**
   * Get transcript count
   */
  async getTranscriptCount(): Promise<number> {
    return await this.transcriptItems.count();
  }

  /**
   * Click transcript item by index
   */
  async clickTranscriptItem(index: number) {
    await this.transcriptItems.nth(index).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get active transcript item index
   */
  async getActiveTranscriptIndex(): Promise<number> {
    const items = await this.transcriptItems.all();

    for (let i = 0; i < items.length; i++) {
      const isActive = await items[i]!.getAttribute('data-active');
      if (isActive === 'true') return i;
    }

    return -1;
  }

  /**
   * Get recording info text
   */
  async getRecordingFormat(): Promise<string> {
    return await this.recordingFormat.textContent() || '';
  }

  async getRecordingResolution(): Promise<string> {
    return await this.recordingResolution.textContent() || '';
  }

  async getRecordingFileSize(): Promise<string> {
    return await this.recordingFileSize.textContent() || '';
  }
}
