'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { Session } from '@/lib/api/sessions';
import { Avatar } from '@/lib/api/avatars';
import { Scenario } from '@/lib/api/scenarios';
import {
  useWebSocket,
  TranscriptMessage,
  AvatarResponseMessage,
  AudioResponseMessage,
  ProcessingUpdateMessage,
  SessionCompleteMessage,
  ErrorMessage,
} from '@/hooks/useWebSocket';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useVideoRecorder } from '@/hooks/useVideoRecorder';
import { VideoComposer } from './video-composer';
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
  const [status, setStatus] = useState<SessionPlayerStatus>('IDLE');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [pendingSessionEnd, setPendingSessionEnd] = useState(false);
  const [shouldSendSessionEnd, setShouldSendSessionEnd] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

  // 録画機能用のref
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null); // VideoComposerから受け取ったcanvasを保持（useVideoRecorderに渡す）

  // WebSocket value refs (to break circular dependencies)
  const isConnectedRef = useRef<boolean>(false);
  const isAuthenticatedRef = useRef<boolean>(false);
  const sendMessageRef = useRef<((message: Record<string, unknown>) => void) | null>(null);
  const sendSpeechEndRef = useRef<(() => void) | null>(null);
  const sendAudioDataRef = useRef<((blob: Blob) => Promise<void>) | null>(null);
  const sendVideoChunkRef = useRef<((chunk: Blob, timestamp: number) => Promise<void>) | null>(
    null
  );
  const endSessionRef = useRef<(() => void) | null>(null);

  // トークン取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accessToken = localStorage.getItem('accessToken');
      setToken(accessToken);
    }
  }, []);

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

  const handleAvatarResponse = useCallback((message: AvatarResponseMessage) => {
    // AIアバターの応答
    setTranscript(prev => [
      ...prev,
      {
        id: `ai-${message.timestamp}`,
        speaker: 'AI',
        text: message.text,
        timestamp: message.timestamp,
      },
    ]);
  }, []);

  const handleProcessingUpdate = useCallback((message: ProcessingUpdateMessage) => {
    // 処理状況の更新（オプション：UI表示用）
    console.log('Processing:', message.stage, message.progress);
  }, []);

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

  const handleAudioResponse = useCallback(
    (message: AudioResponseMessage) => {
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

        // Audio要素で再生
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }

        audioRef.current.src = audioUrl;
        audioRef.current.onplay = () => {
          setIsPlayingAudio(true);
          console.log('[SessionPlayer] Audio playback started');
        };
        audioRef.current.onended = () => {
          setIsPlayingAudio(false);
          if (needsCleanup) {
            URL.revokeObjectURL(audioUrl);
          }
          console.log('[SessionPlayer] Audio playback ended');
        };
        audioRef.current.onerror = error => {
          setIsPlayingAudio(false);
          if (needsCleanup) {
            URL.revokeObjectURL(audioUrl);
          }
          console.error('[SessionPlayer] Audio playback error:', error);
          toast.error(t('sessions.player.messages.audioPlaybackError'));
        };

        // 再生開始
        audioRef.current.play().catch(error => {
          console.error('[SessionPlayer] Failed to play audio:', error);
          toast.error(t('sessions.player.messages.audioPlaybackError'));
          setIsPlayingAudio(false);
        });
      } catch (error) {
        console.error('[SessionPlayer] Failed to process audio response:', error);
        toast.error(t('sessions.player.messages.audioPlaybackError'));
      }
    },
    [t]
  );

  const handleError = useCallback((message: ErrorMessage) => {
    // エラー処理
    console.error('WebSocket error:', message);
    toast.error(`Error: ${message.message}`);
  }, []);

  const handleAuthenticated = useCallback(
    (sessionId: string) => {
      console.log('[SessionPlayer] WebSocket authenticated:', sessionId);
      setIsAuthenticated(true);
      isAuthenticatedRef.current = true;
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
    sendAudioData,
    sendVideoChunk,
    endSession,
  } = useWebSocket({
    sessionId: session.id,
    token: token || '',
    autoConnect: false,
    onTranscript: handleTranscript,
    onAvatarResponse: handleAvatarResponse,
    onAudioResponse: handleAudioResponse,
    onProcessingUpdate: handleProcessingUpdate,
    onSessionComplete: handleSessionComplete,
    onError: handleError,
    onAuthenticated: handleAuthenticated,
  });

  // Sync WebSocket values to refs (to break circular dependencies)
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    sendSpeechEndRef.current = sendSpeechEnd;
  }, [sendSpeechEnd]);

  useEffect(() => {
    sendAudioDataRef.current = sendAudioData;
  }, [sendAudioData]);

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

    // Send speech_end signal via WebSocket
    if (isConnectedRef.current && sendSpeechEndRef.current) {
      sendSpeechEndRef.current();
      console.log('[SessionPlayer] speech_end signal sent');
      toast.info(t('sessions.player.messages.processingAudio'));

      // CRITICAL: Restart MediaRecorder to generate new EBML header
      // MediaRecorder timeslice mode only creates complete header for first chunk
      // Subsequent chunks are fragments, so we must restart for each speech segment
      restartRecording();
      console.log('[SessionPlayer] MediaRecorder restarted for next speech segment');
    }
  }, [t, restartRecording]);

  const handleRecordingError = useCallback(
    (error: Error) => {
      console.error('[SessionPlayer] Recording error:', error);
      toast.error(t('sessions.player.messages.microphoneError'));
    },
    [t]
  );

  const handleRecordingComplete = useCallback(
    async (audioBlob: Blob) => {
      // 認証完了後のみ音声データを送信
      if (isConnectedRef.current && isAuthenticatedRef.current && sendAudioDataRef.current) {
        try {
          console.log('[SessionPlayer] Recording complete:', {
            size: audioBlob.size,
            type: audioBlob.type,
          });

          console.log('[SessionPlayer] Sending complete audio via WebSocket');

          // Send complete audio blob for STT processing
          await sendAudioDataRef.current(audioBlob);

          // Set flag to wait for transcript_final before ending session
          setPendingSessionEnd(true);

          toast.info(t('sessions.player.messages.processingAudio'));
        } catch (error) {
          console.error('[SessionPlayer] Failed to process recording:', error);
          toast.error(t('sessions.player.messages.audioSendError'));
          setPendingSessionEnd(false);
        }
      } else if (!isAuthenticatedRef.current) {
        console.warn('[SessionPlayer] Skipping audio data - not authenticated yet');
      }
    },
    [t]
  );

  const {
    isRecording: isMicRecording,
    audioLevel,
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
    silenceThreshold: 0.05, // Silence threshold (0-1)
    silenceDuration: 500, // 500ms silence triggers speech_end
  });

  // 録画機能 - ビデオチャンクハンドラー
  const handleVideoChunk = useCallback(
    async (chunk: Blob, timestamp: number) => {
      // 認証完了後のみビデオチャンクを送信
      if (isConnectedRef.current && isAuthenticated && status === 'ACTIVE' && sendVideoChunkRef.current) {
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
      toast.error(t('sessions.player.recording.messages.error', { error: error.message }));
    },
    [t]
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

  const handleStart = async () => {
    console.log('[SessionPlayer] handleStart called', {
      token: token ? 'exists' : 'missing',
      status,
    });

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
          console.log('[SessionPlayer] User camera started');
        }
      } catch (error) {
        console.error('[SessionPlayer] Failed to get user camera:', error);
        toast.warning('カメラへのアクセスが拒否されました。録画機能は利用できません。');
      }

      setStatus('READY');
      // WebSocket接続はuseEffectで自動的に開始される（重複呼び出しを防ぐため削除）
      toast.info(t('sessions.player.websocket.connecting'));
      // 接続完了後、useEffectで自動的にACTIVE状態に遷移
    } else if (status === 'PAUSED') {
      setStatus('ACTIVE');
      // セッション再開 + 音声録音再開 + ビデオ録画再開
      resumeRecording();
      if (recordingStatus === 'paused') {
        try {
          resumeVideoRecording();
        } catch (err) {
          console.error('[SessionPlayer] Failed to resume video recording:', err);
        }
      }
      toast.success(t('sessions.player.messages.sessionResumed'));
    }
  };

  const handlePause = () => {
    if (status === 'ACTIVE') {
      setStatus('PAUSED');
      // 音声録音一時停止 + ビデオ録画一時停止
      pauseRecording();
      if (recordingStatus === 'recording') {
        try {
          pauseVideoRecording();
        } catch (err) {
          console.error('[SessionPlayer] Failed to pause video recording:', err);
        }
      }
      toast.info(t('sessions.player.status.paused'));
    }
  };

  const handleStop = () => {
    if (status === 'ACTIVE' || status === 'PAUSED' || status === 'READY') {
      setStatus('COMPLETED');
      // Note: Do NOT reset isAuthenticated here - audio data needs to be sent first
      // It will be reset in handleSessionComplete() after all processing is done

      // Check if audio was being recorded
      const wasRecording = isMicRecording;

      // 1. Stop audio recording first
      stopRecording();

      // 2. Stop video recording if active
      if (recordingStatus === 'recording' || recordingStatus === 'paused') {
        try {
          stopVideoRecording();
        } catch (err) {
          console.error('[SessionPlayer] Failed to stop video recording:', err);
        }
      }

      // 3. Stop user camera
      if (userVideoRef.current && userVideoRef.current.srcObject) {
        const stream = userVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('[SessionPlayer] Stopped camera track:', track.kind);
        });
        userVideoRef.current.srcObject = null;
      }

      // 4. If audio was recording, wait for transcript before sending session_end
      if (wasRecording) {
        console.log('[SessionPlayer] Audio was recording, will wait for audio processing before session_end');
        setPendingSessionEnd(true);
        // session_end will be sent after transcript_final is received
      } else {
        // 4. Send session end notification immediately if no audio to process
        if (isConnectedRef.current && endSessionRef.current) {
          console.log('[SessionPlayer] No audio recorded, sending session_end immediately');
          endSessionRef.current();

          // 5. Set timeout to disconnect after 30 seconds if no session_complete received
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
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{scenario.title}</h2>
            <p className="text-gray-600 mt-1">
              {t('sessions.player.info.avatar')}: <span className="font-medium">{avatar.name}</span>{' '}
              • {t('sessions.player.info.category')}:{' '}
              <span className="font-medium">{scenario.category}</span>
            </p>
          </div>
          <div className="text-right">
            <div className={`text-lg font-semibold ${getStatusColor(status)}`}>
              {getStatusText(status)}
            </div>
            <div className="text-2xl font-mono font-bold text-gray-900 mt-1">
              {formatTime(currentTime)}
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側: アバター表示エリア */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{t('sessions.player.avatar.title')}</h3>
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
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center text-gray-600">
                <svg
                  className={`w-4 h-4 mr-2 ${isMicRecording ? 'text-red-500' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{t('sessions.player.avatar.microphone')}:</span>
              </div>
              <span className={`font-medium ${isMicRecording ? 'text-red-600' : 'text-gray-500'}`}>
                {isMicRecording
                  ? t('sessions.player.avatar.recording')
                  : t('sessions.player.avatar.inactive')}
              </span>
            </div>

            {/* 音声レベルインジケーター */}
            {isMicRecording && (
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

            {/* カメラステータス（将来実装） */}
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <span>{t('sessions.player.avatar.camera')}:</span>
              </div>
              <span className="font-medium text-gray-500">{t('sessions.player.avatar.off')}</span>
            </div>

            {/* 音声再生ステータス */}
            <div className="flex items-center justify-between text-sm">
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
                      duration: `${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2, '0')}`,
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">{t('sessions.player.transcript.title')}</h3>
          <div className="h-[400px] overflow-y-auto space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
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
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">
                      {item.speaker === 'AI'
                        ? `🤖 ${avatar.name}`
                        : `👤 ${t('sessions.player.transcript.you')}`}
                    </span>
                    <span className="text-xs text-gray-500">{formatTime(item.timestamp)}</span>
                  </div>
                  <p className="text-sm text-gray-900">{item.text}</p>
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
                  <span className="text-sm text-red-600">{wsError}</span>
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

      {/* コントロールパネル */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center space-x-4">
          {status === 'IDLE' && (
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
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
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              <span className="text-lg text-gray-600">
                {t('sessions.player.websocket.connecting')}
              </span>
              <button
                onClick={handleStop}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 flex items-center"
              >
                {t('sessions.player.actions.cancel')}
              </button>
            </div>
          )}

          {status === 'PAUSED' && (
            <>
              <button
                onClick={handleStart}
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
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
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
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
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
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
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
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
