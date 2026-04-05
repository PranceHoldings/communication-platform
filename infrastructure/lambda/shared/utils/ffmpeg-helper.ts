/**
 * FFmpeg Helper - Centralized ffmpeg/ffprobe path resolution
 * CRITICAL: Single source of truth for ffmpeg binary location
 *
 * Path Resolution Priority:
 * 1. FFMPEG_PATH environment variable (set by Lambda function config)
 * 2. /var/task/ffmpeg (CDK copies binary here)
 * 3. /opt/bin/ffmpeg (Lambda Layer path)
 * 4. require('ffmpeg-static') (npm package fallback)
 */

import * as fs from 'fs';

/**
 * Get ffmpeg binary path with multiple fallback options
 * @returns {string} Absolute path to ffmpeg binary
 * @throws {Error} If ffmpeg binary cannot be found
 */
export function getFFmpegPath(): string {
  // Priority 1: Environment variable — verify the file actually exists before trusting it
  if (process.env.FFMPEG_PATH) {
    if (fs.existsSync(process.env.FFMPEG_PATH)) {
      console.log('[FFmpegHelper] Using FFMPEG_PATH from environment:', process.env.FFMPEG_PATH);
      return process.env.FFMPEG_PATH;
    }
    console.warn('[FFmpegHelper] FFMPEG_PATH set but file not found:', process.env.FFMPEG_PATH, '— falling through to next option');
  }

  // Priority 2: /var/task/ffmpeg (CDK afterBundling copies binary here)
  if (fs.existsSync('/var/task/ffmpeg')) {
    console.log('[FFmpegHelper] Found ffmpeg at /var/task/ffmpeg (CDK deployment)');
    return '/var/task/ffmpeg';
  }

  // Priority 3: Lambda Layer path
  if (fs.existsSync('/opt/bin/ffmpeg')) {
    console.log('[FFmpegHelper] Found ffmpeg at /opt/bin/ffmpeg (Lambda Layer)');
    return '/opt/bin/ffmpeg';
  }

  // Priority 4: npm package (ffmpeg-static) — last resort, path resolves to node_modules/ffmpeg-static/ffmpeg
  try {
    const ffmpegPath = require('ffmpeg-static') as string | null;
    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      console.log('[FFmpegHelper] Using ffmpeg-static package:', ffmpegPath);
      return ffmpegPath;
    }
    console.warn('[FFmpegHelper] ffmpeg-static resolved path does not exist:', ffmpegPath);
  } catch (error) {
    console.error('[FFmpegHelper] ffmpeg-static package not found:', error);
  }

  // All attempts failed
  throw new Error(
    'ffmpeg binary not found. Checked:\n' +
      `  1. FFMPEG_PATH env var: ${process.env.FFMPEG_PATH || '(not set)'}\n` +
      '  2. /var/task/ffmpeg (CDK deployment)\n' +
      '  3. /opt/bin/ffmpeg (Lambda Layer)\n' +
      '  4. ffmpeg-static npm package\n' +
      'Please ensure ffmpeg is deployed correctly.'
  );
}

/**
 * Get ffprobe binary path with multiple fallback options
 * @returns {string} Absolute path to ffprobe binary
 * @throws {Error} If ffprobe binary cannot be found
 */
export function getFFprobePath(): string {
  // Priority 1: Environment variable
  if (process.env.FFPROBE_PATH) {
    console.log('[FFmpegHelper] Using FFPROBE_PATH from environment:', process.env.FFPROBE_PATH);
    return process.env.FFPROBE_PATH;
  }

  // Priority 2: /var/task/ffprobe (CDK deployment target)
  if (fs.existsSync('/var/task/ffprobe')) {
    console.log('[FFmpegHelper] Found ffprobe at /var/task/ffprobe (CDK deployment)');
    return '/var/task/ffprobe';
  }

  // Priority 3: Lambda Layer path
  if (fs.existsSync('/opt/bin/ffprobe')) {
    console.log('[FFmpegHelper] Found ffprobe at /opt/bin/ffprobe (Lambda Layer)');
    return '/opt/bin/ffprobe';
  }

  // Priority 4: Derive from ffmpeg path (same directory)
  try {
    const ffmpegPath = getFFmpegPath();
    const ffprobePath = ffmpegPath.replace(/ffmpeg$/, 'ffprobe');

    if (fs.existsSync(ffprobePath)) {
      console.log('[FFmpegHelper] Derived ffprobe path from ffmpeg:', ffprobePath);
      return ffprobePath;
    }
  } catch (error) {
    console.error('[FFmpegHelper] Failed to derive ffprobe path:', error);
  }

  // All attempts failed
  throw new Error(
    'ffprobe binary not found. Checked:\n' +
      '  1. FFPROBE_PATH environment variable\n' +
      '  2. /var/task/ffprobe (CDK deployment)\n' +
      '  3. /opt/bin/ffprobe (Lambda Layer)\n' +
      '  4. Derived from ffmpeg path\n' +
      'Please ensure ffprobe is deployed correctly.'
  );
}

/**
 * Verify that ffmpeg binary is executable
 * @param {string} ffmpegPath - Path to ffmpeg binary
 * @returns {boolean} True if executable, false otherwise
 */
export function verifyFFmpegExecutable(ffmpegPath: string): boolean {
  try {
    fs.accessSync(ffmpegPath, fs.constants.X_OK);
    console.log('[FFmpegHelper] ffmpeg binary is executable:', ffmpegPath);
    return true;
  } catch (error) {
    console.error('[FFmpegHelper] ffmpeg binary is NOT executable:', ffmpegPath, error);
    return false;
  }
}
