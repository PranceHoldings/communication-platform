/**
 * Audio Recorder Hook
 * Handles browser microphone access and real-time audio recording
 */

'use client';

import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderOptions {
  onAudioChunk?: (chunk: Blob, timestamp: number) => void;
  onError?: (error: Error) => void;
  mimeType?: string;
  timeslice?: number; // ms between chunks
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  error: string | null;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const {
    onAudioChunk,
    onError,
    mimeType = 'audio/webm;codecs=opus',
    timeslice = 250, // Send chunks every 250ms for real-time processing
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Monitor audio level for UI feedback
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume (0-1)
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setAudioLevel(average / 255);

    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // 16kHz is standard for speech recognition
        },
      });

      streamRef.current = stream;

      // Set up audio context for level monitoring
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Check if the browser supports the desired MIME type
      let actualMimeType = mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.warn(`MIME type ${mimeType} not supported, trying fallbacks...`);

        const fallbacks = [
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4',
        ];

        for (const fallback of fallbacks) {
          if (MediaRecorder.isTypeSupported(fallback)) {
            actualMimeType = fallback;
            console.log(`Using fallback MIME type: ${fallback}`);
            break;
          }
        }
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: actualMimeType,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const timestamp = Date.now();
          onAudioChunk?.(event.data, timestamp);
        }
      };

      mediaRecorder.onerror = (event) => {
        const error = new Error(`MediaRecorder error: ${event}`);
        console.error(error);
        setError(error.message);
        onError?.(error);
      };

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        setIsPaused(false);
        setAudioLevel(0);

        // Clean up
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;

      // Start recording with timeslice for real-time chunks
      mediaRecorder.start(timeslice);
      setIsRecording(true);

      // Start audio level monitoring
      monitorAudioLevel();

      console.log('[AudioRecorder] Recording started', {
        mimeType: actualMimeType,
        timeslice,
        sampleRate: audioContext.sampleRate,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      console.error('[AudioRecorder] Error:', error);
      setError(error.message);
      onError?.(error);
      throw error;
    }
  }, [mimeType, timeslice, onAudioChunk, onError, monitorAudioLevel]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      console.log('[AudioRecorder] Recording stopped');
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      console.log('[AudioRecorder] Recording paused');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      console.log('[AudioRecorder] Recording resumed');
    }
  }, []);

  return {
    isRecording,
    isPaused,
    error,
    audioLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
