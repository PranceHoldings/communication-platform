/**
 * Unit tests for s3-paths.ts
 *
 * These tests enforce the S3 path contract: all path builders must use
 * the `sessions/` prefix for session data and `reports/sessions/` for reports.
 * Changing path formats is a breaking change — update tests intentionally.
 */

import {
  S3_PATH_PREFIXES,
  S3_REPORT_PREFIX,
  getSessionRootPrefix,
  getRealtimeChunksPrefix,
  getRealtimeChunkKey,
  getVideoChunksPrefix,
  getRecordingKey,
  getAudioKey,
  getInitialGreetingKey,
  getSilencePromptKey,
  getFrameKey,
  getTempChunkPartKey,
  getTempChunkPartPrefix,
  getChunkKey,
  getReportKey,
  AudioFileType,
} from '../s3-paths';

const SESSION_ID = 'test-session-abc123';

describe('S3_PATH_PREFIXES', () => {
  it('uses sessions as root prefix', () => {
    expect(S3_PATH_PREFIXES.SESSIONS).toBe('sessions');
  });

  it('has audio-chunks prefix for WebSocket input chunks', () => {
    expect(S3_PATH_PREFIXES.AUDIO_CHUNKS).toBe('audio-chunks');
  });

  it('has video-chunks prefix', () => {
    expect(S3_PATH_PREFIXES.VIDEO_CHUNKS).toBe('video-chunks');
  });
});

describe('S3_REPORT_PREFIX', () => {
  it('uses reports/sessions prefix', () => {
    expect(S3_REPORT_PREFIX).toBe('reports/sessions');
  });
});

describe('getSessionRootPrefix', () => {
  it('returns sessions/{id}/ format', () => {
    expect(getSessionRootPrefix(SESSION_ID)).toBe(`sessions/${SESSION_ID}/`);
  });

  it('always starts with sessions/', () => {
    expect(getSessionRootPrefix(SESSION_ID)).toMatch(/^sessions\//);
  });
});

describe('getRealtimeChunksPrefix', () => {
  it('returns sessions/{id}/realtime-chunks/ format', () => {
    expect(getRealtimeChunksPrefix(SESSION_ID)).toBe(`sessions/${SESSION_ID}/realtime-chunks/`);
  });
});

describe('getRealtimeChunkKey', () => {
  it('returns sessions/{id}/realtime-chunks/chunk-{padded}.webm format', () => {
    expect(getRealtimeChunkKey(SESSION_ID, 5)).toBe(
      `sessions/${SESSION_ID}/realtime-chunks/chunk-000005.webm`
    );
  });

  it('zero-pads sequence number to 6 digits', () => {
    expect(getRealtimeChunkKey(SESSION_ID, 1)).toContain('chunk-000001.webm');
    expect(getRealtimeChunkKey(SESSION_ID, 999999)).toContain('chunk-999999.webm');
  });
});

describe('getVideoChunksPrefix', () => {
  it('returns sessions/{id}/video-chunks/ format', () => {
    expect(getVideoChunksPrefix(SESSION_ID)).toBe(`sessions/${SESSION_ID}/video-chunks/`);
  });
});

describe('getRecordingKey', () => {
  it('returns sessions/{id}/recording.{format} format', () => {
    expect(getRecordingKey(SESSION_ID, 'webm')).toBe(`sessions/${SESSION_ID}/recording.webm`);
  });

  it('NEVER starts with recordings/', () => {
    // This is the critical regression guard — the old bug used `recordings/` prefix
    expect(getRecordingKey(SESSION_ID)).not.toMatch(/^recordings\//);
    expect(getRecordingKey(SESSION_ID, 'webm')).not.toMatch(/^recordings\//);
    expect(getRecordingKey(SESSION_ID, 'mp4')).not.toMatch(/^recordings\//);
  });

  it('always starts with sessions/', () => {
    expect(getRecordingKey(SESSION_ID)).toMatch(/^sessions\//);
  });
});

describe('getAudioKey', () => {
  it('returns sessions/{id}/audio/{type}-{ts}.{ext} format', () => {
    const key = getAudioKey(SESSION_ID, AudioFileType.AI_RESPONSE, 1234567890);
    expect(key).toBe(`sessions/${SESSION_ID}/audio/ai-response-1234567890.mp3`);
  });

  it('always starts with sessions/', () => {
    expect(getAudioKey(SESSION_ID, 'test', 1000)).toMatch(/^sessions\//);
  });
});

describe('getInitialGreetingKey', () => {
  it('returns sessions/{id}/initial-greeting/audio-{ts}.mp3 format', () => {
    const key = getInitialGreetingKey(SESSION_ID, 1234567890);
    expect(key).toBe(`sessions/${SESSION_ID}/initial-greeting/audio-1234567890.mp3`);
  });
});

describe('getSilencePromptKey', () => {
  it('returns sessions/{id}/silence-prompts/audio-{ts}.mp3 format', () => {
    const key = getSilencePromptKey(SESSION_ID, 1234567890);
    expect(key).toBe(`sessions/${SESSION_ID}/silence-prompts/audio-1234567890.mp3`);
  });
});

describe('getFrameKey', () => {
  it('returns sessions/{id}/frames/frame-{padded}.jpg format', () => {
    expect(getFrameKey(SESSION_ID, 42)).toBe(`sessions/${SESSION_ID}/frames/frame-00042.jpg`);
  });
});

describe('getTempChunkPartKey', () => {
  it('returns sessions/{id}/chunks/temp/{chunkId}/part-{n}.bin format', () => {
    const key = getTempChunkPartKey(SESSION_ID, 'chunk-xyz', 3);
    expect(key).toBe(`sessions/${SESSION_ID}/chunks/temp/chunk-xyz/part-3.bin`);
  });
});

describe('getTempChunkPartPrefix', () => {
  it('returns sessions/{id}/chunks/temp/{chunkId}/ format', () => {
    expect(getTempChunkPartPrefix(SESSION_ID, 'chunk-xyz')).toBe(
      `sessions/${SESSION_ID}/chunks/temp/chunk-xyz/`
    );
  });
});

describe('getChunkKey', () => {
  it('returns sessions/{id}/audio-chunks/{ts}-{n}.{ext} for audio type', () => {
    const key = getChunkKey(SESSION_ID, 'audio', 1772952987123, 5, 'webm');
    expect(key).toBe(`sessions/${SESSION_ID}/audio-chunks/1772952987123-5.webm`);
  });

  it('returns sessions/{id}/video-chunks/{ts}-{n}.{ext} for video type', () => {
    const key = getChunkKey(SESSION_ID, 'video', 1772952987123, 3, 'webm');
    expect(key).toBe(`sessions/${SESSION_ID}/video-chunks/1772952987123-3.webm`);
  });

  it('always starts with sessions/', () => {
    expect(getChunkKey(SESSION_ID, 'audio', 1000, 1, 'webm')).toMatch(/^sessions\//);
    expect(getChunkKey(SESSION_ID, 'video', 1000, 1, 'webm')).toMatch(/^sessions\//);
  });
});

describe('getReportKey', () => {
  it('returns reports/sessions/{id}/report-{ts}.pdf format', () => {
    const key = getReportKey(SESSION_ID, 1234567890);
    expect(key).toBe(`reports/sessions/${SESSION_ID}/report-1234567890.pdf`);
  });

  it('NEVER starts with sessions/ (reports are in a different top-level prefix)', () => {
    expect(getReportKey(SESSION_ID, 1000)).not.toMatch(/^sessions\//);
  });

  it('always starts with reports/sessions/', () => {
    expect(getReportKey(SESSION_ID, 1000)).toMatch(/^reports\/sessions\//);
  });
});

describe('path contract: no path builder returns a recordings/ prefix', () => {
  // Regression guard: the old bug stored recordings under `recordings/` which
  // did not match the S3 bucket's `sessions/` structure.
  const BANNED_PREFIX = /^recordings\//;

  it('getRecordingKey never returns recordings/ prefix', () => {
    expect(getRecordingKey(SESSION_ID)).not.toMatch(BANNED_PREFIX);
  });

  it('getChunkKey never returns recordings/ prefix', () => {
    expect(getChunkKey(SESSION_ID, 'audio', 1000, 1, 'webm')).not.toMatch(BANNED_PREFIX);
    expect(getChunkKey(SESSION_ID, 'video', 1000, 1, 'webm')).not.toMatch(BANNED_PREFIX);
  });
});
