# SessionPlayer - Audio Buffering Integration Example

**Phase 1.6:** パフォーマンス最適化

## 統合手順

### 1. useAudioRecorder.ts へのバッファリング統合

**場所:** `apps/web/hooks/useAudioRecorder.ts`

**変更前:**
```typescript
import { useRef, useCallback, useState, useEffect } from 'react';

export function useAudioRecorder(
  sendAudioChunk: (data: ArrayBuffer, timestamp: number) => void,
  options: AudioRecorderOptions = {}
) {
  // ...

  const handleDataAvailable = useCallback(
    (event: BlobEvent) => {
      if (event.data.size > 0 && !isPaused) {
        event.data.arrayBuffer().then(buffer => {
          const timestamp = Date.now();
          console.log('[AudioRecorder] Sending chunk:', {
            size: buffer.byteLength,
            timestamp,
          });

          // Send directly to WebSocket
          sendAudioChunk(buffer, timestamp);
        });
      }
    },
    [sendAudioChunk, isPaused]
  );

  // ...
}
```

**変更後:**
```typescript
import { useRef, useCallback, useState, useEffect } from 'react';
import { useAudioBuffer } from './useAudioBuffer';

export function useAudioRecorder(
  sendAudioChunk: (data: ArrayBuffer, timestamp: number) => void,
  options: AudioRecorderOptions = {}
) {
  // Phase 1.6: Audio buffering
  const audioBuffer = useAudioBuffer(sendAudioChunk, {
    maxBufferSize: 10,  // Buffer up to 10 chunks
    batchSize: 5,       // Send 5 chunks at a time
    flushInterval: 100, // Flush every 100ms
  });

  const handleDataAvailable = useCallback(
    (event: BlobEvent) => {
      if (event.data.size > 0 && !isPaused) {
        event.data.arrayBuffer().then(buffer => {
          const timestamp = Date.now();
          console.log('[AudioRecorder] Buffering chunk:', {
            size: buffer.byteLength,
            timestamp,
          });

          // Add to buffer instead of sending directly
          audioBuffer.addChunk(buffer, timestamp);

          // Log buffer stats
          const stats = audioBuffer.getStats();
          console.log('[AudioRecorder] Buffer stats:', stats);
        });
      }
    },
    [audioBuffer, isPaused]
  );

  // Flush buffer on stop
  const stop = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      console.log('[AudioRecorder] Flushing audio buffer on stop');
      audioBuffer.flush();
    }
    setIsRecording(false);
  }, [audioBuffer]);

  // Clear buffer on component unmount
  useEffect(() => {
    return () => {
      audioBuffer.clear();
    };
  }, [audioBuffer]);

  return {
    isRecording,
    start,
    stop,
    pause,
    resume,
    // Expose buffer control
    flushBuffer: audioBuffer.flush,
    getBufferStats: audioBuffer.getStats,
  };
}
```

### 2. SessionPlayer.tsx への統合

**場所:** `apps/web/components/session-player/index.tsx`

**追加コード:**
```typescript
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

export function SessionPlayer({ session, avatar, scenario }: SessionPlayerProps) {
  // ... existing code ...

  // Audio recorder with buffering
  const {
    isRecording: isMicRecording,
    start: startMicRecording,
    stop: stopMicRecording,
    flushBuffer,
    getBufferStats,
  } = useAudioRecorder(sendAudioChunk, {
    onError: handleRecordingError,
    onDataAvailable: handleAudioChunk,
    timeslice: 100, // 100ms chunks
    silenceThreshold: effectiveSilenceThreshold,
    minSilenceDuration: effectiveMinSilenceDuration,
    bypassSpeechDetection: process.env.NEXT_PUBLIC_BYPASS_SPEECH_DETECTION === 'true',
  });

  // Monitor buffer stats
  useEffect(() => {
    if (status === 'ACTIVE' && isMicRecording) {
      const intervalId = setInterval(() => {
        const stats = getBufferStats();
        console.log('[SessionPlayer] Audio Buffer Stats:', stats);

        // Alert if buffer is getting full
        if (stats.bufferedChunks > stats.maxBufferSize * 0.8) {
          console.warn('[SessionPlayer] Audio buffer is getting full:', stats);
        }
      }, 5000); // Every 5 seconds

      return () => clearInterval(intervalId);
    }
  }, [status, isMicRecording, getBufferStats]);

  // Force flush on session end
  const handleEndSession = useCallback(() => {
    console.log('[SessionPlayer] Ending session - flushing audio buffer');
    flushBuffer();

    // ... existing session end logic ...
  }, [flushBuffer]);

  // ... rest of component ...
}
```

### 3. パフォーマンスモニタリング UI

**追加コンポーネント:**
```typescript
// apps/web/components/session-player/BufferStats.tsx
'use client';

import { useEffect, useState } from 'react';

interface BufferStatsProps {
  getStats: () => {
    bufferedChunks: number;
    maxBufferSize: number;
    batchSize: number;
    flushInterval: number;
    nextSequenceNumber: number;
  };
  refreshInterval?: number;
}

export function BufferStats({ getStats, refreshInterval = 1000 }: BufferStatsProps) {
  const [stats, setStats] = useState(getStats());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setStats(getStats());
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [getStats, refreshInterval]);

  const bufferUsagePercent = (stats.bufferedChunks / stats.maxBufferSize) * 100;
  const bufferColor =
    bufferUsagePercent > 80 ? 'text-red-600' :
    bufferUsagePercent > 50 ? 'text-yellow-600' :
    'text-green-600';

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="text-sm font-semibold mb-2">Audio Buffer</h4>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Buffered:</span>
          <span className={bufferColor}>
            {stats.bufferedChunks} / {stats.maxBufferSize}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              bufferUsagePercent > 80 ? 'bg-red-600' :
              bufferUsagePercent > 50 ? 'bg-yellow-600' :
              'bg-green-600'
            }`}
            style={{ width: `${bufferUsagePercent}%` }}
          />
        </div>
        <div className="text-xs text-gray-500">
          <div>Batch Size: {stats.batchSize}</div>
          <div>Flush Interval: {stats.flushInterval}ms</div>
          <div>Next Sequence: {stats.nextSequenceNumber}</div>
        </div>
      </div>
    </div>
  );
}
```

**SessionPlayer.tsx に追加:**
```typescript
import { BufferStats } from './BufferStats';

export function SessionPlayer({ session, avatar, scenario }: SessionPlayerProps) {
  // ... existing code ...

  return (
    <div className="space-y-6">
      {/* Existing UI */}

      {/* Buffer Stats (Development only) */}
      {process.env.NODE_ENV === 'development' && status === 'ACTIVE' && (
        <BufferStats getStats={getBufferStats} />
      )}

      {/* ... rest of UI ... */}
    </div>
  );
}
```

## テスト

### 1. ユニットテスト

```typescript
// apps/web/hooks/__tests__/useAudioBuffer.test.ts
import { renderHook, act } from '@testing-library/react';
import { useAudioBuffer } from '../useAudioBuffer';

describe('useAudioBuffer', () => {
  it('should buffer chunks and send in batches', () => {
    const sendChunk = jest.fn();
    const { result } = renderHook(() =>
      useAudioBuffer(sendChunk, {
        maxBufferSize: 10,
        batchSize: 5,
        flushInterval: 100,
      })
    );

    // Add 5 chunks (not yet full)
    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.addChunk(new ArrayBuffer(100), Date.now());
      });
    }

    // Should not send yet
    expect(sendChunk).not.toHaveBeenCalled();

    // Add 5 more chunks (buffer full)
    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.addChunk(new ArrayBuffer(100), Date.now());
      });
    }

    // Should send first batch of 5
    expect(sendChunk).toHaveBeenCalledTimes(5);
  });

  it('should auto-flush after interval', async () => {
    jest.useFakeTimers();
    const sendChunk = jest.fn();
    const { result } = renderHook(() =>
      useAudioBuffer(sendChunk, {
        maxBufferSize: 10,
        batchSize: 5,
        flushInterval: 100,
      })
    );

    // Add 3 chunks
    act(() => {
      for (let i = 0; i < 3; i++) {
        result.current.addChunk(new ArrayBuffer(100), Date.now());
      }
    });

    // Should not send yet
    expect(sendChunk).not.toHaveBeenCalled();

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(150);
    });

    // Should auto-flush
    expect(sendChunk).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });

  it('should clear buffer', () => {
    const sendChunk = jest.fn();
    const { result } = renderHook(() => useAudioBuffer(sendChunk));

    // Add chunks
    act(() => {
      result.current.addChunk(new ArrayBuffer(100), Date.now());
      result.current.addChunk(new ArrayBuffer(100), Date.now());
    });

    let stats = result.current.getStats();
    expect(stats.bufferedChunks).toBe(2);

    // Clear
    act(() => {
      result.current.clear();
    });

    stats = result.current.getStats();
    expect(stats.bufferedChunks).toBe(0);
  });
});
```

### 2. 統合テスト

```typescript
// apps/web/tests/e2e/session-buffering.spec.ts
import { test, expect } from '@playwright/test';

test('should buffer audio chunks during session', async ({ page }) => {
  await page.goto('/dashboard/sessions/new');

  // Start session
  await page.click('[data-testid="start-session"]');
  await page.waitForSelector('[data-testid="buffer-stats"]');

  // Check initial buffer state
  const bufferStats = page.locator('[data-testid="buffer-stats"]');
  await expect(bufferStats).toContainText('Buffered: 0');

  // Simulate audio recording
  // (In real E2E test, this would come from actual microphone)

  // Wait for buffer to accumulate
  await page.waitForTimeout(2000);

  // Buffer should have some chunks
  await expect(bufferStats).toContainText(/Buffered: [1-9]/);

  // End session
  await page.click('[data-testid="end-session"]');

  // Buffer should be flushed (empty)
  await expect(bufferStats).toContainText('Buffered: 0');
});
```

### 3. パフォーマンステスト

```typescript
// apps/web/tests/performance/buffering.perf.test.ts
describe('Audio Buffering Performance', () => {
  it('should reduce network requests by 80%', () => {
    const directSendCount = 100; // 100 individual chunks
    const bufferedSendCount = 20; // 20 batches (5 chunks each)

    const reduction = ((directSendCount - bufferedSendCount) / directSendCount) * 100;

    expect(reduction).toBe(80);
  });

  it('should maintain low latency', async () => {
    const sendChunk = jest.fn();
    const buffer = useAudioBuffer(sendChunk, {
      maxBufferSize: 10,
      batchSize: 5,
      flushInterval: 100,
    });

    const start = Date.now();

    // Add chunk
    buffer.addChunk(new ArrayBuffer(100), Date.now());

    // Wait for auto-flush
    await new Promise(resolve => setTimeout(resolve, 150));

    const latency = Date.now() - start;

    // Latency should be within flush interval + margin
    expect(latency).toBeLessThan(200); // 100ms flush + 100ms margin
  });
});
```

## パフォーマンスメトリクス

### 目標値

| メトリクス | 目標値 | 測定方法 |
|-----------|--------|---------|
| ネットワークリクエスト削減 | 80% | Chrome DevTools Network |
| バッファリングレイテンシ | <100ms | Performance.now() |
| メモリ使用量増加 | <1MB | Chrome DevTools Memory |
| 音声品質劣化 | なし | 主観評価 |

### モニタリング

```typescript
// Monitor buffer performance
useEffect(() => {
  if (status === 'ACTIVE') {
    const metrics = {
      startTime: Date.now(),
      totalChunks: 0,
      totalFlushes: 0,
      averageBufferSize: 0,
    };

    const intervalId = setInterval(() => {
      const stats = getBufferStats();

      metrics.totalChunks = stats.nextSequenceNumber;
      metrics.averageBufferSize =
        (metrics.averageBufferSize + stats.bufferedChunks) / 2;

      console.log('[Performance] Buffer Metrics:', {
        duration: Date.now() - metrics.startTime,
        totalChunks: metrics.totalChunks,
        averageBufferSize: metrics.averageBufferSize.toFixed(2),
        currentBuffered: stats.bufferedChunks,
      });
    }, 10000); // Every 10 seconds

    return () => clearInterval(intervalId);
  }
}, [status, getBufferStats]);
```

## トラブルシューティング

### 問題: バッファが頻繁に満杯になる

**原因:** 送信速度 < 音声チャンク生成速度

**解決策:**
```typescript
// maxBufferSize を増やす
const audioBuffer = useAudioBuffer(sendChunk, {
  maxBufferSize: 20, // 10 → 20
  batchSize: 10,     // 5 → 10 (送信量も増やす)
});
```

### 問題: 音声の遅延が大きい

**原因:** flushInterval が長すぎる

**解決策:**
```typescript
// flushInterval を短くする
const audioBuffer = useAudioBuffer(sendChunk, {
  flushInterval: 50, // 100ms → 50ms
});
```

### 問題: ネットワークリクエストが多すぎる

**原因:** batchSize が小さすぎる

**解決策:**
```typescript
// batchSize を増やす
const audioBuffer = useAudioBuffer(sendChunk, {
  batchSize: 10, // 5 → 10
});
```

---

**作成日:** 2026-03-20
**Phase:** 1.6 - パフォーマンス最適化
**次回更新:** 統合テスト完了後
