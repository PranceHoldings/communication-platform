/**
 * Audio Buffer Hook for Optimized Chunk Management
 * Phase 1.6: Performance Optimization
 */

'use client';

import { useRef, useCallback } from 'react';

interface AudioBufferConfig {
  maxBufferSize: number; // Maximum number of chunks to buffer
  batchSize: number; // Number of chunks to send in one batch
  flushInterval: number; // Auto-flush interval in milliseconds
}

interface BufferedChunk {
  data: ArrayBuffer;
  timestamp: number;
  sequenceNumber: number;
}

const DEFAULT_CONFIG: AudioBufferConfig = {
  maxBufferSize: 10, // Buffer up to 10 chunks
  batchSize: 5, // Send 5 chunks at a time
  flushInterval: 100, // Flush every 100ms
};

export function useAudioBuffer(
  sendChunk: (data: ArrayBuffer, timestamp: number) => void,
  config: Partial<AudioBufferConfig> = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const bufferRef = useRef<BufferedChunk[]>([]);
  const sequenceNumberRef = useRef(0);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFlushing = useRef(false);

  /**
   * Flush buffered chunks to the sender
   */
  const flush = useCallback(() => {
    if (isFlushing.current || bufferRef.current.length === 0) {
      return;
    }

    isFlushing.current = true;

    try {
      const chunksToSend = bufferRef.current.splice(0, finalConfig.batchSize);

      // Send all buffered chunks
      for (const chunk of chunksToSend) {
        sendChunk(chunk.data, chunk.timestamp);
      }

      console.log(
        `[AudioBuffer] Flushed ${chunksToSend.length} chunks, ${bufferRef.current.length} remaining`
      );
    } finally {
      isFlushing.current = false;
    }
  }, [sendChunk, finalConfig.batchSize]);

  /**
   * Add chunk to buffer and flush if needed
   */
  const addChunk = useCallback(
    (data: ArrayBuffer, timestamp: number) => {
      const chunk: BufferedChunk = {
        data,
        timestamp,
        sequenceNumber: sequenceNumberRef.current++,
      };

      bufferRef.current.push(chunk);

      // Flush if buffer is full
      if (bufferRef.current.length >= finalConfig.maxBufferSize) {
        console.log('[AudioBuffer] Buffer full, flushing immediately');
        flush();
      } else {
        // Schedule auto-flush
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
        }

        flushTimerRef.current = setTimeout(() => {
          flush();
          flushTimerRef.current = null;
        }, finalConfig.flushInterval);
      }
    },
    [flush, finalConfig.maxBufferSize, finalConfig.flushInterval]
  );

  /**
   * Clear buffer and cancel pending flushes
   */
  const clear = useCallback(() => {
    bufferRef.current = [];
    sequenceNumberRef.current = 0;

    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    console.log('[AudioBuffer] Buffer cleared');
  }, []);

  /**
   * Force flush all buffered chunks immediately
   */
  const forceFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    flush();
  }, [flush]);

  /**
   * Get current buffer statistics
   */
  const getStats = useCallback(() => {
    return {
      bufferedChunks: bufferRef.current.length,
      maxBufferSize: finalConfig.maxBufferSize,
      batchSize: finalConfig.batchSize,
      flushInterval: finalConfig.flushInterval,
      nextSequenceNumber: sequenceNumberRef.current,
    };
  }, [finalConfig]);

  return {
    addChunk,
    flush: forceFlush,
    clear,
    getStats,
  };
}
