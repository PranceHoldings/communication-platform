/**
 * Connection State Hook
 * Maps WebSocket states to ConnectionStatus display states
 */

'use client';

import { useMemo } from 'react';
import type { ConnectionState } from '@/components/connection-status';

interface UseConnectionStateProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface UseConnectionStateReturn {
  connectionState: ConnectionState;
  reconnectAttempt: number;
  maxReconnectAttempts: number;
}

export function useConnectionState({
  isConnected,
  isConnecting,
  error,
}: UseConnectionStateProps): UseConnectionStateReturn {
  const connectionState = useMemo<ConnectionState>(() => {
    // Parse reconnect error message format: "WEBSOCKET_RECONNECTING:3:5"
    if (error?.startsWith('WEBSOCKET_RECONNECTING:')) {
      return 'reconnecting';
    }

    // Check for reconnect failed
    if (error?.startsWith('WEBSOCKET_RECONNECT_FAILED:')) {
      return 'error';
    }

    // Other errors
    if (error) {
      return 'error';
    }

    // Connected state
    if (isConnected) {
      return 'connected';
    }

    // Connecting state
    if (isConnecting) {
      return 'connecting';
    }

    // Default disconnected
    return 'disconnected';
  }, [isConnected, isConnecting, error]);

  // Parse reconnect attempt from error message
  const { reconnectAttempt, maxReconnectAttempts } = useMemo(() => {
    if (error?.startsWith('WEBSOCKET_RECONNECTING:')) {
      const parts = error.split(':');
      return {
        reconnectAttempt: parseInt(parts[1] || '0', 10),
        maxReconnectAttempts: parseInt(parts[2] || '5', 10),
      };
    }

    if (error?.startsWith('WEBSOCKET_RECONNECT_FAILED:')) {
      const parts = error.split(':');
      const maxAttempts = parseInt(parts[1] || '5', 10);
      return {
        reconnectAttempt: maxAttempts,
        maxReconnectAttempts: maxAttempts,
      };
    }

    return {
      reconnectAttempt: 0,
      maxReconnectAttempts: 5,
    };
  }, [error]);

  return {
    connectionState,
    reconnectAttempt,
    maxReconnectAttempts,
  };
}
