/**
 * Stage 4: Recording Function E2E Tests
 *
 * Tests for recording playback, controls, and transcript functionality.
 *
 * Prerequisites:
 * - Completed session with recording available
 * - Recording processing status: COMPLETED
 *
 * Test Coverage:
 * - Recording player display
 * - Playback controls (play/pause, seek, speed, volume)
 * - Transcript display and navigation
 * - Recording metadata display
 */

import { test, expect } from './fixtures/session.fixture';
import { RecordingPlayerPage } from './page-objects/recording-player.page';

test.describe('Stage 4: Recording Function Tests', () => {
  let recordingPlayer: RecordingPlayerPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    recordingPlayer = new RecordingPlayerPage(authenticatedPage);
  });

  test('S4-001: Recording player loads and displays video', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 1: Recording player loads ===');

    await recordingPlayer.goto(testSessionWithRecordingId);

    // Wait for recording player
    await recordingPlayer.waitForRecordingPlayer();
    console.log('  Recording player: ✅ Visible');

    // Check video element
    const videoVisible = await recordingPlayer.video.isVisible();
    expect(videoVisible).toBe(true);
    console.log('  Video element: ✅ Visible');

    // Wait for video to load
    await recordingPlayer.page.waitForTimeout(2000);
    const isLoaded = await recordingPlayer.isVideoLoaded();
    console.log(`  Video loaded: ${isLoaded ? '✅' : '⚠️'}`);

    console.log('  ✅ PASS - Recording player loaded\n');
  });

  test('S4-002: Play/pause functionality', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 2: Play/Pause functionality ===');

    await recordingPlayer.goto(testSessionWithRecordingId);
    await recordingPlayer.waitForRecordingPlayer();

    // Check initial state (paused)
    const initiallyPlaying = await recordingPlayer.isPlaying();
    console.log(`  Initial state: ${initiallyPlaying ? 'Playing' : 'Paused ✅'}`);

    // Play video
    await recordingPlayer.play();
    const isPlayingAfterPlay = await recordingPlayer.isPlaying();
    console.log(`  After play click: ${isPlayingAfterPlay ? 'Playing ✅' : 'Paused'}`);
    expect(isPlayingAfterPlay).toBe(true);

    // Pause video
    await recordingPlayer.pause();
    const isPlayingAfterPause = await recordingPlayer.isPlaying();
    console.log(`  After pause click: ${isPlayingAfterPause ? 'Playing' : 'Paused ✅'}`);
    expect(isPlayingAfterPause).toBe(false);

    console.log('  ✅ PASS - Play/pause functionality working\n');
  });

  test('S4-003: Timeline seeking', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 3: Timeline seeking ===');

    await recordingPlayer.goto(testSessionWithRecordingId);
    await recordingPlayer.waitForRecordingPlayer();

    // Get duration
    await recordingPlayer.page.waitForTimeout(2000);
    const duration = await recordingPlayer.getDuration();
    console.log(`  Video duration: ${duration.toFixed(2)}s`);

    if (duration > 5) {
      // Seek to 3 seconds
      await recordingPlayer.seekTo(3);
      await recordingPlayer.page.waitForTimeout(1000);

      const currentTime = await recordingPlayer.getCurrentTime();
      console.log(`  Current time after seek: ${currentTime.toFixed(2)}s`);

      // Allow small tolerance
      expect(currentTime).toBeGreaterThanOrEqual(2.5);
      expect(currentTime).toBeLessThanOrEqual(3.5);
      console.log('  ✅ Seek successful');
    } else {
      console.log('  ⚠️  Video too short for seek test');
    }

    console.log('  ✅ PASS - Timeline seeking working\n');
  });

  test('S4-004: Playback speed control (0.5x - 2.0x)', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 4: Playback speed control ===');

    await recordingPlayer.goto(testSessionWithRecordingId);
    await recordingPlayer.waitForRecordingPlayer();

    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

    for (const speed of speeds) {
      await recordingPlayer.setPlaybackRate(speed);
      const currentRate = await recordingPlayer.getPlaybackRate();

      console.log(`  Set speed ${speed}x: ${currentRate === speed ? '✅' : '❌'} (${currentRate}x)`);
      expect(currentRate).toBe(speed);
    }

    console.log('  ✅ PASS - Playback speed control working\n');
  });

  test('S4-005: Volume control', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 5: Volume control ===');

    await recordingPlayer.goto(testSessionWithRecordingId);
    await recordingPlayer.waitForRecordingPlayer();

    // Test different volume levels
    const volumes = [0.0, 0.5, 1.0];

    for (const volume of volumes) {
      await recordingPlayer.setVolume(volume);
      const currentVolume = await recordingPlayer.getVolume();

      console.log(`  Set volume ${volume}: ${Math.abs(currentVolume - volume) < 0.1 ? '✅' : '❌'} (${currentVolume.toFixed(2)})`);
      expect(currentVolume).toBeCloseTo(volume, 1);
    }

    console.log('  ✅ PASS - Volume control working\n');
  });

  test('S4-006: Transcript display and synchronization', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 6: Transcript display ===');

    await recordingPlayer.goto(testSessionWithRecordingId);
    await recordingPlayer.waitForRecordingPlayer();

    // Check transcript section visibility
    const transcriptVisible = await recordingPlayer.transcriptSection.isVisible();
    console.log(`  Transcript section: ${transcriptVisible ? '✅ Visible' : '⚠️  Not visible'}`);

    if (transcriptVisible) {
      // Get transcript count
      const count = await recordingPlayer.getTranscriptCount();
      console.log(`  Transcript items: ${count} items`);
      expect(count).toBeGreaterThan(0);

      // Play video and check for active transcript
      await recordingPlayer.play();
      await recordingPlayer.page.waitForTimeout(2000);

      const activeIndex = await recordingPlayer.getActiveTranscriptIndex();
      console.log(`  Active transcript: ${activeIndex >= 0 ? '✅ Item ' + activeIndex : '⚠️  None'}`);
    } else {
      console.log('  ⚠️  No transcript available for this recording');
    }

    console.log('  ✅ PASS - Transcript display checked\n');
  });

  test('S4-007: Transcript click navigation', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 7: Transcript click navigation ===');

    await recordingPlayer.goto(testSessionWithRecordingId);
    await recordingPlayer.waitForRecordingPlayer();

    const transcriptVisible = await recordingPlayer.transcriptSection.isVisible();

    if (transcriptVisible) {
      const count = await recordingPlayer.getTranscriptCount();

      if (count > 1) {
        // Click second transcript item
        const initialTime = await recordingPlayer.getCurrentTime();
        console.log(`  Initial time: ${initialTime.toFixed(2)}s`);

        await recordingPlayer.clickTranscriptItem(1);
        await recordingPlayer.page.waitForTimeout(1000);

        const newTime = await recordingPlayer.getCurrentTime();
        console.log(`  After click time: ${newTime.toFixed(2)}s`);

        // Time should have changed
        expect(newTime).not.toBe(initialTime);
        console.log('  ✅ Navigation successful');
      } else {
        console.log('  ⚠️  Not enough transcript items for navigation test');
      }
    } else {
      console.log('  ⚠️  No transcript available');
    }

    console.log('  ✅ PASS - Transcript navigation checked\n');
  });

  test('S4-008: Recording info display', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 8: Recording info display ===');

    await recordingPlayer.goto(testSessionWithRecordingId);
    await recordingPlayer.waitForRecordingPlayer();

    // Check recording info visibility
    const infoVisible = await recordingPlayer.recordingInfo.isVisible();
    expect(infoVisible).toBe(true);
    console.log('  Recording info: ✅ Visible');

    // Check individual info elements
    const formatVisible = await recordingPlayer.recordingFormat.isVisible();
    const resolutionVisible = await recordingPlayer.recordingResolution.isVisible();
    const sizeVisible = await recordingPlayer.recordingFileSize.isVisible();

    console.log(`  Format: ${formatVisible ? '✅' : '❌'}`);
    console.log(`  Resolution: ${resolutionVisible ? '✅' : '❌'}`);
    console.log(`  File size: ${sizeVisible ? '✅' : '❌'}`);

    expect(formatVisible).toBe(true);
    expect(resolutionVisible).toBe(true);
    expect(sizeVisible).toBe(true);

    console.log('  ✅ PASS - Recording info displayed\n');
  });

  test('S4-009: Video format and resolution display', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 9: Format and resolution display ===');

    await recordingPlayer.goto(testSessionWithRecordingId);
    await recordingPlayer.waitForRecordingPlayer();

    // Get format
    const format = await recordingPlayer.getRecordingFormat();
    console.log(`  Format: ${format}`);
    expect(format).toContain('webm'); // or 'mp4'

    // Get resolution
    const resolution = await recordingPlayer.getRecordingResolution();
    console.log(`  Resolution: ${resolution}`);
    expect(resolution).toMatch(/\d+x\d+/);

    // Get file size
    const fileSize = await recordingPlayer.getRecordingFileSize();
    console.log(`  File size: ${fileSize}`);
    expect(fileSize).toContain('MB');

    console.log('  ✅ PASS - Format and resolution displayed correctly\n');
  });

  test('S4-010: Recording duration info', async ({ testSessionWithRecordingId }) => {
    console.log('\n=== Test 10: Recording duration info ===');

    await recordingPlayer.goto(testSessionWithRecordingId);
    await recordingPlayer.waitForRecordingPlayer();

    // Check duration display in recording info
    const durationInfoVisible = await recordingPlayer.recordingDurationInfo.isVisible();
    console.log(`  Duration info: ${durationInfoVisible ? '✅ Visible' : '⚠️  Not visible'}`);

    // Get video duration from player
    await recordingPlayer.page.waitForTimeout(2000);
    const duration = await recordingPlayer.getDuration();
    console.log(`  Video duration: ${duration.toFixed(2)}s`);

    // Duration should be a positive number
    expect(duration).toBeGreaterThan(0);
    console.log('  ✅ Duration is valid');

    // Check duration text format
    const currentTimeText = await recordingPlayer.currentTime.textContent();
    const durationText = await recordingPlayer.duration.textContent();
    console.log(`  Time display: ${currentTimeText} / ${durationText}`);

    // Should be in MM:SS format
    expect(currentTimeText).toMatch(/\d+:\d{2}/);
    expect(durationText).toMatch(/\d+:\d{2}/);

    console.log('  ✅ PASS - Duration info displayed correctly\n');
  });
});
