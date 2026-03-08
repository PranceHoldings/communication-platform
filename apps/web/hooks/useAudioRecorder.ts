/**
 * Audio Recorder Hook
 * Handles browser microphone access and real-time audio recording
 */

'use client';

import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderOptions {
  onAudioChunk?: (chunk: Blob, timestamp: number) => void;
  onRecordingComplete?: (audioBlob: Blob) => void;
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
    onRecordingComplete,
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
  const recordedChunksRef = useRef<Blob[]>([]);

  // Monitor audio level for UI feedback
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume (0-1)
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    setAudioLevel(normalizedLevel);

    // Log when audio level is detected (for debugging)
    if (normalizedLevel > 0.05) {
      console.log('[AudioRecorder] Audio level detected:', normalizedLevel.toFixed(3));
    }

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
          // Note: Don't specify sampleRate - let browser use its default (usually 48kHz)
          // ffmpeg will convert to 16kHz on the backend for Azure STT
        },
      });

      streamRef.current = stream;

      // Log stream details for debugging
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const settings = audioTracks[0].getSettings();
        console.log('[AudioRecorder] Audio track settings:', {
          deviceId: settings.deviceId,
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
        });
      } else {
        console.warn('[AudioRecorder] No audio tracks found in stream!');
      }

      // Set up audio context for level monitoring
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Try WAV first (best for Azure Speech Services), then fallbacks
      const preferredMimeTypes = [
        'audio/wav',
        'audio/ogg;codecs=opus', // Azure supports OGG/Opus
        mimeType,
        'audio/webm',
        'audio/mp4',
      ];

      let actualMimeType = mimeType;
      for (const preferred of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(preferred)) {
          actualMimeType = preferred;
          console.log(`[AudioRecorder] Using MIME type: ${preferred}`);
          break;
        }
      }

      if (actualMimeType === mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
        console.warn(`[AudioRecorder] No supported MIME type found, using default`);
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: actualMimeType,
      });

      mediaRecorder.ondataavailable = event => {
        console.log('[AudioRecorder] ondataavailable event fired:', {
          dataSize: event.data.size,
          type: event.data.type,
          timestamp: Date.now(),
        });

        if (event.data.size > 0) {
          const timestamp = Date.now();

          // Store chunk for complete recording
          recordedChunksRef.current.push(event.data);

          console.log('[AudioRecorder] Audio chunk captured:', {
            size: event.data.size,
            type: event.data.type,
            timestamp,
            totalChunks: recordedChunksRef.current.length,
          });

          // Note: onAudioChunk is intentionally NOT called here
          // Reason: MediaRecorder with timeslice creates fragmented WebM chunks
          // that cannot be simply concatenated. We only process the complete blob.
        } else {
          console.warn('[AudioRecorder] ondataavailable fired but data.size is 0');
        }
      };

      mediaRecorder.onerror = event => {
        const error = new Error(`MediaRecorder error: ${event}`);
        console.error(error);
        setError(error.message);
        onError?.(error);
      };

      mediaRecorder.onstop = () => {
        setIsRecording(false);
        setIsPaused(false);
        setAudioLevel(0);

        // Create complete audio blob from all recorded chunks
        if (recordedChunksRef.current.length > 0) {
          const completeBlob = new Blob(recordedChunksRef.current, { type: actualMimeType });
          console.log('[AudioRecorder] Complete recording:', {
            chunks: recordedChunksRef.current.length,
            size: completeBlob.size,
            type: completeBlob.type,
          });

          // Call completion callback
          onRecordingComplete?.(completeBlob);

          // Clear recorded chunks
          recordedChunksRef.current = [];
        }

        // Clean up
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;

      console.log('[AudioRecorder] Starting MediaRecorder (no timeslice):', {
        mimeType: actualMimeType,
        state: mediaRecorder.state,
        hasOnDataAvailable: !!mediaRecorder.ondataavailable,
      });

      // Start recording WITHOUT timeslice to get one complete WebM blob
      // Note: Previously used timeslice=250ms, but this created fragmented chunks
      // that cannot be properly concatenated into a valid WebM file
      mediaRecorder.start();
      setIsRecording(true);

      console.log('[AudioRecorder] MediaRecorder started:', {
        state: mediaRecorder.state,
        timeslice: 'none (complete blob on stop)',
      });

      // Start audio level monitoring
      monitorAudioLevel();

      console.log('[AudioRecorder] Recording started', {
        mimeType: actualMimeType,
        mode: 'complete blob on stop',
        sampleRate: audioContext.sampleRate,
        recorderState: mediaRecorder.state,
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
