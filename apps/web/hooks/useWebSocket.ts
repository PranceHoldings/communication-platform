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

  // Video chunk ACK confirmation mechanism (Phase 1.6)
  interface PendingChunk {
    chunkId: string;
    data: Blob;
    timestamp: number;
    sequenceNumber: number;
    partIndex: number;
    totalParts: number;
    sentAt: number;
    retryCount: number;
    timeoutHandle?: NodeJS.Timeout;
  }

  const pendingChunksRef = useRef<Map<string, PendingChunk>>(new Map());
  const sequenceNumberRef = useRef<number>(0);

  // ACK settings
  const ACK_TIMEOUT = 5000; // 5 seconds
  const MAX_RETRY = 3;
  const RETRY_BACKOFF_BASE = 1000; // 1 second

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
            // Video chunk acknowledgment (Phase 1.6: ACK confirmation)
            {
              const ackMessage = message as any;
              const { chunkId, sequenceNumber } = ackMessage;

              // Clear pending chunk
              const pending = pendingChunksRef.current.get(chunkId);
              if (pending) {
                if (pending.timeoutHandle) {
                  clearTimeout(pending.timeoutHandle);
                }
                pendingChunksRef.current.delete(chunkId);
                console.log(`[WebSocket] Video chunk ${chunkId} (seq ${sequenceNumber}) acknowledged`);
              } else {
                console.warn(`[WebSocket] Received ACK for unknown chunk ${chunkId}`);
              }
            }
            break;

          case 'video_chunk_missing':
            // Missing chunks notification (Phase 1.6: Gap detection)
            {
              const missingMessage = message as any;
              console.warn('[WebSocket] Missing video chunks detected:', missingMessage.missingSequences);
              // TODO: Implement retransmission for missing sequences
            }
            break;

          case 'video_chunk_error':
            // Video chunk error (Phase 1.6: Hash mismatch, etc.)
            {
              const errorMessage = message as any;
              console.error('[WebSocket] Video chunk error:', errorMessage);
              console.error(`  Chunk ID: ${errorMessage.chunkId}`);
              console.error(`  Error: ${errorMessage.error}`);
              console.error(`  Message: ${errorMessage.message}`);

              // Clear pending chunk
              const pending = pendingChunksRef.current.get(errorMessage.chunkId);
              if (pending) {
                if (pending.timeoutHandle) {
                  clearTimeout(pending.timeoutHandle);
                }
                pendingChunksRef.current.delete(errorMessage.chunkId);

                // Retry if not exceeded max retries
                if (pending.retryCount < MAX_RETRY) {
                  console.warn(`[WebSocket] Retrying chunk ${errorMessage.chunkId} due to error (${pending.retryCount + 1}/${MAX_RETRY})`);
                  // Re-send chunk after backoff
                  const backoff = RETRY_BACKOFF_BASE * Math.pow(2, pending.retryCount);
                  setTimeout(() => {
                    // Will be implemented in sendVideoChunk
                  }, backoff);
                } else {
                  console.error(`[WebSocket] Chunk ${errorMessage.chunkId} failed after ${MAX_RETRY} retries`);
                  setError(`Video chunk transmission failed: ${errorMessage.message}`);
                }
              }
            }
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

    // Clear all pending chunks
    for (const [chunkId, pending] of pendingChunksRef.current.entries()) {
      if (pending.timeoutHandle) {
        clearTimeout(pending.timeoutHandle);
      }
      pendingChunksRef.current.delete(chunkId);
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

  // Phase 1.6: Retry helper for video chunks
  const retryVideoChunk = useCallback(
    (chunkId: string) => {
      const pending = pendingChunksRef.current.get(chunkId);
      if (!pending) return;

      if (pending.retryCount >= MAX_RETRY) {
        console.error(`[WebSocket] Chunk ${chunkId} failed after ${MAX_RETRY} retries`);
        pendingChunksRef.current.delete(chunkId);
        setError(`Video chunk ${chunkId} transmission failed after ${MAX_RETRY} retries`);
        return;
      }

      // Exponential backoff
      const backoff = RETRY_BACKOFF_BASE * Math.pow(2, pending.retryCount);
      pending.retryCount++;

      console.warn(
        `[WebSocket] Chunk ${chunkId} timeout, retry ${pending.retryCount}/${MAX_RETRY} in ${backoff}ms`
      );

      setTimeout(async () => {
        // Re-send chunk
        await sendVideoChunkWithTracking(pending.data, pending.timestamp, pending);
      }, backoff);
    },
    [setError]
  );

  // Phase 1.6: Send video chunk with tracking
  const sendVideoChunkWithTracking = useCallback(
    async (chunk: Blob, timestamp: number, retryPending?: PendingChunk): Promise<void> => {
      try {
        // Convert Blob to ArrayBuffer
        const arrayBuffer = await chunk.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Calculate SHA-256 hash for integrity validation
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        // AWS API Gateway WebSocket limit: 32KB per message
        // We need to split large chunks into smaller sub-chunks
        // Use 30KB (30,720 bytes) as safe limit to leave room for JSON overhead
        const MAX_CHUNK_SIZE = 30 * 1024; // 30KB

        // Generate unique chunk ID or reuse for retry
        const chunkId = retryPending?.chunkId || `${timestamp}-${crypto.randomUUID()}`;
        const sequenceNumber = retryPending?.sequenceNumber || sequenceNumberRef.current++;

        // Calculate total parts needed
        const totalParts = Math.ceil(arrayBuffer.byteLength / MAX_CHUNK_SIZE);

        console.log(`[WebSocket] Sending video chunk (seq ${sequenceNumber}):`, {
          chunkId,
          originalSize: arrayBuffer.byteLength,
          hash: hash.substring(0, 16),
          totalParts,
          timestamp,
          isRetry: !!retryPending,
          retryCount: retryPending?.retryCount || 0,
        });

        // Track pending chunk
        const pending: PendingChunk = retryPending || {
          chunkId,
          data: chunk,
          timestamp,
          sequenceNumber,
          partIndex: 0,
          totalParts,
          sentAt: Date.now(),
          retryCount: 0,
        };

        // Set timeout
        const timeoutHandle = setTimeout(() => {
          retryVideoChunk(chunkId);
        }, ACK_TIMEOUT);

        pending.timeoutHandle = timeoutHandle;
        pendingChunksRef.current.set(chunkId, pending);

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

          // Send video chunk part with sequence number and hash
          sendMessage({
            type: 'video_chunk_part',
            chunkId,
            sequenceNumber,
            partIndex,
            totalParts,
            data: base64,
            hash,
            timestamp,
          });

          console.log(`[WebSocket] Sent video chunk part ${partIndex + 1}/${totalParts}:`, {
            chunkId,
            sequenceNumber,
            partSize: partBytes.byteLength,
            base64Length: base64.length,
          });
        }

        console.log(`[WebSocket] Video chunk transmission complete, waiting for ACK:`, {
          chunkId,
          sequenceNumber,
          totalParts,
          timestamp,
        });
      } catch (error) {
        console.error('[WebSocket] Failed to send video chunk:', error);
        throw error;
      }
    },
    [sendMessage, retryVideoChunk]
  );

  const sendVideoChunk = useCallback(
    async (chunk: Blob, timestamp: number): Promise<void> => {
      await sendVideoChunkWithTracking(chunk, timestamp);
    },
    [sendVideoChunkWithTracking]
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
