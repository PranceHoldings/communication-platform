/**
 * Audio Recorder Hook
 * Handles browser microphone access and real-time audio recording
 *
 * Design Doc: /docs/07-development/MEDIARECORDER_LIFECYCLE.md
 *
 * Key Concepts:
 * - MediaRecorder.start(timeslice) generates EBML header only for first chunk
 * - Subsequent chunks are fragments (SimpleBlock)
 * - stop() fires ondataavailable (final buffer) THEN onstop
 * - Restart sequence: 3 phases (stop old, reset state, create new)
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import {
  AudioRecorderLogger,
  LogPhase,
  verifyEBMLHeader,
} from '@/lib/logger/audio-recorder-logger';

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
  restartRecording: () => void; // Restart MediaRecorder for new EBML header
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

  // Logger (initialized with session-like ID)
  const loggerRef = useRef<AudioRecorderLogger | null>(null);
  if (!loggerRef.current) {
    loggerRef.current = new AudioRecorderLogger(`recorder-${Date.now()}`);
  }
  const logger = loggerRef.current;

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

        // Only reset speechEndSent if we're NOT in the initial state
        // This prevents sending chunks during the silent period after speech_end
        if (!speechEndSentRef.current) {
          logger.logAudioLevel(normalizedLevel, silenceThreshold);
        } else {
          // First speech after silence - reset flag
          logger.info(LogPhase.RECORDING, 'Speech detected after silence - resuming chunk transmission', {
            level: normalizedLevel.toFixed(3),
            threshold: silenceThreshold,
          });
        }
        speechEndSentRef.current = false;
      } else {
        // Silence detected
        const silenceDurationMs = now - lastSpeechTimeRef.current;

        if (silenceDurationMs >= silenceDuration && !speechEndSentRef.current) {
          logger.logSilenceDetected(silenceDurationMs, silenceDuration);
          speechEndSentRef.current = true;
          onSpeechEnd?.();

          // NOTE: sequenceNumber reset is done in restartRecording()
          // NOT here, to avoid timing issues with old recorder's final chunk
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  }, [enableRealtime, silenceThreshold, silenceDuration, onSpeechEnd, logger]);

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
      if (audioTracks.length > 0 && audioTracks[0]) {
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
        if (event.data.size > 0) {
          const timestamp = Date.now();
          const sequence = sequenceNumberRef.current;

          // Store chunk for complete recording
          recordedChunksRef.current.push(event.data);

          // Log chunk capture
          logger.logChunk(sequence, event.data.size, sequence === 0);

          // EBML header verification (development only, first chunk only)
          if (sequence === 0) {
            verifyEBMLHeader(event.data, logger, sequence);
          }

          // Real-time chunk sending (if enabled)
          // IMPORTANT: Do NOT send chunks if we're in the silent period after speech_end
          // Wait until actual speech is detected (speechEndSentRef becomes false)
          if (enableRealtime && onAudioChunk) {
            if (speechEndSentRef.current) {
              logger.debug(LogPhase.RECORDING, 'Skipping chunk transmission (waiting for speech after silence)', {
                sequence,
                size: event.data.size,
              });
            } else {
              onAudioChunk(event.data, timestamp, sequence);
              sequenceNumberRef.current++; // Increment AFTER sending
            }
          }
        } else {
          logger.warn(LogPhase.RECORDING, 'ondataavailable fired with empty data', {
            timestamp: Date.now(),
          });
        }
      };

      mediaRecorder.onerror = event => {
        const error = new Error(`MediaRecorder error: ${event}`);
        logger.error(LogPhase.ERROR, 'MediaRecorder error', {
          error: error.message,
          state: mediaRecorder.state,
        });
        setError(error.message);
        onError?.(error);
      };

      mediaRecorder.onstop = () => {
        logger.info(LogPhase.STOP, 'Recording stopped (session end)');

        setIsRecording(false);
        setIsPaused(false);
        setAudioLevel(0);

        // Create complete audio blob from all recorded chunks
        if (recordedChunksRef.current.length > 0) {
          const completeBlob = new Blob(recordedChunksRef.current, { type: actualMimeType });
          logger.info(LogPhase.STOP, 'Complete recording created', {
            chunks: recordedChunksRef.current.length,
            size: completeBlob.size,
          });

          onRecordingComplete?.(completeBlob);
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

      // Start recording with timeslice for real-time mode
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

      // Log initialization
      logger.info(LogPhase.INIT, 'Recording initialized', {
        mimeType: actualMimeType,
        timeslice: timesliceMs || 0,
        silenceThreshold,
        silenceDuration,
        sampleRate: audioContext.sampleRate,
        recorderState: mediaRecorder.state,
      });

      // Start audio level monitoring
      monitorAudioLevel();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      logger.error(LogPhase.ERROR, 'Failed to start recording', {
        error: error.message,
        stack: error.stack,
      });
      setError(error.message);
      onError?.(error);
      throw error;
    }
  }, [mimeType, onAudioChunk, onError, monitorAudioLevel, logger]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      logger.info(LogPhase.STOP, 'Stopping recording', {
        state: mediaRecorderRef.current.state,
      });
      mediaRecorderRef.current.stop();
    }
  }, [logger]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      logger.info(LogPhase.RECORDING, 'Recording paused');
    }
  }, [logger]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      logger.info(LogPhase.RECORDING, 'Recording resumed');
    }
  }, [logger]);

  const restartRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !streamRef.current) {
      logger.warn(LogPhase.ERROR, 'Cannot restart - no active recorder or stream');
      return;
    }

    const stream = streamRef.current;
    const timesliceMs = enableRealtime ? 1000 : undefined;
    const currentMimeType = mediaRecorderRef.current.mimeType;

    // ============================================================
    // PHASE 1: Stop old recorder and disable handlers
    // ============================================================
    // CRITICAL: Disable handlers BEFORE calling stop()
    // stop() fires final ondataavailable, then onstop
    // We must prevent these events from firing
    // ============================================================

    if (mediaRecorderRef.current.state !== 'inactive') {
      const oldRecorder = mediaRecorderRef.current;

      logger.logRestartPhase1(oldRecorder.state, sequenceNumberRef.current);

      // Disable handlers to prevent final chunk and cleanup
      oldRecorder.ondataavailable = null;
      oldRecorder.onstop = null;

      // Stop the old recorder
      oldRecorder.stop();

      logger.logRestartPhase1Complete({
        ondataavailable: oldRecorder.ondataavailable === null,
        onstop: oldRecorder.onstop === null,
      });
    }

    // ============================================================
    // PHASE 2: Reset state
    // ============================================================
    // Now that old recorder is completely stopped and disabled,
    // we can safely reset the sequence number
    // ============================================================

    sequenceNumberRef.current = 0;
    speechEndSentRef.current = true;
    lastSpeechTimeRef.current = Date.now();

    logger.logRestartPhase2(sequenceNumberRef.current, speechEndSentRef.current);

    // ============================================================
    // PHASE 3: Create and start new recorder
    // ============================================================
    // The new recorder's first chunk will have EBML header
    // ============================================================

    const newRecorder = new MediaRecorder(stream, {
      mimeType: currentMimeType,
    });

    logger.logRestartPhase3Created(currentMimeType);

    // Set up event handlers for new recorder
    newRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        const timestamp = Date.now();
        const sequence = sequenceNumberRef.current;

        recordedChunksRef.current.push(event.data);

        logger.logChunk(sequence, event.data.size, sequence === 0);

        // EBML header verification (development only, first chunk only)
        if (sequence === 0) {
          verifyEBMLHeader(event.data, logger, sequence);
        }

        // Real-time chunk sending (if enabled)
        // IMPORTANT: Do NOT send chunks if we're in the silent period after speech_end
        if (enableRealtime && onAudioChunk) {
          if (speechEndSentRef.current) {
            logger.debug(LogPhase.RECORDING, 'Skipping chunk transmission (waiting for speech after silence)', {
              sequence,
              size: event.data.size,
            });
          } else {
            onAudioChunk(event.data, timestamp, sequence);
            sequenceNumberRef.current++;
          }
        }
      }
    };

    newRecorder.onerror = event => {
      const error = new Error(`MediaRecorder error: ${event}`);
      logger.error(LogPhase.ERROR, 'MediaRecorder error', {
        error: error.message,
        state: newRecorder.state,
      });
      setError(error.message);
      onError?.(error);
    };

    newRecorder.onstop = () => {
      // NOTE: This onstop is ONLY called when stopRecording() is explicitly called
      // restartRecording() sets old recorder's onstop to null, so this won't run during restart
      logger.info(LogPhase.STOP, 'Recording stopped (session end)');

      setIsRecording(false);
      setIsPaused(false);
      setAudioLevel(0);

      if (recordedChunksRef.current.length > 0) {
        const completeBlob = new Blob(recordedChunksRef.current, { type: currentMimeType });
        logger.info(LogPhase.STOP, 'Complete recording created', {
          chunks: recordedChunksRef.current.length,
          size: completeBlob.size,
        });

        onRecordingComplete?.(completeBlob);
        recordedChunksRef.current = [];
      }

      // Clean up stream and audioContext only when session ends
      stream.getTracks().forEach(track => track.stop());
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    // Start new recorder
    mediaRecorderRef.current = newRecorder;
    if (timesliceMs) {
      newRecorder.start(timesliceMs);
    } else {
      newRecorder.start();
    }

    logger.logRestartPhase3Started(newRecorder.state);
  }, [enableRealtime, onAudioChunk, onError, onRecordingComplete, logger]);

  return {
    isRecording,
    isPaused,
    error,
    audioLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    restartRecording,
  };
}
