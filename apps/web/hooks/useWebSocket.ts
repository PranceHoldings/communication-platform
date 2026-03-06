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

interface UseWebSocketOptions {
  sessionId: string;
  token: string;
  onTranscript?: (message: TranscriptMessage) => void;
  onAvatarResponse?: (message: AvatarResponseMessage) => void;
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

  // WebSocket endpoint from environment variable
  const wsEndpoint = process.env.NEXT_PUBLIC_WS_ENDPOINT || 'wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev';

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket message received:', message);

        switch (message.type) {
          case 'transcript_partial':
          case 'transcript_final':
            onTranscript?.(message as TranscriptMessage);
            break;

          case 'avatar_response':
            onAvatarResponse?.(message as AvatarResponseMessage);
            break;

          case 'processing_update':
            onProcessingUpdate?.(message as ProcessingUpdateMessage);
            break;

          case 'session_complete':
            onSessionComplete?.(message as SessionCompleteMessage);
            break;

          case 'error':
            console.error('WebSocket error message:', message);
            onError?.(message as ErrorMessage);
            setError((message as ErrorMessage).message);
            break;

          case 'pong':
            // Heartbeat response
            console.log('Pong received');
            break;

          case 'authenticated':
            console.log('Authentication confirmed');
            break;

          default:
            console.warn('Unknown WebSocket message type:', message.type);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
        setError('Failed to parse message');
      }
    },
    [onTranscript, onAvatarResponse, onProcessingUpdate, onSessionComplete, onError]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (isConnecting) {
      console.log('WebSocket connection already in progress');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Include token in query parameters for authentication
      const url = `${wsEndpoint}?token=${encodeURIComponent(token)}`;
      console.log('Connecting to WebSocket:', wsEndpoint);

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
  }, [wsEndpoint, token, sessionId, handleMessage, isConnecting]);

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
      console.error('WebSocket not connected, cannot send message');
      setError('Not connected');
    }
  }, []);

  const sendAudioChunk = useCallback(
    (data: ArrayBuffer, timestamp: number) => {
      sendMessage({
        type: 'audio_chunk',
        data,
        timestamp,
      });
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
    sendUserSpeech,
    sendSpeechEnd,
    endSession,
  };
}
