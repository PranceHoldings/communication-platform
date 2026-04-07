'use client';

import { useI18n } from '@/lib/i18n/provider';
import { useEffect, useState } from 'react';

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface ConnectionStatusProps {
  state: ConnectionState;
  error?: string | null;
  reconnectAttempt?: number;
  maxReconnectAttempts?: number;
  className?: string;
}

export function ConnectionStatus({
  state,
  error,
  reconnectAttempt = 0,
  maxReconnectAttempts = 5,
  className = '',
}: ConnectionStatusProps) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide when connected after a delay
  useEffect(() => {
    if (state === 'connected') {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [state]);

  if (!isVisible && state === 'connected') {
    return null;
  }

  const stateConfig = {
    disconnected: {
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      textColor: 'text-gray-700 dark:text-gray-300',
      borderColor: 'border-gray-300 dark:border-gray-600',
      iconColor: 'text-gray-500',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
      ),
      label: t('common.connectionStatus.disconnected'),
    },
    connecting: {
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-700 dark:text-blue-300',
      borderColor: 'border-blue-200 dark:border-blue-700',
      iconColor: 'text-blue-500',
      icon: (
        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      ),
      label: t('common.connectionStatus.connecting'),
    },
    connected: {
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-300',
      borderColor: 'border-green-200 dark:border-green-700',
      iconColor: 'text-green-500',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: t('common.connectionStatus.connected'),
    },
    reconnecting: {
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-700 dark:text-yellow-300',
      borderColor: 'border-yellow-200 dark:border-yellow-700',
      iconColor: 'text-yellow-500',
      icon: (
        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      ),
      label: t('common.connectionStatus.reconnecting', {
        attempt: reconnectAttempt.toString(),
        maxAttempts: maxReconnectAttempts.toString(),
      }),
    },
    error: {
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-300',
      borderColor: 'border-red-200 dark:border-red-700',
      iconColor: 'text-red-500',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      label: t('common.connectionStatus.error'),
    },
  };

  const config = stateConfig[state];

  // Parse error message for user-friendly display
  const displayError = error
    ? (() => {
        // Handle WEBSOCKET_RECONNECT_FAILED:5 format
        const failedMatch = error.match(/WEBSOCKET_RECONNECT_FAILED:(\d+)/);
        if (failedMatch) {
          return t('common.connectionStatus.reconnectFailed', {
            attempts: failedMatch[1] || '5',
            defaultValue: `Failed to reconnect after ${failedMatch[1]} attempts. Please refresh the page.`,
          });
        }

        // Handle WEBSOCKET_RECONNECTING:2:5 format
        const reconnectingMatch = error.match(/WEBSOCKET_RECONNECTING:(\d+):(\d+)/);
        if (reconnectingMatch) {
          return t('common.connectionStatus.reconnecting', {
            attempt: reconnectingMatch[1] || '1',
            maxAttempts: reconnectingMatch[2] || '5',
          });
        }

        // Return original error if no pattern matches
        return error;
      })()
    : null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border shadow-lg ${config.bgColor} ${config.borderColor}`}
      >
        <div className={config.iconColor}>{config.icon}</div>
        <div className="flex flex-col gap-1">
          <p className={`text-sm font-medium ${config.textColor}`}>{config.label}</p>
          {displayError && <p className={`text-xs ${config.textColor} opacity-80`}>{displayError}</p>}
        </div>
        {state === 'reconnecting' && (
          <div className="ml-2">
            <div className="flex gap-1">
              {Array.from({ length: maxReconnectAttempts }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${
                    i < reconnectAttempt ? 'bg-yellow-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
