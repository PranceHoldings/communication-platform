/**
 * Audio Visualizer Hook
 * Real-time audio waveform visualization using Web Audio API
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseAudioVisualizerOptions {
  fftSize?: number; // FFT size for frequency analysis (default: 256)
  smoothingTimeConstant?: number; // Smoothing (0-1, default: 0.8)
  minDecibels?: number; // Minimum decibels (default: -90)
  maxDecibels?: number; // Maximum decibels (default: -10)
}

interface UseAudioVisualizerReturn {
  audioLevel: number; // Current audio level (0-1)
  isActive: boolean;
  startVisualizer: (stream: MediaStream) => void;
  stopVisualizer: () => void;
  getWaveformData: () => number[]; // Normalized waveform data for visualization
}

export function useAudioVisualizer(
  options: UseAudioVisualizerOptions = {}
): UseAudioVisualizerReturn {
  const {
    fftSize = 256,
    smoothingTimeConstant = 0.8,
    minDecibels = -90,
    maxDecibels = -10,
  } = options;

  const [audioLevel, setAudioLevel] = useState(0);
  // Use ref instead of state to avoid triggering re-renders on every animation frame
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  // Ref that the rAF loop writes to — never calls setState
  const audioLevelRef = useRef(0);
  const [isActive, setIsActive] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Separate interval that reads the ref and updates React state at ~10fps
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Start audio visualization
   */
  const startVisualizer = useCallback(
    (stream: MediaStream) => {
      try {
        // Clean up existing context if any.
        // Explicitly clear interval here rather than delegating to stopVisualizer(),
        // because stopVisualizer is captured in the outer closure and calling it
        // synchronously before re-initialization could cause stale-ref issues.
        if (audioLevelIntervalRef.current) {
          clearInterval(audioLevelIntervalRef.current);
          audioLevelIntervalRef.current = null;
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (sourceNodeRef.current) {
          sourceNodeRef.current.disconnect();
          sourceNodeRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        analyserRef.current = null;

        // Create audio context
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        // Create analyser node
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothingTimeConstant;
        analyser.minDecibels = minDecibels;
        analyser.maxDecibels = maxDecibels;
        analyserRef.current = analyser;

        // Create source from media stream
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceNodeRef.current = source;

        // Initialize frequency data array
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        frequencyDataRef.current = dataArray;

        setIsActive(true);

        // rAF loop — writes only to refs, never calls setState
        const updateVisualization = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);

          const sum = dataArray.reduce((acc, val) => acc + val, 0);
          const average = sum / dataArray.length;
          audioLevelRef.current = average / 255;

          // Update ref in-place for waveform rendering
          frequencyDataRef.current = dataArray;

          animationFrameRef.current = requestAnimationFrame(updateVisualization);
        };

        updateVisualization();

        // Separate interval to push audioLevel into React state at ~10fps.
        // Decoupled from rAF to prevent setState-inside-render-cycle errors.
        audioLevelIntervalRef.current = setInterval(() => {
          setAudioLevel(audioLevelRef.current);
        }, 100);

        console.log('[AudioVisualizer] Started:', {
          fftSize,
          bufferLength,
        });
      } catch (error) {
        console.error('[AudioVisualizer] Failed to start:', error);
        setIsActive(false);
      }
    },
    [fftSize, smoothingTimeConstant, minDecibels, maxDecibels]
  );

  /**
   * Stop audio visualization
   */
  const stopVisualizer = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop the state-update interval
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }

    // Disconnect source node
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    frequencyDataRef.current = null;
    audioLevelRef.current = 0;
    setAudioLevel(0);
    setIsActive(false);

    console.log('[AudioVisualizer] Stopped');
  }, []);

  /**
   * Get normalized waveform data for visualization
   * Returns array of values (0-1) representing frequency bins
   */
  const getWaveformData = useCallback((): number[] => {
    if (!frequencyDataRef.current) return [];
    // Normalize frequency data to 0-1 range
    return Array.from(frequencyDataRef.current).map(value => value / 255);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVisualizer();
    };
  }, [stopVisualizer]);

  return {
    audioLevel,
    isActive,
    startVisualizer,
    stopVisualizer,
    getWaveformData,
  };
}
