/**
 * S3 Path Configuration
 *
 * Centralized S3 key generation for session-related files.
 * Eliminates hardcoded path strings and provides type-safe path generation.
 *
 * Path Structure:
 * sessions/{sessionId}/
 *   ├── realtime-chunks/    - Real-time audio chunks (Phase 1.5)
 *   ├── video-chunks/       - Video chunks (Phase 2)
 *   ├── audio/              - Final audio files (AI responses, transcripts)
 *   ├── initial-greeting/   - Initial greeting audio
 *   ├── silence-prompts/    - Silence prompt audio
 *   ├── frames/             - Video frame analysis
 *   ├── chunks/temp/        - Temporary chunk parts
 *   └── recording.{ext}     - Final video recording
 *
 * @module s3-paths
 */

import { MEDIA_DEFAULTS } from './defaults';

/**
 * Session-related S3 path prefixes
 */
export const S3_PATH_PREFIXES = {
  /** Root prefix for all session data */
  SESSIONS: 'sessions',

  /** Real-time audio chunks (Phase 1.5) */
  REALTIME_CHUNKS: 'realtime-chunks',

  /** Audio input chunks from WebSocket stream (timestamp-based naming) */
  AUDIO_CHUNKS: 'audio-chunks',

  /** Video chunks (Phase 2) */
  VIDEO_CHUNKS: 'video-chunks',

  /** Final audio files */
  AUDIO: 'audio',

  /** Initial greeting audio */
  INITIAL_GREETING: 'initial-greeting',

  /** Silence prompt audio */
  SILENCE_PROMPTS: 'silence-prompts',

  /** Video frame analysis */
  FRAMES: 'frames',

  /** Temporary chunk parts */
  CHUNKS_TEMP: 'chunks/temp',
} as const;

/**
 * Non-session S3 path prefixes (top-level buckets for different content types)
 */
export const S3_REPORT_PREFIX = 'reports/sessions' as const;

/**
 * Audio file types for S3 key generation
 */
export enum AudioFileType {
  AI_RESPONSE = 'ai-response',
  TRANSCRIPT = 'transcript',
  INITIAL_GREETING = 'initial-greeting',
  SILENCE_PROMPT = 'silence-prompt',
}

/**
 * Generate S3 key for session root directory
 *
 * @param sessionId - Session ID
 * @returns S3 key prefix (e.g., 'sessions/abc123/')
 */
export function getSessionRootPrefix(sessionId: string): string {
  return `${S3_PATH_PREFIXES.SESSIONS}/${sessionId}/`;
}

/**
 * Generate S3 key prefix for real-time audio chunks
 *
 * @param sessionId - Session ID
 * @returns S3 key prefix (e.g., 'sessions/abc123/realtime-chunks/')
 */
export function getRealtimeChunksPrefix(sessionId: string): string {
  return `${getSessionRootPrefix(sessionId)}${S3_PATH_PREFIXES.REALTIME_CHUNKS}/`;
}

/**
 * Generate S3 key for a specific real-time audio chunk
 *
 * @param sessionId - Session ID
 * @param sequenceNumber - Chunk sequence number
 * @returns S3 key (e.g., 'sessions/abc123/realtime-chunks/chunk-000005.webm')
 */
export function getRealtimeChunkKey(sessionId: string, sequenceNumber: number): string {
  const paddedSeq = sequenceNumber.toString().padStart(6, '0');
  return `${getRealtimeChunksPrefix(sessionId)}chunk-${paddedSeq}.webm`;
}

/**
 * Generate S3 key prefix for video chunks
 *
 * @param sessionId - Session ID
 * @returns S3 key prefix (e.g., 'sessions/abc123/video-chunks/')
 */
export function getVideoChunksPrefix(sessionId: string): string {
  return `${getSessionRootPrefix(sessionId)}${S3_PATH_PREFIXES.VIDEO_CHUNKS}/`;
}

/**
 * Generate S3 key for final video recording
 *
 * @param sessionId - Session ID
 * @param format - Video format (default: from MEDIA_DEFAULTS.VIDEO_FORMAT)
 * @returns S3 key (e.g., 'sessions/abc123/recording.webm')
 */
export function getRecordingKey(sessionId: string, format?: string): string {
  const videoFormat = format || MEDIA_DEFAULTS.VIDEO_FORMAT;
  return `${getSessionRootPrefix(sessionId)}recording.${videoFormat}`;
}

/**
 * Generate S3 key for audio file
 *
 * @param sessionId - Session ID
 * @param type - Audio file type
 * @param timestamp - Timestamp for uniqueness (default: Date.now())
 * @param extension - File extension (default: 'mp3')
 * @returns S3 key (e.g., 'sessions/abc123/audio/ai-response-1234567890.mp3')
 */
export function getAudioKey(
  sessionId: string,
  type: AudioFileType | string,
  timestamp?: number,
  extension = 'mp3'
): string {
  const ts = timestamp || Date.now();
  return `${getSessionRootPrefix(sessionId)}${S3_PATH_PREFIXES.AUDIO}/${type}-${ts}.${extension}`;
}

/**
 * Generate S3 key for initial greeting audio
 *
 * @param sessionId - Session ID
 * @param timestamp - Timestamp for uniqueness (default: Date.now())
 * @returns S3 key (e.g., 'sessions/abc123/initial-greeting/audio-1234567890.mp3')
 */
export function getInitialGreetingKey(sessionId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  return `${getSessionRootPrefix(sessionId)}${S3_PATH_PREFIXES.INITIAL_GREETING}/audio-${ts}.mp3`;
}

/**
 * Generate S3 key for silence prompt audio
 *
 * @param sessionId - Session ID
 * @param timestamp - Timestamp for uniqueness (default: Date.now())
 * @returns S3 key (e.g., 'sessions/abc123/silence-prompts/audio-1234567890.mp3')
 */
export function getSilencePromptKey(sessionId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  return `${getSessionRootPrefix(sessionId)}${S3_PATH_PREFIXES.SILENCE_PROMPTS}/audio-${ts}.mp3`;
}

/**
 * Generate S3 key for video frame
 *
 * @param sessionId - Session ID
 * @param frameIndex - Frame index
 * @returns S3 key (e.g., 'sessions/abc123/frames/frame-00042.jpg')
 */
export function getFrameKey(sessionId: string, frameIndex: number): string {
  const paddedIndex = frameIndex.toString().padStart(5, '0');
  return `${getSessionRootPrefix(sessionId)}${S3_PATH_PREFIXES.FRAMES}/frame-${paddedIndex}.jpg`;
}

/**
 * Generate S3 key for temporary chunk part
 *
 * @param sessionId - Session ID
 * @param chunkId - Chunk ID
 * @param partIndex - Part index
 * @returns S3 key (e.g., 'sessions/abc123/chunks/temp/chunk-id/part-0.bin')
 */
export function getTempChunkPartKey(sessionId: string, chunkId: string, partIndex: number): string {
  return `${getSessionRootPrefix(sessionId)}${S3_PATH_PREFIXES.CHUNKS_TEMP}/${chunkId}/part-${partIndex}.bin`;
}

/**
 * Generate S3 key prefix for temporary chunk parts
 *
 * @param sessionId - Session ID
 * @param chunkId - Chunk ID
 * @returns S3 key prefix (e.g., 'sessions/abc123/chunks/temp/chunk-id/')
 */
export function getTempChunkPartPrefix(sessionId: string, chunkId: string): string {
  return `${getSessionRootPrefix(sessionId)}${S3_PATH_PREFIXES.CHUNKS_TEMP}/${chunkId}/`;
}

/**
 * Generate S3 key for a WebSocket audio or video chunk
 * Format: sessions/{id}/audio-chunks/{timestamp}-{chunkNumber}.{ext}
 *      or sessions/{id}/video-chunks/{timestamp}-{chunkNumber}.{ext}
 *
 * @param sessionId - Session ID
 * @param chunkType - 'audio' or 'video'
 * @param timestamp - Unix timestamp (ms)
 * @param chunkNumber - Chunk sequence number
 * @param extension - File extension (e.g., 'webm')
 * @returns S3 key (e.g., 'sessions/abc123/audio-chunks/1772952987123-5.webm')
 */
export function getChunkKey(
  sessionId: string,
  chunkType: 'audio' | 'video',
  timestamp: number,
  chunkNumber: number,
  extension: string
): string {
  const folder =
    chunkType === 'video' ? S3_PATH_PREFIXES.VIDEO_CHUNKS : S3_PATH_PREFIXES.AUDIO_CHUNKS;
  return `${getSessionRootPrefix(sessionId)}${folder}/${timestamp}-${chunkNumber}.${extension}`;
}

/**
 * Generate S3 key for a PDF report
 * Format: reports/sessions/{id}/report-{timestamp}.pdf
 *
 * @param sessionId - Session ID
 * @param timestamp - Timestamp for uniqueness (default: Date.now())
 * @returns S3 key (e.g., 'reports/sessions/abc123/report-1772952987123.pdf')
 */
export function getReportKey(sessionId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  return `${S3_REPORT_PREFIX}/${sessionId}/report-${ts}.pdf`;
}
