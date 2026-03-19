'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Session } from '@/lib/api/sessions';
import { Avatar } from '@/lib/api/avatars';
import { Scenario } from '@/lib/api/scenarios';
import { getOrganizationSettings } from '@/lib/api/settings';
import type { OrganizationSettings } from '@prance/shared';
import {
  useWebSocket,
  TranscriptMessage,
  AvatarResponseMessage,
  AudioResponseMessage,
  TTSAudioChunkMessage,
  ProcessingUpdateMessage,
  SessionCompleteMessage,
  ErrorMessage,
} from '@/hooks/useWebSocket';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useVideoRecorder } from '@/hooks/useVideoRecorder';
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useSilenceTimer } from '@/hooks/useSilenceTimer';
import { checkBrowserCapabilities, getRecommendedBrowserMessage } from '@/lib/browser-check';
import { VideoComposer } from './video-composer';
import { WaveformDisplay } from '@/components/audio-visualizer/WaveformDisplay';
import { ProcessingIndicator, ProcessingStage } from './ProcessingIndicator';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { toast } from 'sonner';

type SessionPlayerStatus = 'IDLE' | 'READY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

interface SessionPlayerProps {
  session: Session;
  avatar: Avatar;
  scenario: Scenario;
}

interface TranscriptItem {
  id: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestamp: number;
  partial?: boolean;
}

export function SessionPlayer({ session, avatar, scenario }: SessionPlayerProps) {
  const { t } = useI18n();
  const { getErrorMessage, getMicrophoneInstructions } = useErrorMessage();
  const [status, setStatus] = useState<SessionPlayerStatus>('IDLE');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const isPlayingAudioRef = useRef(false); // Ref for real-time access in callbacks
  const [pendingSessionEnd, setPendingSessionEnd] = useState(false);
  const [shouldSendSessionEnd, setShouldSendSessionEnd] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [ariaLiveMessage, setAriaLiveMessage] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Silence management state
  const [initialGreetingCompleted, setInitialGreetingCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Organization settings for fallback values
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const speechEndQueueRef = useRef<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

  // Timeout detection
  const processingStartTimeRef = useRef<number | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const PROCESSING_TIMEOUT_MS = 30000; // 30 seconds

  // 録画機能用のref
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null); // VideoComposerから受け取ったcanvasを保持（useVideoRecorderに渡す）

  // WebSocket value refs (to break circular dependencies)
  const isConnectedRef = useRef<boolean>(false);
  const isAuthenticatedRef = useRef<boolean>(false);
  const sendMessageRef = useRef<((message: Record<string, unknown>) => void) | null>(null);
  const sendSpeechEndRef = useRef<(() => void) | null>(null);
  // REMOVED: sendAudioDataRef - Dual audio flow unification (2026-03-12)
  const sendVideoChunkRef = useRef<((chunk: Blob, timestamp: number) => Promise<void>) | null>(
    null
  );
  const endSessionRef = useRef<(() => void) | null>(null);
  const restartRecordingRef = useRef<(() => void) | null>(null);
  const isMicRecordingRef = useRef<boolean>(false);

  // トークン取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('accessToken');
      setToken(accessToken);
    }
  }, []);

  // Silence timeout handler with 500ms grace period
  const handleSilenceTimeout = useCallback(() => {
    console.log('[SessionPlayer] Silence timeout detected, checking conditions...');

    // Implement 500ms grace period with final check
    setTimeout(() => {
      // Final check: ensure AI is not playing and user is not speaking
      if (isPlayingAudio) {
        console.log('[SessionPlayer] Silence timeout canceled: AI is playing audio');
        return;
      }

      if (isMicRecordingRef.current) {
        console.log('[SessionPlayer] Silence timeout canceled: User is speaking');
        return;
      }

      if (isProcessing) {
        console.log('[SessionPlayer] Silence timeout canceled: Processing speech_end');
        return;
      }

      if (!isConnectedRef.current || !isAuthenticatedRef.current) {
        console.log('[SessionPlayer] Silence timeout canceled: Not connected or authenticated');
        return;
      }

      // All checks passed, send silence_prompt_request
      console.log('[SessionPlayer] Sending silence_prompt_request');
      if (sendMessageRef.current) {
        sendMessageRef.current({
          type: 'silence_prompt_request',
          timestamp: Date.now(),
        });
      }
    }, 500); // 500ms grace period
  }, [isPlayingAudio, isProcessing]);

  // Memoize callbacks to prevent unnecessary re-renders
  const handleTranscript = useCallback(
    (message: TranscriptMessage) => {
      // リアルタイム文字起こし
      if (message.type === 'transcript_partial') {
        // 部分的なトランスクリプト（リアルタイム更新）
        setTranscript(prev => {
          const lastItem = prev[prev.length - 1];
          if (lastItem && lastItem.partial && lastItem.speaker === message.speaker) {
            // 既存の部分トランスクリプトを更新
            return [
              ...prev.slice(0, -1),
              {
                ...lastItem,
                text: message.text,
                timestamp: message.timestamp || Date.now(),
              },
            ];
          } else {
            // 新しい部分トランスクリプトを追加
            return [
              ...prev,
              {
                id: `partial-${Date.now()}`,
                speaker: message.speaker,
                text: message.text,
                timestamp: message.timestamp || Date.now(),
                partial: true,
              },
            ];
          }
        });
      } else if (message.type === 'transcript_final') {
        // 確定トランスクリプト
        setTranscript(prev => {
          const filtered = prev.filter(item => !item.partial || item.speaker !== message.speaker);
          return [
            ...filtered,
            {
              id: `final-${Date.now()}`,
              speaker: message.speaker,
              text: message.text,
              timestamp: message.timestamp_start || Date.now(),
              partial: false,
            },
          ];
        });

        // STT complete, check if session was stopped by user
        if (message.speaker === 'USER') {
          if (pendingSessionEnd) {
            // セッション停止後の文字起こし - AI処理はスキップ
            console.log(
              '[SessionPlayer] Transcript received after session stop, sending session_end'
            );
            setIsProcessing(false);
            setProcessingStage('idle');
            setProcessingMessage('');

            // Send session_end immediately
            if (isConnectedRef.current && endSessionRef.current) {
              endSessionRef.current();
            }
            return;
          }

          // 通常のフロー: AI処理に進む
          setProcessingStage('ai');
          setProcessingMessage('');
          // Reset isProcessing flag - speech_end processing is complete
          setIsProcessing(false);
          console.log('[SessionPlayer] speech_end processing complete, silence timer can resume');
        }

        // If session end is pending, trigger it now after receiving transcript
        if (pendingSessionEnd && message.speaker === 'USER') {
          console.log('[SessionPlayer] Transcript received, will send session_end');
          setPendingSessionEnd(false);
          setShouldSendSessionEnd(true);
        }
      }
    },
    [pendingSessionEnd]
  );

  const handleAvatarResponse = useCallback(
    (message: AvatarResponseMessage) => {
      // AIアバターの応答
      if (message.type === 'avatar_response_partial') {
        // Partial AI response - update transcript
        setTranscript(prev => {
          const lastItem = prev[prev.length - 1];
          if (lastItem && lastItem.partial && lastItem.speaker === 'AI') {
            // Update existing partial AI response
            return [
              ...prev.slice(0, -1),
              {
                ...lastItem,
                text: message.text,
                timestamp: message.timestamp,
              },
            ];
          } else {
            // Add new partial AI response
            return [
              ...prev,
              {
                id: `ai-partial-${Date.now()}`,
                speaker: 'AI',
                text: message.text,
                timestamp: message.timestamp,
                partial: true,
              },
            ];
          }
        });

        // AI response started, move to TTS stage
        setProcessingStage('tts');
        setProcessingMessage('');
      } else if (message.type === 'avatar_response_final') {
        // Final AI response
        setTranscript(prev => {
          const filtered = prev.filter(item => !item.partial || item.speaker !== 'AI');
          return [
            ...filtered,
            {
              id: `ai-${message.timestamp}`,
              speaker: 'AI',
              text: message.text,
              timestamp: message.timestamp,
              partial: false,
            },
          ];
        });

        // Clear processing timeout (AI response received successfully)
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }
        processingStartTimeRef.current = null;

        // Check if this is the initial greeting (first AI message)
        if (!initialGreetingCompleted) {
          console.log(
            '[SessionPlayer] Initial AI greeting completed, silence timer will start after audio playback'
          );
          // Note: We'll set initialGreetingCompleted=true when audio playback finishes
        }
      }
    },
    [initialGreetingCompleted]
  );

  const handleProcessingUpdate = useCallback(
    (message: ProcessingUpdateMessage) => {
      // 処理状況の更新（オプション：UI表示用）
      console.log('Processing:', message.stage, message.progress);

      // Start timeout detection
      if (!processingStartTimeRef.current) {
        processingStartTimeRef.current = Date.now();

        // Set timeout warning
        processingTimeoutRef.current = setTimeout(() => {
          const elapsed = Date.now() - (processingStartTimeRef.current || 0);
          if (elapsed >= PROCESSING_TIMEOUT_MS) {
            toast.warning(t('errors.api.timeout'), {
              duration: 5000,
            });
          }
        }, PROCESSING_TIMEOUT_MS);
      }
    },
    [t, PROCESSING_TIMEOUT_MS]
  );

  const handleSessionComplete = useCallback(
    (_message: SessionCompleteMessage) => {
      // セッション完了
      setStatus('COMPLETED');
      setIsAuthenticated(false);
      isAuthenticatedRef.current = false;
      toast.success(t('sessions.player.messages.sessionCompleted'));

      // Clear timeout
      if (sessionEndTimeoutRef.current) {
        clearTimeout(sessionEndTimeoutRef.current);
        sessionEndTimeoutRef.current = null;
      }

      // Now safe to disconnect WebSocket after all messages received
      setTimeout(() => {
        if (disconnectRef.current) {
          disconnectRef.current();
        }
      }, 1000);
    },
    [t]
  );

  // Phase 1.5: Handle TTS streaming chunks
  const handleTTSAudioChunk = useCallback((message: TTSAudioChunkMessage) => {
    console.log('[SessionPlayer] TTS audio chunk received:', {
      audioLength: message.audio?.length || 0,
      isFinal: message.isFinal,
      timestamp: message.timestamp,
    });

    // For now, we'll wait for the final audio_response message with the complete audio URL
    // Real-time streaming playback would require MediaSource API or Web Audio API
    // This is a placeholder for future implementation
  }, []);

  const handleAudioResponse = useCallback(
    (message: AudioResponseMessage) => {
      // セッション停止後は音声再生をスキップ（UX改善）
      if (pendingSessionEnd) {
        console.log('[SessionPlayer] Session stopped by user, skipping AI audio response');
        // セッション終了処理を続行
        if (isConnectedRef.current && endSessionRef.current) {
          endSessionRef.current();
        }
        return;
      }

      // AI音声レスポンスを再生
      try {
        let audioUrl: string;
        let needsCleanup = false;

        console.log('[SessionPlayer] Audio response received:', {
          contentType: message.contentType,
          hasAudioUrl: !!message.audioUrl,
          hasAudioData: !!message.audio,
        });

        // Check if audio URL is provided (new format)
        if (message.audioUrl) {
          // Use S3 URL directly
          audioUrl = message.audioUrl;
          console.log('[SessionPlayer] Using audio URL:', audioUrl);
        } else if (message.audio) {
          // Fallback to base64 decoding (backward compatibility)
          const audioData = atob(message.audio);
          const arrayBuffer = new ArrayBuffer(audioData.length);
          const view = new Uint8Array(arrayBuffer);
          for (let i = 0; i < audioData.length; i++) {
            view[i] = audioData.charCodeAt(i);
          }

          // Create blob
          const blob = new Blob([arrayBuffer], { type: message.contentType });
          audioUrl = URL.createObjectURL(blob);
          needsCleanup = true;
          console.log('[SessionPlayer] Using base64 audio data');
        } else {
          throw new Error('No audio data or URL provided');
        }

        // Use existing audio element (initialized during handleStart for autoplay unlock)
        if (!audioRef.current) {
          audioRef.current = new Audio();
          console.log('[SessionPlayer] Created new Audio element (fallback)');
        }

        // CRITICAL FIX: Ensure audio is unmuted and audible
        audioRef.current.volume = 1.0;
        audioRef.current.muted = false;
        audioRef.current.preload = 'auto';

        console.log('[SessionPlayer] Audio element configured:', {
          volume: audioRef.current.volume,
          muted: audioRef.current.muted,
          preload: audioRef.current.preload,
        });

        // Setting src will automatically stop any previous audio
        audioRef.current.src = audioUrl;

        // Enhanced audio event logging
        audioRef.current.onloadedmetadata = () => {
          console.log('[SessionPlayer] Audio metadata loaded:', {
            duration: audioRef.current?.duration,
            src: audioUrl.substring(0, 100),
          });
        };

        audioRef.current.oncanplaythrough = () => {
          console.log('[SessionPlayer] Audio can play through');
        };

        audioRef.current.onplay = () => {
          setIsPlayingAudio(true);
          isPlayingAudioRef.current = true; // Update ref
          // TTS complete, audio playback started - return to idle
          setProcessingStage('idle');
          setProcessingMessage('');
          console.log('[SessionPlayer] Audio playback started:', {
            volume: audioRef.current?.volume,
            muted: audioRef.current?.muted,
            paused: audioRef.current?.paused,
            readyState: audioRef.current?.readyState,
          });
        };

        audioRef.current.onended = () => {
          setIsPlayingAudio(false);
          isPlayingAudioRef.current = false; // Update ref
          if (needsCleanup) {
            URL.revokeObjectURL(audioUrl);
          }
          console.log('[SessionPlayer] Audio playback ended');

          // Mark initial greeting as complete when first AI audio finishes
          if (!initialGreetingCompleted) {
            setInitialGreetingCompleted(true);
            console.log(
              '[SessionPlayer] Initial AI greeting audio complete, silence timer will now start'
            );
          }
        };

        audioRef.current.onerror = error => {
          setIsPlayingAudio(false);
          isPlayingAudioRef.current = false; // Update ref
          if (needsCleanup) {
            URL.revokeObjectURL(audioUrl);
          }
          console.error('[SessionPlayer] Audio playback error:', error);
          console.error('[SessionPlayer] Audio error details:', {
            error: audioRef.current?.error,
            networkState: audioRef.current?.networkState,
            readyState: audioRef.current?.readyState,
          });
          toast.error(t('sessions.player.messages.audioPlaybackError'));

          // Still mark initial greeting as complete even if audio playback fails
          if (!initialGreetingCompleted) {
            setInitialGreetingCompleted(true);
            console.log('[SessionPlayer] Initial greeting marked as complete (audio error)');
          }
        };

        // 再生開始
        console.log('[SessionPlayer] Attempting to play audio:', {
          src: audioUrl.substring(0, 100),
          readyState: audioRef.current.readyState,
        });

        audioRef.current.play().catch(error => {
          console.error('[SessionPlayer] Failed to play audio (Promise rejected):', error);
          console.error('[SessionPlayer] Error details:', {
            name: (error as Error).name,
            message: (error as Error).message,
            code: error.code,
          });
          toast.error(t('sessions.player.messages.audioPlaybackError'));
          setIsPlayingAudio(false);
          isPlayingAudioRef.current = false; // Update ref

          // Mark initial greeting as complete even if play() fails
          if (!initialGreetingCompleted) {
            setInitialGreetingCompleted(true);
            console.log('[SessionPlayer] Initial greeting marked as complete (play failed)');
          }
        });
      } catch (error) {
        console.error('[SessionPlayer] Failed to process audio response:', error);
        toast.error(t('sessions.player.messages.audioPlaybackError'));
      }
    },
    [t, initialGreetingCompleted]
  );

  const handleError = useCallback(
    (message: ErrorMessage) => {
      // Filter non-critical errors (user silence is normal during AI responses)
      const isNonCritical =
        message.code === 'NO_AUDIO_DATA' ||
        (message.code === 'AUDIO_PROCESSING_ERROR' &&
          (message.message?.includes('RMS level') ||
            message.message?.includes('No speech recognized')));

      if (isNonCritical) {
        console.warn('[SessionPlayer] Non-critical error (user silence):', message.code);
        // Reset processing flag to allow silence timer to resume
        setIsProcessing(false);
        setProcessingStage('idle');
        setProcessingMessage('');
        console.log('[SessionPlayer] Processing flags reset, silence timer can resume');
        return; // Don't show toast for expected silence
      }

      // Critical error - log and show to user
      console.error('[SessionPlayer] WebSocket critical error:', message);

      // Clear processing timeout
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
      processingStartTimeRef.current = null;

      // Get user-friendly error message
      const errorMessage = getErrorMessage({
        code: message.code || 'UNKNOWN_ERROR',
        message: message.message,
        originalError: message.details as string,
      });

      toast.error(errorMessage, {
        duration: 8000,
        action: message.code?.includes('MICROPHONE')
          ? {
              label: t('errors.actions.viewDetails'),
              onClick: () => {
                const instructions = getMicrophoneInstructions();
                toast.info(instructions, { duration: 12000 });
              },
            }
          : undefined,
      });
    },
    [getErrorMessage, getMicrophoneInstructions, t]
  );

  const handleNoSpeechDetected = useCallback(
    (_message: { message: string; timestamp: number }) => {
      // Not an error - just guidance for user
      console.log('[SessionPlayer] No speech detected - providing user guidance');

      // Reset processing flag
      setIsProcessing(false);
      setProcessingStage('idle');
      setProcessingMessage('');

      // Show user-friendly guidance message
      const guidanceMessage = t('sessions.player.noSpeech.guidance', {
        defaultValue: 'No speech detected. Please speak louder or move closer to your microphone.',
      });

      toast.warning(guidanceMessage, {
        duration: 6000,
        action: {
          label: t('sessions.player.noSpeech.showTips', { defaultValue: 'Show Tips' }),
          onClick: () => {
            const tips = [
              t('sessions.player.noSpeech.tip1', {
                defaultValue: '• Speak louder and more clearly',
              }),
              t('sessions.player.noSpeech.tip2', {
                defaultValue: '• Move closer to your microphone (10-20cm)',
              }),
              t('sessions.player.noSpeech.tip3', {
                defaultValue: '• Check your microphone volume settings',
              }),
              t('sessions.player.noSpeech.tip4', {
                defaultValue: '• Ensure your microphone is not muted',
              }),
            ].join('\n');
            toast.info(tips, { duration: 10000 });
          },
        },
      });
    },
    [t]
  );

  const handleAuthenticated = useCallback(
    (sessionId: string, receivedInitialGreeting?: string) => {
      console.log('[SessionPlayer] WebSocket authenticated:', {
        sessionId,
        hasInitialGreeting: !!receivedInitialGreeting,
      });
      setIsAuthenticated(true);
      isAuthenticatedRef.current = true;

      // If initial greeting is provided, Lambda will automatically:
      // 1. Send avatar_response_final (transcript will be added by handleAvatarResponse)
      // 2. Generate TTS and send audio_response (audio will play automatically)
      // 3. When audio finishes, initialGreetingCompleted will be set to true
      if (receivedInitialGreeting) {
        console.log('[SessionPlayer] Initial greeting configured:', {
          text: receivedInitialGreeting.substring(0, 50) + '...',
          note: 'Lambda will send avatar_response_final and audio_response automatically',
        });
      } else {
        // No initial greeting - start silence timer immediately
        console.log('[SessionPlayer] No initial greeting - silence timer will start immediately');
        setInitialGreetingCompleted(true);
      }

      toast.success(t('sessions.player.messages.authenticated'));
    },
    [t]
  );

  // WebSocket統合
  const {
    isConnected,
    isConnecting,
    error: wsError,
    connect,
    disconnect,
    sendMessage,
    sendUserSpeech,
    sendSpeechEnd,
    // sendAudioData, // REMOVED: Dual audio flow unification (2026-03-12)
    sendVideoChunk,
    endSession,
  } = useWebSocket({
    sessionId: session.id,
    token: token || '',
    scenarioPrompt: (scenario.configJson as any)?.systemPrompt, // Extract system prompt from scenario config
    scenarioLanguage: scenario.language,
    initialGreeting: scenario.initialGreeting ?? undefined, // Initial AI greeting from scenario (null → undefined)
    silenceTimeout: scenario.silenceTimeout ?? undefined, // Silence timeout in seconds (Azure STT)
    silencePromptTimeout: scenario.silencePromptTimeout ?? 15, // AI silence prompt timeout (frontend timer)
    enableSilencePrompt: scenario.enableSilencePrompt ?? undefined, // Enable silence prompt flag (null → undefined)
    silenceThreshold: scenario.silenceThreshold ?? undefined, // Audio level threshold to detect speech vs silence
    minSilenceDuration: scenario.minSilenceDuration ?? undefined, // Minimum silence duration to trigger speech_end
    autoConnect: false,
    onTranscript: handleTranscript,
    onAvatarResponse: handleAvatarResponse,
    onAudioResponse: handleAudioResponse,
    onAudioChunk: handleTTSAudioChunk, // Phase 1.5: Real-time TTS streaming
    onProcessingUpdate: handleProcessingUpdate,
    onSessionComplete: handleSessionComplete,
    onError: handleError,
    onNoSpeechDetected: handleNoSpeechDetected, // New: No speech detected guidance
    onAuthenticated: handleAuthenticated,
  });

  // Sync WebSocket values to refs (to break circular dependencies)
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // Load organization settings on mount for fallback values
  useEffect(() => {
    const loadOrgSettings = async () => {
      try {
        const settings = await getOrganizationSettings();
        setOrgSettings(settings);
        console.log('[SessionPlayer] Organization settings loaded:', {
          showSilenceTimer: settings.showSilenceTimer,
          enableSilencePrompt: settings.enableSilencePrompt,
          silenceTimeout: settings.silenceTimeout,
        });
      } catch (error) {
        console.error('[SessionPlayer] Failed to load organization settings:', error);
        // Continue with default values if settings fail to load
      }
    };

    // Load settings once on mount
    // Settings are resolved at session start and don't change during the session
    loadOrgSettings();
  }, []); // Run once on mount

  useEffect(() => {
    sendSpeechEndRef.current = sendSpeechEnd;
  }, [sendSpeechEnd]);

  // REMOVED: sendAudioDataRef useEffect - Dual audio flow unification (2026-03-12)

  useEffect(() => {
    sendVideoChunkRef.current = sendVideoChunk;
  }, [sendVideoChunk]);

  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  // Store disconnect function in ref for use in callbacks
  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  // Handle session end after transcript is received
  useEffect(() => {
    if (shouldSendSessionEnd && isConnected) {
      console.log('[SessionPlayer] Sending session_end after transcript');
      setShouldSendSessionEnd(false);

      // Small delay to ensure transcript is rendered
      setTimeout(() => {
        endSession();

        // Set timeout to disconnect after 30 seconds if no session_complete received
        if (sessionEndTimeoutRef.current) {
          clearTimeout(sessionEndTimeoutRef.current);
        }
        sessionEndTimeoutRef.current = setTimeout(() => {
          console.log('[SessionPlayer] Session end timeout - disconnecting WebSocket');
          if (disconnectRef.current) {
            disconnectRef.current();
          }
        }, 30000); // 30 seconds timeout

        toast.info(t('sessions.player.messages.processingComplete'));
      }, 100);
    }
  }, [shouldSendSessionEnd, isConnected, endSession, t]);

  // Audio Recorder統合
  const handleAudioChunk = useCallback(
    async (chunk: Blob, timestamp: number, sequenceNumber: number) => {
      console.log('[SessionPlayer] handleAudioChunk called (real-time mode):', {
        chunkSize: chunk.size,
        chunkType: chunk.type,
        timestamp,
        sequenceNumber,
        isConnected,
        status,
      });

      // Send audio chunk in real-time via WebSocket
      if (isConnectedRef.current && isAuthenticatedRef.current && sendMessageRef.current) {
        try {
          // Convert chunk to ArrayBuffer and send as Base64
          const arrayBuffer = await chunk.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);

          // Convert to Base64
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]!);
          }
          const base64 = btoa(binary);

          // Send via WebSocket
          sendMessageRef.current({
            type: 'audio_chunk_realtime',
            data: base64,
            timestamp,
            sequenceNumber,
            contentType: chunk.type,
          });

          console.log('[SessionPlayer] Real-time audio chunk sent:', {
            sequenceNumber,
            size: chunk.size,
            base64Length: base64.length,
          });
        } catch (error) {
          console.error('[SessionPlayer] Failed to send real-time audio chunk:', error);
        }
      }
    },
    [isConnected, status]
  );

  const handleSpeechEnd = useCallback(() => {
    console.log('[SessionPlayer] Speech end detected (silence)');

    // Implement speech_end queueing to prevent duplicate processing
    if (speechEndQueueRef.current) {
      console.log('[SessionPlayer] speech_end already queued, skipping duplicate');
      return;
    }

    // Send speech_end signal via WebSocket
    if (isConnectedRef.current && sendSpeechEndRef.current) {
      // Set queue flag and processing flag
      speechEndQueueRef.current = true;
      setIsProcessing(true);
      console.log('[SessionPlayer] speech_end processing started, silence timer will stop');

      sendSpeechEndRef.current();
      console.log('[SessionPlayer] speech_end signal sent');

      // Set processing stage to STT
      setProcessingStage('stt');
      setProcessingMessage('');

      toast.info(t('sessions.player.messages.processingAudio'));

      // Reset queue flag after a short delay (allows transcript to arrive)
      setTimeout(() => {
        speechEndQueueRef.current = false;
        console.log('[SessionPlayer] speech_end queue cleared');
      }, 2000);

      // CRITICAL: Restart MediaRecorder to generate new EBML header
      // MediaRecorder timeslice mode only creates complete header for first chunk
      // Subsequent chunks are fragments, so we must restart for each speech segment
      if (restartRecordingRef.current) {
        restartRecordingRef.current();
        console.log('[SessionPlayer] MediaRecorder restarted for next speech segment');
      }
    }
  }, [t]);

  const handleRecordingError = useCallback(
    (error: Error) => {
      console.error('[SessionPlayer] Recording error:', error);

      // Handle LOW_VOLUME warning (show as warning, not critical error)
      if ((error as any).code === 'LOW_VOLUME') {
        console.warn('[SessionPlayer] Low volume detected - showing user guidance');
        toast.warning(t('sessions.player.messages.lowVolumeWarning'), {
          duration: 8000,
          action: {
            label: t('sessions.player.noSpeech.showTips'),
            onClick: () => {
              const instructions = getMicrophoneInstructions();
              toast.info(instructions, { duration: 15000 });
            },
          },
        });
        return; // Don't show as error
      }

      // Get user-friendly error message
      const errorMessage = getErrorMessage(error);

      toast.error(errorMessage, {
        duration: 10000,
        action: (error as any).code?.includes('MICROPHONE')
          ? {
              label: t('errors.actions.viewDetails'),
              onClick: () => {
                const instructions = getMicrophoneInstructions();
                toast.info(instructions, { duration: 15000 });
              },
            }
          : undefined,
      });
    },
    [t, getErrorMessage, getMicrophoneInstructions]
  );

  const handleRecordingComplete = useCallback(async (audioBlob: Blob) => {
    // Recording complete - リアルタイム方式では使用しない
    // (音声処理はリアルタイムチャンク + speech_end で完結)
    console.log('[SessionPlayer] Recording complete (audio processed via real-time chunks):', {
      size: audioBlob.size,
      type: audioBlob.type,
    });

    // Note: 完全音声データ方式（audio_data_part）は削除済み
    // リアルタイムチャンク方式（audio_chunk_realtime + speech_end）のみ使用
  }, []);

  const {
    isRecording: isMicRecording,
    audioLevel,
    audioStream,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    restartRecording,
    error: recordingError,
  } = useAudioRecorder({
    enableRealtime: true, // Enable real-time audio chunk sending
    onAudioChunk: handleAudioChunk, // Real-time chunk callback
    onSpeechEnd: handleSpeechEnd, // Silence detection callback
    onRecordingComplete: handleRecordingComplete, // Still keep for complete recording
    onError: handleRecordingError,
    silenceThreshold: scenario.silenceThreshold ?? 0.12, // Use scenario setting or default 0.12 (raised to avoid ambient noise ~10%)
    silenceDuration: scenario.minSilenceDuration ?? 1000, // Use scenario setting or default 1000ms (increased from 500ms to avoid cutting off mid-speech)
    isAiRespondingRef: isPlayingAudioRef, // Ref for real-time AI audio state (fixes closure issue)
  });

  // Audio Visualizer統合
  const {
    audioLevel: visualizerAudioLevel,
    isActive: isVisualizerActive,
    startVisualizer,
    stopVisualizer,
    getWaveformData,
  } = useAudioVisualizer({
    fftSize: 256,
    smoothingTimeConstant: 0.8,
  });

  // 🔴 CRITICAL: Hierarchical resolution with DEFAULT_ORGANIZATION_SETTINGS
  // Priority: Scenario > Organization Settings > DEFAULT_ORGANIZATION_SETTINGS
  // Import from shared package to ensure consistency
  const DEFAULT_ORG_SETTINGS = {
    showSilenceTimer: true,
    silenceTimeout: 10,
    enableSilencePrompt: true,
    silenceThreshold: 0.12,
    minSilenceDuration: 1200, // ✅ FIXED: 500ms → 1200ms to avoid cutting off mid-speech (words have 200-500ms gaps)
    silencePromptTimeout: 15,
  };

  // Resolve enableSilencePrompt first (parent setting)
  const effectiveEnableSilencePrompt =
    scenario.enableSilencePrompt ??
    orgSettings?.enableSilencePrompt ??
    DEFAULT_ORG_SETTINGS.enableSilencePrompt;

  // 🔴 CRITICAL: showSilenceTimer depends on enableSilencePrompt (parent-child relationship)
  // If enableSilencePrompt is false at org level, showSilenceTimer should be forced to false
  // Logic: No silence detection -> No need to show timer
  const effectiveShowSilenceTimer =
    scenario.showSilenceTimer ??
    (orgSettings?.enableSilencePrompt === false
      ? false // Parent setting disabled -> force child setting to false
      : (orgSettings?.showSilenceTimer ?? DEFAULT_ORG_SETTINGS.showSilenceTimer));

  const effectiveSilenceTimeout =
    scenario.silenceTimeout ?? orgSettings?.silenceTimeout ?? DEFAULT_ORG_SETTINGS.silenceTimeout;

  // Resolve silencePromptTimeout (AI silence prompt timeout for frontend timer)
  const effectiveSilencePromptTimeout =
    scenario.silencePromptTimeout ??
    orgSettings?.silencePromptTimeout ??
    DEFAULT_ORG_SETTINGS.silencePromptTimeout;

  // Silence Timer統合
  const silenceTimerEnabled =
    status === 'ACTIVE' && initialGreetingCompleted && effectiveEnableSilencePrompt;

  // Debug log for silence timer conditions (DETAILED)
  useEffect(() => {
    console.log('[SessionPlayer] 🔍 Silence Timer Conditions (DETAILED):', {
      status,
      initialGreetingCompleted,
      effectiveEnableSilencePrompt,
      enabled: silenceTimerEnabled,
      'BLOCKING CONDITIONS': {
        isPlayingAudio,
        isMicRecording, // ← このフラグが true のままだとタイマーが動かない
        isProcessing,
      },
      effectiveSilencePromptTimeout,
      'TIMER SHOULD START':
        silenceTimerEnabled && !isPlayingAudio && !isMicRecording && !isProcessing,
    });
  }, [
    status,
    initialGreetingCompleted,
    effectiveEnableSilencePrompt,
    silenceTimerEnabled,
    isPlayingAudio,
    isMicRecording,
    isProcessing,
    effectiveSilencePromptTimeout,
  ]);

  const { elapsedTime: silenceElapsedTime, resetTimer: _resetSilenceTimer } = useSilenceTimer({
    enabled: silenceTimerEnabled,
    timeoutSeconds: effectiveSilencePromptTimeout,
    isAIPlaying: isPlayingAudio,
    isUserSpeaking: false, // ❌ FIXED: isMicRecording は常に true（マイクは常に録音中）
    // ユーザーが話しているかは useAudioRecorder が自動検出して speech_end 送信
    // 沈黙タイマーは AI再生中と処理中のみ停止すればよい
    isProcessing: isProcessing,
    onTimeout: handleSilenceTimeout,
  });

  // Store restartRecording in ref to avoid circular dependency
  useEffect(() => {
    restartRecordingRef.current = restartRecording;
  }, [restartRecording]);

  // Sync isMicRecording to ref for handleSilenceTimeout
  useEffect(() => {
    isMicRecordingRef.current = isMicRecording;
  }, [isMicRecording]);

  // Cleanup visualizer on unmount
  useEffect(() => {
    return () => {
      stopVisualizer();
    };
  }, [stopVisualizer]);

  // Update ARIA live region when status changes
  useEffect(() => {
    const statusMessages: Record<SessionPlayerStatus, string> = {
      IDLE: t('sessions.player.status.notStarted'),
      READY: t('sessions.player.status.ready'),
      ACTIVE: t('sessions.player.status.inProgress'),
      PAUSED: t('sessions.player.status.paused'),
      COMPLETED: t('sessions.player.status.completed'),
    };

    setAriaLiveMessage(statusMessages[status]);
  }, [status, t]);

  // Update ARIA live region when processing stage changes
  useEffect(() => {
    if (processingStage !== 'idle') {
      const processingMessages: Record<ProcessingStage, string> = {
        idle: '',
        stt: t('sessions.player.processing.stt'),
        ai: t('sessions.player.processing.ai'),
        tts: t('sessions.player.processing.tts'),
      };
      setAriaLiveMessage(processingMessages[processingStage]);
    }
  }, [processingStage, t]);

  // Session control handlers (defined before keyboard shortcuts useEffect)
  const handleStart = useCallback(async () => {
    console.log('[SessionPlayer] handleStart called', {
      token: token ? 'exists' : 'missing',
      status,
    });

    // Check browser capabilities
    const capabilities = checkBrowserCapabilities();
    if (!capabilities.isSupported) {
      console.error('[SessionPlayer] Browser not supported:', capabilities.unsupportedFeatures);
      const recommendedMsg = getRecommendedBrowserMessage();
      toast.error(`${t('errors.microphone.notSupported')}\n\n${recommendedMsg}`, {
        duration: 15000,
      });
      return;
    }

    if (!token) {
      console.error('[SessionPlayer] No token found!');
      toast.error(t('sessions.player.messages.authRequired'));
      return;
    }

    if (status === 'IDLE') {
      console.log('[SessionPlayer] Starting WebSocket connection...');

      // ユーザーカメラを取得
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false, // 音声は useAudioRecorder で取得済み
        });

        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
          await userVideoRef.current.play();
          setIsCameraActive(true);
          console.log('[SessionPlayer] User camera started');
        }
      } catch (error) {
        console.error('[SessionPlayer] Failed to get user camera:', error);
        toast.warning('カメラへのアクセスが拒否されました。録画機能は利用できません。');
      }

      // Start audio visualizer
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startVisualizer(audioStream);
        console.log('[SessionPlayer] Audio visualizer started');
      } catch (error) {
        console.error('[SessionPlayer] Failed to start audio visualizer:', error);
        // Non-critical error, continue without visualization
      }

      // Initialize audio element for AI responses (unlock autoplay policy)
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.volume = 1.0;
        audioRef.current.muted = false;
        console.log('[SessionPlayer] Audio element initialized for AI responses');
      }

      setStatus('READY');
      // WebSocket接続はuseEffectで自動的に開始される（重複呼び出しを防ぐため削除）
      toast.info(t('sessions.player.websocket.connecting'));
      // 接続完了後、useEffectで自動的にACTIVE状態に遷移
    } else if (status === 'PAUSED') {
      setStatus('ACTIVE');
      // セッション再開 + 音声録音再開 + ビデオ録画再開
      resumeRecording();

      // Restart audio visualizer
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startVisualizer(audioStream);
        console.log('[SessionPlayer] Audio visualizer restarted after pause');
      } catch (error) {
        console.error('[SessionPlayer] Failed to restart audio visualizer:', error);
        // Non-critical error, continue without visualization
      }

      if (recordingStatus === 'paused') {
        try {
          resumeVideoRecording();
        } catch (err) {
          console.error('[SessionPlayer] Failed to resume video recording:', err);
        }
      }
      toast.success(t('sessions.player.messages.sessionResumed'));
    }
  }, [token, status, t, startVisualizer, resumeRecording]);

  const handlePause = useCallback(() => {
    if (status === 'ACTIVE') {
      setStatus('PAUSED');
      // 音声録音一時停止 + ビデオ録画一時停止
      pauseRecording();
      // Stop visualizer during pause
      stopVisualizer();
      if (recordingStatus === 'recording') {
        try {
          pauseVideoRecording();
        } catch (err) {
          console.error('[SessionPlayer] Failed to pause video recording:', err);
        }
      }
      toast.info(t('sessions.player.status.paused'));
    }
  }, [status, pauseRecording, stopVisualizer, t]);

  const handleStop = useCallback(() => {
    if (status === 'ACTIVE' || status === 'PAUSED' || status === 'READY') {
      setStatus('COMPLETED');
      // Note: Do NOT reset isAuthenticated here - audio data needs to be sent first
      // It will be reset in handleSessionComplete() after all processing is done

      // Check if audio was being recorded
      const wasRecording = isMicRecording;

      // 1. Stop audio recording first
      stopRecording();

      // 2. Stop audio visualizer
      stopVisualizer();
      console.log('[SessionPlayer] Audio visualizer stopped');

      // 3. Stop video recording if active
      if (recordingStatus === 'recording' || recordingStatus === 'paused') {
        try {
          stopVideoRecording();
        } catch (err) {
          console.error('[SessionPlayer] Failed to stop video recording:', err);
        }
      }

      // 4. Stop user camera
      if (userVideoRef.current && userVideoRef.current.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('[SessionPlayer] Stopped camera track:', track.kind);
        });
        userVideoRef.current.srcObject = null;
        setIsCameraActive(false);
      }

      // 5. If audio was recording, send speech_end and wait for transcript before sending session_end
      if (wasRecording) {
        console.log(
          '[SessionPlayer] Audio was recording, sending speech_end and waiting for audio processing before session_end'
        );

        // Send speech_end to trigger backend STT processing
        if (isConnectedRef.current && sendSpeechEndRef.current) {
          sendSpeechEndRef.current();
          console.log('[SessionPlayer] speech_end signal sent (session stop)');
        }

        setPendingSessionEnd(true);
        setIsProcessing(true);
        setProcessingStage('stt');
        setProcessingMessage(t('sessions.player.processing.stt'));
        // session_end will be sent after transcript_final is received
      } else {
        // 5. Send session end notification immediately if no audio to process
        if (isConnectedRef.current && endSessionRef.current) {
          console.log('[SessionPlayer] No audio recorded, sending session_end immediately');
          endSessionRef.current();

          // 6. Set timeout to disconnect after 30 seconds if no session_complete received
          sessionEndTimeoutRef.current = setTimeout(() => {
            console.log('[SessionPlayer] Session end timeout - disconnecting WebSocket');
            if (disconnectRef.current) {
              disconnectRef.current();
            }
          }, 30000); // 30 seconds timeout
        }
      }

      toast.success(t('sessions.player.messages.sessionEnded'));
    }
  }, [status, isMicRecording, stopRecording, stopVisualizer, t]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case ' ': // Space
          event.preventDefault();
          if (status === 'IDLE' || status === 'PAUSED') {
            handleStart();
          } else if (status === 'ACTIVE' || status === 'READY') {
            handleStop();
          }
          break;

        case 'escape': // Escape
          event.preventDefault();
          if (status !== 'IDLE' && status !== 'COMPLETED') {
            handleStop();
          }
          break;

        case 'p': // P - Pause/Resume
          event.preventDefault();
          if (status === 'ACTIVE') {
            handlePause();
          } else if (status === 'PAUSED') {
            handleStart();
          }
          break;

        case 'm': // M - Mute/Unmute
          event.preventDefault();
          if (status === 'ACTIVE' || status === 'PAUSED') {
            setIsMuted(prev => {
              const newMuted = !prev;
              if (newMuted) {
                pauseRecording();
                toast.info(t('sessions.player.shortcuts.microphoneMuted'));
                setAriaLiveMessage(t('sessions.player.shortcuts.microphoneMuted'));
              } else {
                resumeRecording();
                toast.info(t('sessions.player.shortcuts.microphoneUnmuted'));
                setAriaLiveMessage(t('sessions.player.shortcuts.microphoneUnmuted'));
              }
              return newMuted;
            });
          }
          break;

        case '?': // ? - Show help
          event.preventDefault();
          // Help modal is handled by KeyboardShortcuts component
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [status, handleStart, handleStop, handlePause, pauseRecording, resumeRecording, t]);

  // ブラウザ/タブクローズ時のセッション終了処理
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only cleanup if session is active or paused
      if (status === 'ACTIVE' || status === 'PAUSED' || status === 'READY') {
        console.log('[SessionPlayer] Browser closing - triggering session cleanup');

        // Trigger session stop immediately
        handleStop();

        // Show browser confirmation dialog to give time for cleanup
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
    };

    const handleVisibilityChange = () => {
      // Backup cleanup when page becomes hidden (tab switch, minimize, etc.)
      if (document.visibilityState === 'hidden') {
        if (status === 'ACTIVE' || status === 'PAUSED') {
          console.log('[SessionPlayer] Page hidden - session still active');
          // Note: We don't auto-stop on visibility change, only on actual unload
          // This prevents stopping when user just switches tabs temporarily
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status, handleStop]);

  // 録画機能 - ビデオチャンクハンドラー
  const handleVideoChunk = useCallback(
    async (chunk: Blob, timestamp: number) => {
      // 認証完了後のみビデオチャンクを送信
      if (
        isConnectedRef.current &&
        isAuthenticated &&
        status === 'ACTIVE' &&
        sendVideoChunkRef.current
      ) {
        try {
          // WebSocketでビデオチャンク送信
          await sendVideoChunkRef.current(chunk, timestamp);
          console.log('[SessionPlayer] Video chunk sent:', {
            size: chunk.size,
            timestamp,
            type: chunk.type,
          });
        } catch (error) {
          console.error('[SessionPlayer] Failed to send video chunk:', error);
        }
      } else if (!isAuthenticated) {
        console.warn('[SessionPlayer] Skipping video chunk - not authenticated yet');
      }
    },
    [status, isAuthenticated]
  );

  const handleVideoRecordingComplete = useCallback(
    (blob: Blob) => {
      console.log('[SessionPlayer] Video recording complete:', {
        size: blob.size,
        type: blob.type,
        sizeInMB: (blob.size / 1024 / 1024).toFixed(2) + ' MB',
      });
      toast.success(t('sessions.player.recording.messages.stopped'));
    },
    [t]
  );

  const handleVideoRecordingError = useCallback(
    (error: Error) => {
      console.error('[SessionPlayer] Video recording error:', error);

      // Get user-friendly error message
      const errorMessage = getErrorMessage(error);

      toast.error(errorMessage, {
        duration: 8000,
        action: {
          label: t('errors.actions.retry'),
          onClick: () => {
            // Retry video recording
            if (startVideoRecording) {
              startVideoRecording();
            }
          },
        },
      });
    },
    [t, getErrorMessage]
  );

  // VideoComposer準備完了ハンドラー
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    // VideoComposerから受け取ったcanvasをrefに保存
    compositeCanvasRef.current = canvas;
    console.log('[SessionPlayer] Composite canvas ready:', {
      width: canvas.width,
      height: canvas.height,
    });
  }, []);

  // useVideoRecorder統合
  const {
    status: recordingStatus,
    startRecording: startVideoRecording,
    stopRecording: stopVideoRecording,
    pauseRecording: pauseVideoRecording,
    resumeRecording: resumeVideoRecording,
    duration: recordingDuration,
    error: videoRecordingError,
  } = useVideoRecorder({
    canvasRef: compositeCanvasRef,
    audioStream: audioStream, // マイク音声を含める
    onChunk: handleVideoChunk,
    onComplete: handleVideoRecordingComplete,
    onError: handleVideoRecordingError,
    chunkInterval: 1000, // 1秒ごと
  });

  // セッションが既に完了している場合のみ特別処理
  useEffect(() => {
    console.log('[SessionPlayer] Session status effect', {
      sessionStatus: session.status,
      playerStatus: status,
      token: token ? 'exists' : 'missing',
    });

    if (session.status === 'COMPLETED') {
      setStatus('COMPLETED');
      // Load existing transcript if available
      if (session.transcripts) {
        const items: TranscriptItem[] = session.transcripts.map(t => ({
          id: t.id,
          speaker: t.speaker,
          text: t.text,
          timestamp: t.timestampStart,
        }));
        setTranscript(items);
      }
    }
    // セッションがACTIVE状態でも、ユーザーが明示的に「Start」を押すまで自動接続しない
  }, [session, status]);

  // Auto-connect when status becomes READY and not yet connecting
  useEffect(() => {
    if (status === 'READY' && !isConnecting && !isConnected && token) {
      console.log('[SessionPlayer] Status is READY, initiating WebSocket connection...');
      connect();
    }
  }, [status, isConnecting, isConnected, token, connect]);

  // WebSocket接続完了 + 認証完了時にACTIVE状態に自動遷移 + 音声録音 + ビデオ録画開始
  useEffect(() => {
    if (isConnected && isAuthenticated && status === 'READY') {
      console.log('[SessionPlayer] Connection and authentication complete, starting session');
      setStatus('ACTIVE');
      toast.success(t('sessions.player.messages.sessionStarted'));

      // Start audio recording (critical - must succeed)
      startRecording().catch(err => {
        console.error('[SessionPlayer] Failed to start audio recording:', err);
        toast.error(t('sessions.player.messages.microphonePermissionDenied'));
      });

      // Start video recording (optional - failure should not affect audio)
      setTimeout(() => {
        if (compositeCanvasRef.current) {
          console.log('[SessionPlayer] Starting video recording...');
          startVideoRecording().catch(err => {
            console.error('[SessionPlayer] Failed to start video recording:', err);
            console.error('[SessionPlayer] Video recording error details:', err.message, err.stack);
            toast.warning('ビデオ録画の開始に失敗しました（音声は正常に動作します）');
          });
        } else {
          console.warn('[SessionPlayer] Composite canvas not ready, skipping video recording');
        }
      }, 100); // Small delay to ensure canvas is ready
    }
  }, [isConnected, isAuthenticated, status, t, startRecording, startVideoRecording]);

  // Connection timeout - 30秒以内に接続できない場合はタイムアウト
  useEffect(() => {
    if (status === 'READY' && !isConnected) {
      const timeoutId = setTimeout(() => {
        if (status === 'READY' && !isConnected) {
          console.error('[SessionPlayer] Connection timeout after 30 seconds');
          setStatus('IDLE');
          toast.error(t('sessions.player.messages.connectionTimeout'));
        }
      }, 30000); // 30 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [status, isConnected, t]);

  // Authentication timeout - 接続後5秒以内に認証が完了しない場合はタイムアウト
  useEffect(() => {
    if (isConnected && !isAuthenticated && status === 'READY') {
      const timeoutId = setTimeout(() => {
        if (isConnected && !isAuthenticated) {
          console.error('[SessionPlayer] Authentication timeout after 5 seconds');
          setStatus('IDLE');
          disconnect();
          toast.error(t('sessions.player.messages.authenticationTimeout'));
        }
      }, 5000); // 5 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [isConnected, isAuthenticated, status, disconnect, t]);

  // タイマー（セッション実行中）
  useEffect(() => {
    if (status === 'ACTIVE') {
      const interval = setInterval(() => {
        setCurrentTime(prev => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2)}:${secs.toString().padStart(2)}`;
  };

  const getStatusColor = (s: SessionPlayerStatus): string => {
    switch (s) {
      case 'IDLE':
        return 'text-gray-600';
      case 'READY':
        return 'text-blue-600';
      case 'ACTIVE':
        return 'text-green-600';
      case 'PAUSED':
        return 'text-yellow-600';
      case 'COMPLETED':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = (s: SessionPlayerStatus): string => {
    switch (s) {
      case 'IDLE':
        return t('sessions.player.status.notStarted');
      case 'READY':
        return t('sessions.player.status.ready');
      case 'ACTIVE':
        return t('sessions.player.status.inProgress');
      case 'PAUSED':
        return t('sessions.player.status.paused');
      case 'COMPLETED':
        return t('sessions.player.status.completed');
      default:
        return t('sessions.player.status.unknown');
    }
  };

  return (
    <div
      className="space-y-6"
      data-testid="session-player"
      role="main"
      aria-label={t('sessions.player.info.scenario') + ': ' + scenario.title}
    >
      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {ariaLiveMessage}
      </div>

      {/* ヘッダー */}
      <div
        className="bg-white rounded-lg shadow p-6"
        role="region"
        aria-label={t('sessions.player.details.title')}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{scenario.title}</h2>
            <p className="text-gray-600 mt-1">
              {t('sessions.player.info.avatar')}: <span className="font-medium">{avatar.name}</span>{' '}
              • {t('sessions.player.info.category')}:{' '}
              <span className="font-medium">{scenario.category}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <KeyboardShortcuts />

            {/* Silence Timer Display (if enabled) */}
            {effectiveShowSilenceTimer && status === 'ACTIVE' && initialGreetingCompleted && (
              <div
                className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 min-w-[120px]"
                data-testid="silence-timer"
              >
                <div className="text-xs text-indigo-600 font-medium uppercase tracking-wide">
                  {t('sessions.player.silenceTimer.label')}
                </div>
                <div className="text-xl font-mono font-bold text-indigo-900 mt-0.5">
                  {silenceElapsedTime}s / {effectiveSilenceTimeout}s
                </div>
              </div>
            )}

            <div className="text-right">
              <div
                className={`text-lg font-semibold ${getStatusColor(status)}`}
                data-testid="status-badge"
              >
                {getStatusText(status)}
                {isMuted && status === 'ACTIVE' && <span className="ml-2 text-red-600">🔇</span>}
              </div>
              <div
                className="text-2xl font-mono font-bold text-gray-900 mt-1"
                data-testid="session-duration"
              >
                {formatTime(currentTime)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側: アバター表示エリア */}
        <div
          className="bg-white rounded-lg shadow p-6"
          role="region"
          aria-label={t('sessions.player.avatar.title')}
        >
          <h3 className="text-lg font-semibold mb-4" id="avatar-section">
            {t('sessions.player.avatar.title')}
          </h3>
          <div className="aspect-video bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
            {avatar.thumbnailUrl ? (
              <img
                src={avatar.thumbnailUrl}
                alt={avatar.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4">👤</div>
                <p className="text-gray-500 font-medium">{avatar.name}</p>
                <p className="text-gray-400 text-sm mt-1">
                  {t('sessions.player.avatar.placeholder')}
                </p>
              </div>
            )}
          </div>

          {/* マイク・カメラステータス + 音声レベルインジケーター */}
          <div className="mt-4 space-y-3">
            {/* マイクステータス */}
            <div
              className="flex items-center justify-between text-sm"
              data-testid="microphone-indicator"
            >
              <div className="flex items-center text-gray-600">
                <svg
                  className={`w-4 h-4 mr-2 ${
                    isMuted ? 'text-gray-400' : isMicRecording ? 'text-red-500' : ''
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {isMuted ? (
                    // Muted microphone icon
                    <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" />
                  ) : (
                    // Normal microphone icon
                    <path
                      fillRule="evenodd"
                      d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
                <span>{t('sessions.player.avatar.microphone')}:</span>
              </div>
              <span
                className={`font-medium flex items-center gap-2 ${
                  isMuted ? 'text-gray-400' : isMicRecording ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                {isMuted ? (
                  <>
                    <span>🔇</span>
                    <span>Muted</span>
                  </>
                ) : isMicRecording ? (
                  t('sessions.player.avatar.recording')
                ) : (
                  t('sessions.player.avatar.inactive')
                )}
              </span>
            </div>

            {/* 音声レベルインジケーター */}
            {isMicRecording && !isMuted && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {t('sessions.player.avatar.audioLevel')}:
                </span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-100"
                    style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-10 text-right">
                  {Math.round(audioLevel * 100)}%
                </span>
              </div>
            )}

            {/* 音声波形表示 */}
            {isMicRecording && isVisualizerActive && !isMuted && (
              <div className="mt-2">
                <WaveformDisplay
                  waveformData={getWaveformData()}
                  audioLevel={visualizerAudioLevel}
                  isActive={isVisualizerActive}
                  height={60}
                  barWidth={3}
                  barGap={2}
                  activeColor="rgb(99, 102, 241)"
                  inactiveColor="rgb(209, 213, 219)"
                  className="w-full"
                />
              </div>
            )}

            {/* カメラステータス */}
            <div
              className="flex items-center justify-between text-sm text-gray-600"
              data-testid="camera-indicator"
            >
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <span>{t('sessions.player.avatar.camera')}:</span>
              </div>
              <span
                className={`font-medium ${isCameraActive ? 'text-green-600' : 'text-gray-500'}`}
              >
                {isCameraActive ? t('sessions.player.avatar.on') : t('sessions.player.avatar.off')}
              </span>
            </div>

            {/* 音声再生ステータス */}
            <div
              className="flex items-center justify-between text-sm"
              data-testid="speaker-indicator"
            >
              <div className="flex items-center text-gray-600">
                <svg
                  className={`w-4 h-4 mr-2 ${isPlayingAudio ? 'text-blue-500' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{t('sessions.player.avatar.speaker')}:</span>
              </div>
              <span className={`font-medium ${isPlayingAudio ? 'text-blue-600' : 'text-gray-500'}`}>
                {isPlayingAudio
                  ? t('sessions.player.avatar.playing')
                  : t('sessions.player.avatar.inactive')}
              </span>
            </div>

            {/* 録画ステータス */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center text-gray-600">
                <svg
                  className={`w-4 h-4 mr-2 ${
                    recordingStatus === 'recording' ? 'text-red-500 animate-pulse' : ''
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <circle cx="10" cy="10" r="8" />
                </svg>
                <span>{t('sessions.player.recording.title')}:</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-medium ${
                    recordingStatus === 'recording' ? 'text-red-600' : 'text-gray-500'
                  }`}
                >
                  {t(`sessions.player.recording.status.${recordingStatus}`)}
                </span>
                {recordingStatus === 'recording' && (
                  <span className="text-xs text-gray-500">
                    {t('sessions.player.recording.duration', {
                      duration: `${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2)}`,
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* レコーディングエラー表示 */}
            {recordingError && (
              <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                {recordingError}
              </div>
            )}

            {/* 録画エラー表示 */}
            {videoRecordingError && (
              <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                {videoRecordingError.message}
              </div>
            )}
          </div>
        </div>

        {/* 右側: トランスクリプト */}
        <div
          className="bg-white rounded-lg shadow p-6"
          role="region"
          aria-label={t('sessions.player.transcript.title')}
        >
          <h3 className="text-lg font-semibold mb-4" id="transcript-section">
            {t('sessions.player.transcript.title')}
          </h3>
          <div
            className="h-[400px] overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50"
            data-testid="transcript"
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-labelledby="transcript-section"
          >
            {transcript.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p>{t('sessions.player.transcript.empty')}</p>
                <p className="text-sm mt-2">{t('sessions.player.transcript.emptyDescription')}</p>
              </div>
            ) : (
              transcript.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg ${
                    item.speaker === 'AI'
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'bg-green-50 border border-green-200'
                  }`}
                  data-testid="transcript-message"
                  data-speaker={item.speaker}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">
                      {item.speaker === 'AI'
                        ? `🤖 ${avatar.name}`
                        : `👤 ${t('sessions.player.transcript.you')}`}
                    </span>
                    <span className="text-xs text-gray-500">{formatTime(item.timestamp)}</span>
                  </div>
                  <MarkdownRenderer content={item.text} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* WebSocket接続状態表示 */}
      {(isConnecting || isConnected || wsError) && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isConnecting && (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  <span className="text-sm text-gray-600">
                    {t('sessions.player.websocket.connectingWebSocket')}
                  </span>
                </>
              )}
              {isConnected && !isConnecting && (
                <>
                  <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-600 font-medium">
                    {t('sessions.player.websocket.connected')}
                  </span>
                </>
              )}
              {wsError && (
                <>
                  <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-red-600">
                    {wsError.startsWith('WEBSOCKET_RECONNECTING:')
                      ? (() => {
                          const [, attempt = '1', maxAttempts = '5'] = wsError.split(':');
                          return t('errors.websocket.reconnecting', { attempt, maxAttempts });
                        })()
                      : wsError.startsWith('WEBSOCKET_RECONNECT_FAILED:')
                        ? (() => {
                            const [, maxAttempts = '5'] = wsError.split(':');
                            return t('errors.websocket.reconnectFailed', { maxAttempts });
                          })()
                        : getErrorMessage(wsError)}
                  </span>
                </>
              )}
            </div>
            {status === 'ACTIVE' && isConnected && (
              <button
                onClick={() => {
                  // デモ用：テストメッセージ送信
                  sendUserSpeech('This is a test message from the UI', 0.95);
                  toast.success(t('sessions.player.messages.testMessageSent'));
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {t('sessions.player.actions.sendTestMessage')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 処理状態インジケーター */}
      <ProcessingIndicator
        stage={processingStage}
        message={processingMessage}
        className="transition-all duration-300"
      />

      {/* コントロールパネル */}
      <div
        className="bg-white rounded-lg shadow p-6"
        role="region"
        aria-label={t('sessions.player.actions.start')}
      >
        <div
          className="flex items-center justify-center space-x-4"
          role="group"
          aria-label="Session controls"
        >
          {status === 'IDLE' && (
            <button
              onClick={handleStart}
              data-testid="start-button"
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label={t('sessions.player.actions.start') + ' (Space)'}
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              {t('sessions.player.actions.start')}
            </button>
          )}

          {status === 'READY' && (
            <div className="flex items-center space-x-3">
              <div
                className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"
                role="status"
                aria-label={t('sessions.player.websocket.connecting')}
              ></div>
              <span className="text-lg text-gray-600">
                {t('sessions.player.websocket.connecting')}
              </span>
              <button
                onClick={handleStop}
                data-testid="stop-button"
                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 flex items-center focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                aria-label={t('sessions.player.actions.cancel') + ' (Escape)'}
              >
                {t('sessions.player.actions.cancel')}
              </button>
            </div>
          )}

          {status === 'PAUSED' && (
            <>
              <button
                onClick={handleStart}
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label={t('sessions.player.actions.resume') + ' (P or Space)'}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
                {t('sessions.player.actions.resume')}
              </button>
              <button
                onClick={handleStop}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label={t('sessions.player.actions.stop') + ' (Escape)'}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                    clipRule="evenodd"
                  />
                </svg>
                {t('sessions.player.actions.stop')}
              </button>
            </>
          )}

          {status === 'ACTIVE' && (
            <>
              <button
                onClick={handlePause}
                data-testid="pause-button"
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 flex items-center focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                aria-label={t('sessions.player.actions.pause') + ' (P)'}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {t('sessions.player.actions.pause')}
              </button>
              <button
                onClick={handleStop}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                aria-label={t('sessions.player.actions.stop') + ' (Space or Escape)'}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                    clipRule="evenodd"
                  />
                </svg>
                {t('sessions.player.actions.stop')}
              </button>
            </>
          )}

          {status === 'COMPLETED' && (
            <div className="text-center py-2">
              <p className="text-lg font-semibold text-gray-700">
                {t('sessions.player.completed.title')}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t('sessions.player.completed.duration')}: {formatTime(currentTime)} •{' '}
                {t('sessions.player.completed.messageCount', { count: transcript.length })}
              </p>
            </div>
          )}
        </div>

        {/* ヘルプテキスト */}
        {status === 'IDLE' && (
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>{t('sessions.player.help.startSession', { avatarName: avatar.name })}</p>
          </div>
        )}

        {status === 'ACTIVE' && (
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>{t('sessions.player.help.listening')}</p>
          </div>
        )}
      </div>

      {/* Session information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{t('sessions.player.details.title')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">{t('sessions.player.details.sessionId')}</p>
            <p className="font-mono text-xs mt-1">{session.id}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('sessions.player.details.scenario')}</p>
            <p className="font-medium mt-1">{scenario.title}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('sessions.player.details.language')}</p>
            <p className="font-medium mt-1">{scenario.language.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-gray-600">{t('sessions.player.details.created')}</p>
            <p className="font-medium mt-1">{new Date(session.startedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Hidden要素: 録画用 */}
      <div className="hidden">
        {/* アバター用Canvas（将来Three.js統合用） */}
        <canvas ref={avatarCanvasRef} width={1280} height={720} />

        {/* ユーザーカメラ */}
        <video ref={userVideoRef} autoPlay playsInline muted />

        {/* VideoComposer - アバター + ユーザーカメラ合成 */}
        <VideoComposer
          avatarCanvasRef={avatarCanvasRef}
          userVideoRef={userVideoRef}
          layout="picture-in-picture"
          width={1280}
          height={720}
          onCanvasReady={handleCanvasReady}
        />
      </div>
    </div>
  );
}
