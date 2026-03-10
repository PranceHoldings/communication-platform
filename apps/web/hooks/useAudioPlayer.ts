/**
 * Web Audio API Hook for Real-time TTS Streaming Playback
 * Phase 1.5 Day 6-7: Plays MP3 audio chunks as they arrive
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface AudioChunk {
  audio: string; // base64-encoded MP3
  isFinal: boolean;
  timestamp: number;
}

interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isInitialized: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  playChunk: (chunk: AudioChunk) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);

  // Initialize AudioContext
  const initialize = useCallback(async () => {
    if (audioContextRef.current) {
      console.log('[AudioPlayer] Already initialized');
      return;
    }

    try {
      // Create AudioContext (Safari requires 'webkit' prefix)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported');
      }

      const context = new AudioContextClass();
      audioContextRef.current = context;

      // Resume context if suspended (required by some browsers)
      if (context.state === 'suspended') {
        await context.resume();
      }

      setIsInitialized(true);
      setError(null);
      console.log('[AudioPlayer] Initialized successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize audio player';
      setError(errorMsg);
      console.error('[AudioPlayer] Initialization failed:', err);
      throw err;
    }
  }, []);

  // Play audio chunk
  const playChunk = useCallback(async (chunk: AudioChunk) => {
    if (!audioContextRef.current) {
      console.warn('[AudioPlayer] Not initialized, auto-initializing...');
      await initialize();
    }

    const context = audioContextRef.current!;

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(chunk.audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode MP3 to AudioBuffer
      const audioBuffer = await context.decodeAudioData(bytes.buffer);

      console.log('[AudioPlayer] Decoded audio chunk:', {
        duration: audioBuffer.duration.toFixed(2),
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        isFinal: chunk.isFinal,
      });

      // Add to queue
      audioQueueRef.current.push(audioBuffer);

      // Start playback if not already playing
      if (!isPlayingRef.current) {
        isPlayingRef.current = true;
        setIsPlaying(true);
        nextStartTimeRef.current = context.currentTime;
        processQueue();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to play audio chunk';
      setError(errorMsg);
      console.error('[AudioPlayer] Failed to play chunk:', err);
    }
  }, [initialize]);

  // Process audio queue
  const processQueue = useCallback(() => {
    const context = audioContextRef.current;
    if (!context || audioQueueRef.current.length === 0) {
      if (isPlayingRef.current && audioQueueRef.current.length === 0) {
        // Queue empty, stop playback
        isPlayingRef.current = false;
        setIsPlaying(false);
        console.log('[AudioPlayer] Playback complete');
      }
      return;
    }

    const audioBuffer = audioQueueRef.current.shift()!;

    // Create source node
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);

    // Schedule playback
    const startTime = Math.max(nextStartTimeRef.current, context.currentTime);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    console.log('[AudioPlayer] Scheduled chunk:', {
      startTime: startTime.toFixed(2),
      duration: audioBuffer.duration.toFixed(2),
      nextStartTime: nextStartTimeRef.current.toFixed(2),
      queueLength: audioQueueRef.current.length,
    });

    // Track source node
    sourceNodesRef.current.push(source);

    // When chunk ends, process next in queue
    source.onended = () => {
      sourceNodesRef.current = sourceNodesRef.current.filter(n => n !== source);
      processQueue();
    };
  }, []);

  // Stop playback
  const stop = useCallback(() => {
    // Stop all active source nodes
    sourceNodesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (err) {
        // Ignore errors if already stopped
      }
    });
    sourceNodesRef.current = [];

    // Clear queue
    audioQueueRef.current = [];

    isPlayingRef.current = false;
    setIsPlaying(false);
    nextStartTimeRef.current = 0;

    console.log('[AudioPlayer] Stopped');
  }, []);

  // Reset audio player
  const reset = useCallback(() => {
    stop();

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsInitialized(false);
    setError(null);

    console.log('[AudioPlayer] Reset');
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return {
    isPlaying,
    isInitialized,
    error,
    initialize,
    playChunk,
    stop,
    reset,
  };
}
