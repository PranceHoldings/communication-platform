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
  frequencyData: Uint8Array | null; // Frequency spectrum data
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
  const [frequencyData, setFrequencyData] = useState<Uint8Array | null>(null);
  const [isActive, setIsActive] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Start audio visualization
   */
  const startVisualizer = useCallback(
    (stream: MediaStream) => {
      try {
        // Clean up existing context if any
        if (audioContextRef.current) {
          stopVisualizer();
        }

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
        setFrequencyData(dataArray);

        setIsActive(true);

        // Start animation loop
        const updateVisualization = () => {
          if (!analyserRef.current) return;

          // Get frequency data
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average audio level
          const sum = dataArray.reduce((acc, val) => acc + val, 0);
          const average = sum / dataArray.length;
          const normalizedLevel = average / 255;

          setAudioLevel(normalizedLevel);
          setFrequencyData(new Uint8Array(dataArray));

          animationFrameRef.current = requestAnimationFrame(updateVisualization);
        };

        updateVisualization();

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
    setFrequencyData(null);
    setAudioLevel(0);
    setIsActive(false);

    console.log('[AudioVisualizer] Stopped');
  }, []);

  /**
   * Get normalized waveform data for visualization
   * Returns array of values (0-1) representing frequency bins
   */
  const getWaveformData = useCallback((): number[] => {
    if (!frequencyData) return [];

    // Normalize frequency data to 0-1 range
    return Array.from(frequencyData).map(value => value / 255);
  }, [frequencyData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVisualizer();
    };
  }, [stopVisualizer]);

  return {
    audioLevel,
    frequencyData,
    isActive,
    startVisualizer,
    stopVisualizer,
    getWaveformData,
  };
}
