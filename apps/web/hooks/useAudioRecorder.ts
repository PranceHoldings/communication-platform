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
  onAudioChunk?: (chunk: Blob, timestamp: number, sequenceNumber: number, chunkId: string) => void; // Phase 1.6.1: Added chunkId
  onRecordingComplete?: (audioBlob: Blob) => void;
  onSpeechEnd?: () => void; // Called when silence is detected
  onError?: (error: Error) => void;
  onChunkAck?: (chunkId: string, status: string) => void; // Phase 1.6.1: ACK callback
  onBargeIn?: () => void; // Called when user speaks during AI response (barge-in)
  mimeType?: string;
  enableRealtime?: boolean; // Enable real-time chunk sending (default: true)
  silenceThreshold?: number; // Silence detection threshold (0-1, default: 0.05)
  silenceDuration?: number; // Silence duration in ms to trigger speech_end (default: 500)
  isAiRespondingRef?: React.RefObject<boolean>; // Ref to check if AI is speaking (always latest value)
  bypassSpeechDetection?: boolean; // Bypass speech detection for testing (default: false)
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  error: string | null;
  audioLevel: number;
  audioStream: MediaStream | null; // マイク音声ストリーム
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  restartRecording: () => void; // Restart MediaRecorder for new EBML header
  handleChunkAck: (chunkId: string, status: string) => void; // Phase 1.6.1: ACK handler
}

// Phase 1.6.1: ACK tracking for reliable chunk transmission
interface PendingChunk {
  chunkId: string;
  data: Blob;
  timestamp: number;
  sequenceNumber: number;
  sentAt: number;
  retryCount: number;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const {
    onAudioChunk,
    onRecordingComplete,
    onSpeechEnd,
    onError,
    onChunkAck, // Phase 1.6.1: ACK callback
    onBargeIn,
    mimeType = 'audio/webm;codecs=opus',
    enableRealtime = true,
    silenceThreshold = 0.15, // Raised from 0.05 to avoid false positives from ambient noise
    silenceDuration = 500,
    isAiRespondingRef,
    bypassSpeechDetection = false, // Default: false (normal speech detection)
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
  // Ref for raw audio level — rAF loop writes here, never calls setState
  const audioLevelRef = useRef(0);
  // Separate interval to push audioLevel into React state at ~10fps
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const sequenceNumberRef = useRef(0);

  // Silence detection
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const speechEndSentRef = useRef(true); // Start as true to prevent initial false detection
  const speechStartTimeRef = useRef<number | null>(null); // Track when continuous speech started
  const MINIMUM_SPEECH_DURATION = 800; // Minimum 800ms of continuous speech before allowing speech_end
  const SPEECH_START_THRESHOLD = 0.08; // Higher threshold for starting speech detection (reduced false positives)

  // Low volume detection
  const lowVolumeStartRef = useRef<number | null>(null);
  const lowVolumeWarningShownRef = useRef(false);
  const LOW_VOLUME_THRESHOLD = 0.01; // Very low threshold
  const LOW_VOLUME_DURATION = 5000; // 5 seconds

  // Logger (initialized with session-like ID)
  const loggerRef = useRef<AudioRecorderLogger | null>(null);
  if (!loggerRef.current) {
    loggerRef.current = new AudioRecorderLogger(`recorder-${Date.now()}`);
  }
  const logger = loggerRef.current;

  // Phase 1.6.1: ACK tracking for reliable chunk transmission
  const pendingChunksRef = useRef<Map<string, PendingChunk>>(new Map());
  const ackTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const MAX_RETRIES = 3;
  const ACK_TIMEOUT_MS = 5000; // 5 seconds

  // ============================================================
  // Phase 1.6.1: ACK Tracking & Retry System
  // ============================================================

  /**
   * Handle ACK timeout - retry with exponential backoff
   */
  const handleAckTimeout = useCallback((chunkId: string) => {
    const pendingChunk = pendingChunksRef.current.get(chunkId);
    if (!pendingChunk) {
      return; // Already acknowledged or removed
    }

    const { retryCount, data, timestamp, sequenceNumber } = pendingChunk;

    if (retryCount >= MAX_RETRIES) {
      // Max retries exceeded - give up
      logger.error(LogPhase.ERROR, `Chunk ${chunkId} failed after ${MAX_RETRIES} retries`);
      pendingChunksRef.current.delete(chunkId);
      ackTimeoutRef.current.delete(chunkId);
      onError?.(new Error(`Failed to send audio chunk ${chunkId} after ${MAX_RETRIES} retries`));
      return;
    }

    // Retry with exponential backoff: 1s, 2s, 4s
    const backoffMs = Math.pow(2, retryCount) * 1000;
    logger.warn(
      LogPhase.RECORDING,
      `Chunk ${chunkId} ACK timeout - retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
      { chunkId, retryCount, backoffMs }
    );

    // Update retry count
    pendingChunksRef.current.set(chunkId, {
      ...pendingChunk,
      retryCount: retryCount + 1,
      sentAt: Date.now(),
    });

    // Schedule retry
    setTimeout(() => {
      if (onAudioChunk) {
        onAudioChunk(data, timestamp, sequenceNumber, chunkId);
      }

      // Set new ACK timeout
      const timeoutId = setTimeout(() => {
        handleAckTimeout(chunkId);
      }, ACK_TIMEOUT_MS);

      ackTimeoutRef.current.set(chunkId, timeoutId);
    }, backoffMs);
  }, [onAudioChunk, onError, logger]);

  /**
   * Handle chunk ACK from server
   */
  const handleChunkAck = useCallback((chunkId: string, status: string) => {
    const timeoutId = ackTimeoutRef.current.get(chunkId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      ackTimeoutRef.current.delete(chunkId);
    }

    const pendingChunk = pendingChunksRef.current.get(chunkId);
    if (pendingChunk) {
      pendingChunksRef.current.delete(chunkId);
      logger.debug(
        LogPhase.RECORDING,
        `Chunk ${chunkId} acknowledged (status: ${status})`,
        {
          chunkId,
          status,
          latency: Date.now() - pendingChunk.sentAt,
          retryCount: pendingChunk.retryCount,
        }
      );

      // Notify parent via callback
      onChunkAck?.(chunkId, status);
    }
  }, [logger, onChunkAck]);

  /**
   * Send chunk with ACK tracking and retry
   */
  const sendChunkWithRetry = useCallback((
    data: Blob,
    timestamp: number,
    sequenceNumber: number,
    chunkId: string
  ) => {
    // Add to pending chunks
    pendingChunksRef.current.set(chunkId, {
      chunkId,
      data,
      timestamp,
      sequenceNumber,
      sentAt: Date.now(),
      retryCount: 0,
    });

    // Send chunk
    if (onAudioChunk) {
      onAudioChunk(data, timestamp, sequenceNumber, chunkId);
    }

    // Set ACK timeout
    const timeoutId = setTimeout(() => {
      handleAckTimeout(chunkId);
    }, ACK_TIMEOUT_MS);

    ackTimeoutRef.current.set(chunkId, timeoutId);
  }, [onAudioChunk, handleAckTimeout]);

  // ============================================================
  // Restart Recording - MUST be defined before monitorAudioLevel
  // ============================================================
  const restartRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !streamRef.current) {
      logger.warn(LogPhase.ERROR, 'Cannot restart - no active recorder or stream');
      return;
    }

    // CRITICAL: Clear the audio level interval BEFORE stopping the old recorder.
    // The old recorder's onstop is nulled out below (to suppress final chunk),
    // so its clearInterval would never run. Clear it explicitly here to prevent
    // interval accumulation across multiple speech turns.
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
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
    // IMPORTANT: Set speechEndSent to TRUE to prevent speech_end until first chunk is sent
    // ============================================================

    // NOTE: Do NOT reset sequenceNumberRef here. The server tracks expectedAudioSequence
    // for the entire session duration. Resetting to 0 causes all post-restart chunks to be
    // rejected as duplicates (seq 0 < server's accumulated expectedAudioSequence).
    // sequenceNumberRef continues from wherever it left off.
    speechEndSentRef.current = true; // Prevent speech_end until first chunk is sent
    // Grace period: prevent speech_end from firing immediately after restart.
    // The new MediaRecorder emits its EBML header as the very first chunk (~1s).
    // If we set lastSpeechTimeRef = Date.now(), a 500ms pause triggers speech_end
    // before a second chunk arrives, causing Lambda to process only the EBML header
    // chunk and then DELETE it. Subsequent chunks then start without an EBML header
    // and Lambda rejects them with "First chunk does not have EBML header".
    // By adding 2000ms, speech_end cannot fire until at least 2s after restart,
    // ensuring chunk-N (EBML) and chunk-N+1 are both in S3 before any processing.
    lastSpeechTimeRef.current = Date.now() + 2000;
    speechStartTimeRef.current = null; // Reset speech start tracking

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
        // IMPORTANT: Only send chunks after speech is detected (speechEndSentRef === false)
        // OR if speech detection is bypassed (for testing environments)
        if (enableRealtime && onAudioChunk) {
          if (!speechEndSentRef.current || bypassSpeechDetection) {
            // Phase 1.6.1: Generate unique chunkId for ACK tracking
            const chunkId = `audio-${sequence}-${timestamp}`;

            // Send chunks with ACK tracking and automatic retry
            sendChunkWithRetry(event.data, timestamp, sequence, chunkId);
          } else {
            logger.debug(
              LogPhase.RECORDING,
              'Skipping chunk transmission (waiting for speech detection)',
              {
                sequence,
                size: event.data.size,
              }
            );
          }
        }

        // Increment sequence number for ALL chunks (not just sent ones)
        // This prevents restart chunks from being treated as sequence 0
        sequenceNumberRef.current++;
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
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }
    };

    // Start new recorder
    mediaRecorderRef.current = newRecorder;
    if (timesliceMs) {
      newRecorder.start(timesliceMs);
    } else {
      newRecorder.start();
    }

    // Restart the audio level interval for the new recorder.
    // The rAF loop (monitorAudioLevel) continues uninterrupted since it uses
    // the shared analyserRef. We only need to re-establish the setState interval.
    audioLevelIntervalRef.current = setInterval(() => {
      setAudioLevel(audioLevelRef.current);
    }, 100);

    logger.logRestartPhase3Started(newRecorder.state);
  }, [enableRealtime, onAudioChunk, onError, onRecordingComplete, logger]);

  // ============================================================
  // Monitor Audio Level - Uses restartRecording defined above
  // ============================================================
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume (0-1) and store in ref only — no setState in rAF loop
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = average / 255;
    audioLevelRef.current = normalizedLevel;

    // Silence detection and low volume warning
    if (enableRealtime) {
      const now = Date.now();

      // Low volume warning (very low audio level for extended period)
      // Skip LOW_VOLUME check when AI is responding (user is expected to be silent)
      const isAiResponding = isAiRespondingRef?.current ?? false;
      if (!isAiResponding && normalizedLevel < LOW_VOLUME_THRESHOLD) {
        if (!lowVolumeStartRef.current) {
          lowVolumeStartRef.current = now;
        } else {
          const lowVolumeDuration = now - lowVolumeStartRef.current;
          if (lowVolumeDuration >= LOW_VOLUME_DURATION && !lowVolumeWarningShownRef.current) {
            logger.warn(LogPhase.RECORDING, 'Low volume detected', {
              level: normalizedLevel.toFixed(4),
              duration: lowVolumeDuration,
              isAiResponding, // Log current AI responding state
            });
            lowVolumeWarningShownRef.current = true;
            const lowVolumeError = new Error('LOW_VOLUME');
            (lowVolumeError as any).code = 'LOW_VOLUME';
            onError?.(lowVolumeError);
          }
        }
      } else {
        // Reset low volume detection when normal audio is detected or AI is responding
        if (lowVolumeStartRef.current) {
          lowVolumeStartRef.current = null;
          lowVolumeWarningShownRef.current = false;
        }
      }

      // Speech/silence detection
      // Use higher threshold for speech start detection to avoid ambient noise
      const speechDetectionThreshold = speechEndSentRef.current
        ? SPEECH_START_THRESHOLD
        : silenceThreshold;

      if (normalizedLevel > speechDetectionThreshold) {
        // Speech detected
        lastSpeechTimeRef.current = now;

        if (speechEndSentRef.current) {
          // Track when continuous speech started
          if (speechStartTimeRef.current === null) {
            speechStartTimeRef.current = now;
            logger.debug(
              LogPhase.RECORDING,
              'Potential speech detected - waiting for confirmation',
              {
                level: normalizedLevel.toFixed(3),
                threshold: speechDetectionThreshold,
                minDuration: MINIMUM_SPEECH_DURATION,
              }
            );
          } else {
            // Check if speech has continued for minimum duration
            const speechDuration = now - speechStartTimeRef.current;
            if (speechDuration >= MINIMUM_SPEECH_DURATION) {
              // Guard: the AudioContext analyser sees raw (pre-echo-cancel) audio, so it
              // picks up AI TTS playback reflected in the microphone and treats it as
              // "confirmed speech".  The MediaRecorder, however, applies echo cancellation
              // and captures near-silence.  Restarting during AI response would produce a
              // turn whose S3 chunks start with ~8 seconds of silence, causing Azure STT
              // to return InitialSilenceTimeout even though the user spoke later.
              //
              // Solution: when the AI is currently responding, discard the speech sample
              // and wait until the AI finishes before allowing a restart.  The recorder
              // Rn+1 created by the session player after the previous speech_end will
              // keep running silently until the user's real speech is confirmed post-AI.
              const isAiResponding = isAiRespondingRef?.current ?? false;
              if (isAiResponding) {
                logger.info(
                  LogPhase.RECORDING,
                  'Confirmed speech during AI response — triggering barge-in',
                  {
                    level: normalizedLevel.toFixed(3),
                    speechDuration,
                    currentSequence: sequenceNumberRef.current,
                  }
                );
                // Notify caller to stop AI audio playback (barge-in)
                onBargeIn?.();
                // Restart recorder immediately to capture user's barge-in speech
                restartRecording();
                speechEndSentRef.current = false; // enable chunk transmission
                speechStartTimeRef.current = null;
              } else {
                // Confirmed real speech - RESTART to get fresh EBML header
                logger.info(
                  LogPhase.RECORDING,
                  'Confirmed speech detected - restarting recorder for fresh EBML header',
                  {
                    level: normalizedLevel.toFixed(3),
                    threshold: speechDetectionThreshold,
                    speechDuration,
                    currentSequence: sequenceNumberRef.current,
                  }
                );

                // CRITICAL: Restart recorder to ensure sequence 0 with EBML header
                restartRecording();

                // Enable chunk transmission after restart
                // Note: restartRecording() sets speechEndSentRef = true in Phase 2,
                // so we override it here to enable transmission
                speechEndSentRef.current = false;

                // Reset speech start tracking
                speechStartTimeRef.current = null;
              }
            }
          }
        } else {
          // Continue logging during active speech
          logger.logAudioLevel(normalizedLevel, silenceThreshold);
          speechStartTimeRef.current = null; // Reset when already transmitting
        }
      } else {
        // Silence detected
        const silenceDurationMs = now - lastSpeechTimeRef.current;

        // Reset speech start tracking if we're in silence
        speechStartTimeRef.current = null;

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
  }, [enableRealtime, silenceThreshold, silenceDuration, onSpeechEnd, onBargeIn, restartRecording, logger]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const error = new Error('BROWSER_NOT_SUPPORTED');
        logger.error(LogPhase.ERROR, 'getUserMedia not supported', {
          userAgent: navigator.userAgent,
        });
        setError(error.message);
        onError?.(error);
        throw error;
      }

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
          // IMPORTANT: Only send chunks after speech is detected (speechEndSentRef === false)
          // OR if speech detection is bypassed (for testing environments)
          if (enableRealtime && onAudioChunk) {
            if (!speechEndSentRef.current || bypassSpeechDetection) {
              // Phase 1.6.1: Generate unique chunkId for ACK tracking
              const chunkId = `audio-${sequence}-${timestamp}`;

              // Send chunks with ACK tracking and automatic retry
              sendChunkWithRetry(event.data, timestamp, sequence, chunkId);
            } else {
              logger.debug(
                LogPhase.RECORDING,
                'Skipping chunk transmission (waiting for speech detection)',
                {
                  sequence,
                  size: event.data.size,
                }
              );
            }
          }

          // Increment sequence number for ALL chunks (not just sent ones)
          // This prevents restart chunks from being treated as sequence 0
          sequenceNumberRef.current++;
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
        if (audioLevelIntervalRef.current) {
          clearInterval(audioLevelIntervalRef.current);
          audioLevelIntervalRef.current = null;
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
      speechEndSentRef.current = true; // Prevent speech_end until first chunk is sent
      lastSpeechTimeRef.current = Date.now(); // Reset speech timestamp
      speechStartTimeRef.current = null; // Reset speech start tracking

      // Log initialization
      logger.info(LogPhase.INIT, 'Recording initialized', {
        mimeType: actualMimeType,
        timeslice: timesliceMs || 0,
        silenceThreshold,
        silenceDuration,
        sampleRate: audioContext.sampleRate,
        recorderState: mediaRecorder.state,
      });

      // Start audio level monitoring (rAF loop writes to ref only)
      monitorAudioLevel();
      // Interval to push audioLevel into React state at ~10fps — decoupled from rAF
      if (audioLevelIntervalRef.current) clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = setInterval(() => {
        setAudioLevel(audioLevelRef.current);
      }, 100);
    } catch (err) {
      // Handle getUserMedia specific errors with detailed messages
      let errorCode = 'RECORDING_FAILED';
      let errorMessage = 'Failed to start recording';

      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            errorCode = 'MICROPHONE_PERMISSION_DENIED';
            errorMessage =
              'Microphone access was denied. Please allow microphone access in your browser settings.';
            break;
          case 'NotFoundError':
            errorCode = 'MICROPHONE_NOT_FOUND';
            errorMessage = 'No microphone found. Please connect a microphone and try again.';
            break;
          case 'NotReadableError':
            errorCode = 'MICROPHONE_NOT_READABLE';
            errorMessage =
              'Microphone is already in use by another application. Please close other apps using the microphone.';
            break;
          case 'OverconstrainedError':
            errorCode = 'MICROPHONE_CONSTRAINTS_ERROR';
            errorMessage =
              'Unable to satisfy audio constraints. Please try a different microphone.';
            break;
          case 'AbortError':
            errorCode = 'MICROPHONE_ABORT_ERROR';
            errorMessage = 'Microphone access was aborted. Please try again.';
            break;
          case 'SecurityError':
            errorCode = 'MICROPHONE_SECURITY_ERROR';
            errorMessage =
              'Microphone access is not allowed due to security restrictions. Please use HTTPS.';
            break;
          default:
            errorMessage = err.message || errorMessage;
        }
      } else if (err instanceof Error) {
        if (err.message === 'BROWSER_NOT_SUPPORTED') {
          errorCode = 'BROWSER_NOT_SUPPORTED';
          errorMessage =
            'Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.';
        } else {
          errorMessage = err.message;
        }
      }

      const error = new Error(errorMessage);
      (error as any).code = errorCode;

      logger.error(LogPhase.ERROR, `Failed to start recording: ${errorCode}`, {
        error: errorMessage,
        originalError: err instanceof Error ? err.message : String(err),
        errorName: err instanceof DOMException ? err.name : 'Unknown',
      });

      setError(errorMessage);
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

  return {
    isRecording,
    isPaused,
    error,
    audioLevel,
    audioStream: streamRef.current,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    restartRecording,
    handleChunkAck, // Phase 1.6.1: ACK handler
  };
}
