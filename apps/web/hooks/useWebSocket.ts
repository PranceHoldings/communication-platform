/**
 * WebSocket Hook for Session Real-time Communication
 * Handles WebSocket connection, authentication, and message routing
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export interface TranscriptMessage {
  type: 'transcript_partial' | 'transcript_final';
  speaker: 'AI' | 'USER';
  text: string;
  timestamp?: number;
  timestamp_start?: number;
  timestamp_end?: number;
  confidence?: number;
}

export interface AvatarResponseMessage {
  type: 'avatar_response';
  speaker: 'AI';
  text: string;
  timestamp: number;
}

export interface ProcessingUpdateMessage {
  type: 'processing_update';
  stage: string;
  progress: number;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
  details?: unknown;
}

export interface SessionCompleteMessage {
  type: 'session_complete';
  session_id: string;
  report_id?: string;
}

export interface AudioResponseMessage {
  type: 'audio_response';
  audio: string; // Base64 encoded audio data
  contentType: string;
  timestamp: number;
}

interface UseWebSocketOptions {
  sessionId: string;
  token: string;
  onTranscript?: (message: TranscriptMessage) => void;
  onAvatarResponse?: (message: AvatarResponseMessage) => void;
  onAudioResponse?: (message: AudioResponseMessage) => void;
  onProcessingUpdate?: (message: ProcessingUpdateMessage) => void;
  onSessionComplete?: (message: SessionCompleteMessage) => void;
  onError?: (message: ErrorMessage) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: WebSocketMessage) => void;
  sendAudioChunk: (data: ArrayBuffer, timestamp: number) => void;
  sendAudioData: (audioBlob: Blob) => Promise<void>;
  sendVideoChunk: (data: Blob, timestamp: number) => Promise<void>;
  sendUserSpeech: (text: string, confidence: number) => void;
  sendSpeechEnd: () => void;
  endSession: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    sessionId,
    token,
    onTranscript,
    onAvatarResponse,
    onAudioResponse,
    onProcessingUpdate,
    onSessionComplete,
    onError,
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
  const onProcessingUpdateRef = useRef(onProcessingUpdate);
  const onSessionCompleteRef = useRef(onSessionComplete);
  const onErrorRef = useRef(onError);

  // Update refs on every render so they always point to the latest callbacks
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onAvatarResponseRef.current = onAvatarResponse;
    onAudioResponseRef.current = onAudioResponse;
    onProcessingUpdateRef.current = onProcessingUpdate;
    onSessionCompleteRef.current = onSessionComplete;
    onErrorRef.current = onError;
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
        const message: WebSocketMessage = JSON.parse(event.data);
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
            onAvatarResponseRef.current?.(message as unknown as AvatarResponseMessage);
            break;

          case 'audio_response':
            onAudioResponseRef.current?.(message as unknown as AudioResponseMessage);
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
            console.log('Authentication confirmed');
            break;

          case 'video_chunk_ack':
            // Video chunk acknowledgment
            console.log('Video chunk acknowledged:', message);
            break;

          case 'video_ready':
            // Video processing complete
            console.log('Video ready:', message);
            break;

          default:
            console.warn('Unknown WebSocket message type:', message.type, message);
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
    console.log('[useWebSocket] connect() called', { wsEndpoint, token: token ? 'exists' : 'missing', isConnecting });

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

        // Send initial message with session ID
        ws.send(
          JSON.stringify({
            type: 'authenticate',
            session_id: sessionId,
            timestamp: Date.now(),
          })
        );
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Attempting reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Maximum reconnection attempts reached');
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

  const sendMessage = useCallback((message: WebSocketMessage) => {
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
      // Convert ArrayBuffer to Base64 string for JSON serialization
      const bytes = new Uint8Array(data);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      const base64 = btoa(binary);

      sendMessage({
        type: 'audio_chunk',
        data: base64,
        timestamp,
      });
    },
    [sendMessage]
  );

  const sendAudioData = useCallback(
    async (audioBlob: Blob): Promise<void> => {
      try {
        // Convert Blob to ArrayBuffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Convert to Base64 string
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        const base64 = btoa(binary);

        console.log('[WebSocket] Sending complete audio data:', {
          size: audioBlob.size,
          type: audioBlob.type,
          base64Length: base64.length,
        });

        // Send complete audio data
        sendMessage({
          type: 'audio_data',
          audio: base64,
          contentType: audioBlob.type,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('[WebSocket] Failed to send audio data:', error);
        throw error;
      }
    },
    [sendMessage]
  );

  const sendVideoChunk = useCallback(
    async (chunk: Blob, timestamp: number): Promise<void> => {
      try {
        // Convert Blob to ArrayBuffer
        const arrayBuffer = await chunk.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Convert to Base64 string
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        const base64 = btoa(binary);

        // Send video chunk
        sendMessage({
          type: 'video_chunk',
          data: base64,
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
    sendAudioData,
    sendVideoChunk,
    sendUserSpeech,
    sendSpeechEnd,
    endSession,
  };
}
