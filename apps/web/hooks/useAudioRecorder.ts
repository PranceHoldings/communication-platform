/**
 * Audio Recorder Hook
 * Handles browser microphone access and real-time audio recording
 */

'use client';

import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderOptions {
  onAudioChunk?: (chunk: Blob, timestamp: number, sequenceNumber: number) => void;
  onRecordingComplete?: (audioBlob: Blob) => void;
  onSpeechEnd?: () => void; // Called when silence is detected
  onError?: (error: Error) => void;
  mimeType?: string;
  enableRealtime?: boolean; // Enable real-time chunk sending (default: true)
  silenceThreshold?: number; // Silence detection threshold (0-1, default: 0.05)
  silenceDuration?: number; // Silence duration in ms to trigger speech_end (default: 500)
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
    onSpeechEnd,
    onError,
    mimeType = 'audio/webm;codecs=opus',
    enableRealtime = true,
    silenceThreshold = 0.05,
    silenceDuration = 500,
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
  const sequenceNumberRef = useRef(0);

  // Silence detection
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const speechEndSentRef = useRef(true); // Start as true to prevent initial false detection

  // Monitor audio level for UI feedback and silence detection
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume (0-1)
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    setAudioLevel(normalizedLevel);

    // Silence detection
    if (enableRealtime) {
      const now = Date.now();

      if (normalizedLevel > silenceThreshold) {
        // Speech detected
        lastSpeechTimeRef.current = now;
        speechEndSentRef.current = false;

        // Log when audio level is detected (for debugging)
        console.log('[AudioRecorder] Audio level detected:', normalizedLevel.toFixed(3));
      } else {
        // Silence detected
        const silenceDurationMs = now - lastSpeechTimeRef.current;

        if (silenceDurationMs >= silenceDuration && !speechEndSentRef.current) {
          console.log('[AudioRecorder] Silence detected for', silenceDurationMs, 'ms - triggering speech_end');
          speechEndSentRef.current = true;
          onSpeechEnd?.();

          // Reset sequence number for next speech segment
          // This ensures each speech segment starts from chunk-000000.webm
          sequenceNumberRef.current = 0;
          console.log('[AudioRecorder] Sequence number reset for next speech segment');
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  }, [enableRealtime, silenceThreshold, silenceDuration, onSpeechEnd]);

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
            sequenceNumber: sequenceNumberRef.current,
          });

          // Real-time chunk sending (if enabled)
          if (enableRealtime && onAudioChunk) {
            const sequenceNumber = sequenceNumberRef.current++;
            console.log('[AudioRecorder] Sending real-time audio chunk:', {
              sequenceNumber,
              size: event.data.size,
              timestamp,
            });
            onAudioChunk(event.data, timestamp, sequenceNumber);
          }
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

      // Determine recording mode
      const timesliceMs = enableRealtime ? 1000 : undefined;

      console.log('[AudioRecorder] Starting MediaRecorder:', {
        mimeType: actualMimeType,
        state: mediaRecorder.state,
        mode: enableRealtime ? 'real-time' : 'batch',
        timeslice: timesliceMs ? `${timesliceMs}ms` : 'none',
        hasOnDataAvailable: !!mediaRecorder.ondataavailable,
      });

      // Start recording with timeslice for real-time mode
      // Note: We send Base64-encoded chunks via WebSocket to avoid WebM fragmentation issues
      if (timesliceMs) {
        mediaRecorder.start(timesliceMs);
      } else {
        mediaRecorder.start();
      }
      setIsRecording(true);

      // Reset sequence number and silence detection state
      sequenceNumberRef.current = 0;
      speechEndSentRef.current = true; // Prevent initial false detection
      lastSpeechTimeRef.current = Date.now(); // Reset speech timestamp

      console.log('[AudioRecorder] MediaRecorder started:', {
        state: mediaRecorder.state,
        mode: enableRealtime ? 'real-time (1s chunks)' : 'batch (complete blob on stop)',
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
  }, [mimeType, onAudioChunk, onError, monitorAudioLevel]);

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
