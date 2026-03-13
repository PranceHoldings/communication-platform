/**
 * WebSocket Hook for Session Real-time Communication
 * Handles WebSocket connection, authentication, and message routing
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  AuthenticateMessage,
  TranscriptMessage,
  AvatarResponseMessage,
  AudioResponseMessage,
  TTSAudioChunkMessage,
  ProcessingUpdateMessage,
  SessionCompleteMessage,
  ErrorMessage,
  ServerToClientMessage,
} from '@prance/shared';

// Re-export for backward compatibility
export type {
  TranscriptMessage,
  AvatarResponseMessage,
  AudioResponseMessage,
  TTSAudioChunkMessage,
  ProcessingUpdateMessage,
  SessionCompleteMessage,
  ErrorMessage,
};

// All types are now imported from @prance/shared

interface UseWebSocketOptions {
  sessionId: string;
  token: string;
  scenarioPrompt?: string; // System prompt from scenario
  scenarioLanguage?: string; // Scenario language
  initialGreeting?: string; // Initial AI greeting from scenario
  silenceTimeout?: number; // Silence timeout in seconds from scenario
  enableSilencePrompt?: boolean; // Enable silence prompt from scenario
  silenceThreshold?: number; // Audio level threshold (0.0-1.0) to detect speech vs silence
  minSilenceDuration?: number; // Minimum silence duration in milliseconds to trigger speech_end
  onTranscript?: (message: TranscriptMessage) => void;
  onAvatarResponse?: (message: AvatarResponseMessage) => void;
  onAudioResponse?: (message: AudioResponseMessage) => void;
  onAudioChunk?: (message: TTSAudioChunkMessage) => void; // Phase 1.5: Real-time TTS
  onProcessingUpdate?: (message: ProcessingUpdateMessage) => void;
  onSessionComplete?: (message: SessionCompleteMessage) => void;
  onError?: (message: ErrorMessage) => void;
  onAuthenticated?: (sessionId: string, initialGreeting?: string) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: Record<string, unknown>) => void;
  sendAudioChunk: (data: ArrayBuffer, timestamp: number) => void;
  // sendAudioData: (audioBlob: Blob) => Promise<void>; // REMOVED: Dual audio flow unification (2026-03-12)
  sendVideoChunk: (data: Blob, timestamp: number) => Promise<void>;
  sendUserSpeech: (text: string, confidence: number) => void;
  sendSpeechEnd: () => void;
  endSession: () => void;
  checkVersion: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    sessionId,
    token,
    scenarioPrompt,
    scenarioLanguage,
    initialGreeting,
    silenceTimeout,
    enableSilencePrompt,
    silenceThreshold,
    minSilenceDuration,
    onTranscript,
    onAvatarResponse,
    onAudioResponse,
    onAudioChunk,
    onProcessingUpdate,
    onSessionComplete,
    onError,
    onAuthenticated,
    autoConnect = false,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Store callbacks in refs to keep them stable across renders
  const onTranscriptRef = useRef(onTranscript);
  const onAvatarResponseRef = useRef(onAvatarResponse);
  const onAudioResponseRef = useRef(onAudioResponse);
  const onAudioChunkRef = useRef(onAudioChunk);
  const onProcessingUpdateRef = useRef(onProcessingUpdate);
  const onSessionCompleteRef = useRef(onSessionComplete);
  const onErrorRef = useRef(onError);
  const onAuthenticatedRef = useRef(onAuthenticated);

  // Update refs on every render so they always point to the latest callbacks
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onAvatarResponseRef.current = onAvatarResponse;
    onAudioResponseRef.current = onAudioResponse;
    onAudioChunkRef.current = onAudioChunk;
    onProcessingUpdateRef.current = onProcessingUpdate;
    onSessionCompleteRef.current = onSessionComplete;
    onErrorRef.current = onError;
    onAuthenticatedRef.current = onAuthenticated;
  });

  // WebSocket endpoint from environment variable
  const wsEndpoint = process.env.NEXT_PUBLIC_WS_ENDPOINT || 'ws://localhost:3001';

  // Debug log
  useEffect(() => {
    console.log('[useWebSocket] Endpoint configured:', wsEndpoint);
    console.log('[useWebSocket] Environment:', process.env.NEXT_PUBLIC_WS_ENDPOINT);
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as ServerToClientMessage;
        console.log('WebSocket message received:', message);

        // Ignore empty messages
        if (!message || typeof message !== 'object' || Object.keys(message).length === 0) {
          console.warn('Received empty or invalid message, ignoring');
          return;
        }

        // Handle AWS API Gateway error responses (no type field)
        if (!message.type && 'message' in message) {
          console.error('WebSocket server error:', message);
          const errorMsg = (message as any).message || 'Unknown server error';
          setError(errorMsg);
          onErrorRef.current?.({
            type: 'error',
            code: 'SERVER_ERROR',
            message: errorMsg,
            details: message,
          });
          return;
        }

        // Ignore messages without a type field (likely malformed)
        if (!message.type) {
          console.warn('Received message without type field, ignoring:', message);
          return;
        }

        switch (message.type) {
          case 'transcript_partial':
          case 'transcript_final':
            onTranscriptRef.current?.(message as unknown as TranscriptMessage);
            break;

          case 'avatar_response':
          case 'avatar_response_partial':
          case 'avatar_response_final':
            onAvatarResponseRef.current?.(message as unknown as AvatarResponseMessage);
            break;

          case 'audio_response':
            onAudioResponseRef.current?.(message as unknown as AudioResponseMessage);
            break;

          case 'audio_chunk':
            // Phase 1.5: Real-time TTS streaming
            onAudioChunkRef.current?.(message as unknown as TTSAudioChunkMessage);
            break;

          case 'processing_update':
            onProcessingUpdateRef.current?.(message as unknown as ProcessingUpdateMessage);
            break;

          case 'session_complete':
            onSessionCompleteRef.current?.(message as unknown as SessionCompleteMessage);
            break;

          case 'error':
            console.error('WebSocket error message:', message);
            onErrorRef.current?.(message as unknown as ErrorMessage);
            setError((message as unknown as ErrorMessage).message);
            break;

          case 'pong':
            // Heartbeat response
            console.log('Pong received');
            break;

          case 'authenticated':
            console.log('Authentication confirmed:', message);
            const authMessage = message as any;
            const authSessionId = authMessage.sessionId;
            const authInitialGreeting = authMessage.initialGreeting;
            if (authSessionId) {
              onAuthenticatedRef.current?.(authSessionId, authInitialGreeting);
            }
            break;

          case 'audio_part_ack':
            // Audio part acknowledgment
            console.log('[WebSocket] Audio part acknowledged:', (message as any).partsReceived, '/', (message as any).totalParts);
            break;

          case 'video_chunk_ack':
            // Video chunk acknowledgment
            console.log('Video chunk acknowledged:', message);
            break;

          case 'video_ready':
            // Video processing complete
            console.log('Video ready:', message);
            break;

          case 'version':
            // Version information from Lambda
            console.log('[WebSocket] Lambda Version Info:', message);
            console.log('  Name:', (message as any).name);
            console.log('  Version:', (message as any).version);
            console.log('  Runtime:', (message as any).runtime);
            console.log('  Audio Processing:', (message as any).audioProcessing);
            break;

          default:
            console.warn('Unknown WebSocket message type:', (message as any).type, message);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
        setError('Failed to parse message');
      }
    },
    // Empty dependency array - callbacks accessed via stable refs
    []
  );

  const connect = useCallback(() => {
    console.log('[useWebSocket] connect() called', {
      wsEndpoint,
      token: token ? 'exists' : 'missing',
      isConnecting,
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[useWebSocket] WebSocket already connected');
      return;
    }

    if (isConnecting) {
      console.log('[useWebSocket] WebSocket connection already in progress');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Include token in query parameters for authentication
      const url = `${wsEndpoint}?token=${encodeURIComponent(token)}`;
      console.log('[useWebSocket] Connecting to WebSocket:', wsEndpoint);
      console.log('[useWebSocket] Full URL:', url);

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttempts.current = 0;

        // Send initial message with session ID and scenario data
        const authenticateMsg: AuthenticateMessage = {
          type: 'authenticate',
          sessionId: sessionId,
          scenarioPrompt,
          scenarioLanguage,
          initialGreeting,
          silenceTimeout,
          enableSilencePrompt,
          silenceThreshold,
          minSilenceDuration,
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(authenticateMsg));
        console.log('[WebSocket] Sent authenticate with scenario data:', {
          hasPrompt: !!scenarioPrompt,
          language: scenarioLanguage,
          hasInitialGreeting: !!initialGreeting,
          silenceTimeout,
          enableSilencePrompt,
          silenceThreshold,
          minSilenceDuration,
        });
      };

      ws.onmessage = handleMessage;

      ws.onerror = event => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setIsConnecting(false);
      };

      ws.onclose = event => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          const attempt = reconnectAttempts.current + 1;

          console.log(
            `Attempting reconnect in ${delay}ms (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`
          );

          // Set error message for UI feedback
          setError(`WEBSOCKET_RECONNECTING:${attempt}:${MAX_RECONNECT_ATTEMPTS}`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          const errorMsg = `WEBSOCKET_RECONNECT_FAILED:${MAX_RECONNECT_ATTEMPTS}`;
          setError(errorMsg);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsEndpoint, token, sessionId, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnected');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    reconnectAttempts.current = 0;
  }, []);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Only log warning for non-ping messages during active connection attempts
      if (message.type !== 'ping') {
        console.warn('[WebSocket] Cannot send message, WebSocket not connected:', message.type);
      }
    }
  }, []);

  const sendAudioChunk = useCallback(
    (data: ArrayBuffer, timestamp: number) => {
      console.log('[WebSocket] sendAudioChunk called:', {
        arrayBufferSize: data.byteLength,
        timestamp,
      });

      // Convert ArrayBuffer to Base64 string for JSON serialization
      const bytes = new Uint8Array(data);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 = btoa(binary);

      console.log('[WebSocket] Sending audio_chunk message:', {
        base64Length: base64.length,
        timestamp,
        messageType: 'audio_chunk',
      });

      sendMessage({
        type: 'audio_chunk',
        data: base64,
        timestamp,
      });
    },
    [sendMessage]
  );

  // REMOVED: sendAudioData - Dual audio flow unification (2026-03-12)
  // リアルタイムチャンク方式 (sendAudioChunk + sendSpeechEnd) に統一
  // 完全音声データ方式 (sendAudioData) は廃止
  // const sendAudioData = useCallback(...);

  const sendVideoChunk = useCallback(
    async (chunk: Blob, timestamp: number): Promise<void> => {
      try {
        // Convert Blob to ArrayBuffer
        const arrayBuffer = await chunk.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // AWS API Gateway WebSocket limit: 32KB per message
        // We need to split large chunks into smaller sub-chunks
        // Use 30KB (30,720 bytes) as safe limit to leave room for JSON overhead
        const MAX_CHUNK_SIZE = 30 * 1024; // 30KB

        // Generate unique chunk ID with UUID v4 for collision resistance
        const chunkId = `${timestamp}-${crypto.randomUUID()}`;

        // Calculate total parts needed
        const totalParts = Math.ceil(arrayBuffer.byteLength / MAX_CHUNK_SIZE);

        console.log(`[WebSocket] Splitting video chunk into ${totalParts} parts:`, {
          originalSize: arrayBuffer.byteLength,
          timestamp,
          chunkId,
        });

        // Split and send each part
        for (let partIndex = 0; partIndex < totalParts; partIndex++) {
          const start = partIndex * MAX_CHUNK_SIZE;
          const end = Math.min(start + MAX_CHUNK_SIZE, arrayBuffer.byteLength);
          const partBytes = bytes.slice(start, end);

          // Convert to Base64 string
          let binary = '';
          for (let i = 0; i < partBytes.byteLength; i++) {
            binary += String.fromCharCode(partBytes[i]!);
          }
          const base64 = btoa(binary);

          // Send video chunk part
          sendMessage({
            type: 'video_chunk_part',
            chunkId,
            partIndex,
            totalParts,
            data: base64,
            timestamp,
          });

          console.log(`[WebSocket] Sent video chunk part ${partIndex + 1}/${totalParts}:`, {
            chunkId,
            partSize: partBytes.byteLength,
            base64Length: base64.length,
          });
        }

        console.log(`[WebSocket] Video chunk transmission complete:`, {
          chunkId,
          totalParts,
          timestamp,
        });
      } catch (error) {
        console.error('[WebSocket] Failed to send video chunk:', error);
        throw error;
      }
    },
    [sendMessage]
  );

  const sendUserSpeech = useCallback(
    (text: string, confidence: number) => {
      sendMessage({
        type: 'user_speech',
        text,
        timestamp: Date.now(),
        confidence,
      });
    },
    [sendMessage]
  );

  const sendSpeechEnd = useCallback(() => {
    sendMessage({
      type: 'speech_end',
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const endSession = useCallback(() => {
    sendMessage({
      type: 'session_end',
    });
  }, [sendMessage]);

  const checkVersion = useCallback(() => {
    console.log('[WebSocket] Requesting version information');
    sendMessage({
      type: 'version',
    });
  }, [sendMessage]);

  // Auto-connect on mount if requested
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      sendMessage({ type: 'ping', timestamp: Date.now() });
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
    sendAudioChunk,
    // sendAudioData, // REMOVED: Dual audio flow unification (2026-03-12)
    sendVideoChunk,
    sendUserSpeech,
    sendSpeechEnd,
    endSession,
    checkVersion,
  };
}
