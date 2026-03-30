'use client';

import { useI18n } from '@/lib/i18n/provider';
import { useErrorMessage, type ErrorDetails } from '@/hooks/useErrorMessage';
import { useState } from 'react';

export type ErrorCategory =
  | 'microphone'
  | 'websocket'
  | 'audio'
  | 'api'
  | 'session'
  | 'network'
  | 'unknown';

interface ErrorGuidanceProps {
  error: Error | string | ErrorDetails | null;
  category?: ErrorCategory;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function ErrorGuidance({
  error,
  category,
  onRetry,
  onDismiss,
  showDetails = false,
  className = '',
}: ErrorGuidanceProps) {
  const { t } = useI18n();
  const { getErrorMessage, getMicrophoneInstructions } = useErrorMessage();
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  if (!error) return null;

  const errorMessage = getErrorMessage(error);
  const errorCode = typeof error === 'object' && 'code' in error ? error.code : null;

  // Determine category from error code if not provided
  const detectedCategory = category || detectCategory(errorCode);

  const categoryConfig = {
    microphone: {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      ),
      color: 'orange',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-700',
      textColor: 'text-orange-800 dark:text-orange-200',
      iconColor: 'text-orange-600 dark:text-orange-400',
      showInstructions: true,
    },
    websocket: {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
      color: 'red',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-700',
      textColor: 'text-red-800 dark:text-red-200',
      iconColor: 'text-red-600 dark:text-red-400',
      showInstructions: false,
    },
    audio: {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      ),
      color: 'yellow',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-700',
      textColor: 'text-yellow-800 dark:text-yellow-200',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      showInstructions: false,
    },
    api: {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      color: 'purple',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-700',
      textColor: 'text-purple-800 dark:text-purple-200',
      iconColor: 'text-purple-600 dark:text-purple-400',
      showInstructions: false,
    },
    session: {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: 'blue',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-700',
      textColor: 'text-blue-800 dark:text-blue-200',
      iconColor: 'text-blue-600 dark:text-blue-400',
      showInstructions: false,
    },
    network: {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
          />
        </svg>
      ),
      color: 'red',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-700',
      textColor: 'text-red-800 dark:text-red-200',
      iconColor: 'text-red-600 dark:text-red-400',
      showInstructions: false,
    },
    unknown: {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: 'gray',
      bgColor: 'bg-gray-50 dark:bg-gray-800',
      borderColor: 'border-gray-200 dark:border-gray-600',
      textColor: 'text-gray-800 dark:text-gray-200',
      iconColor: 'text-gray-600 dark:text-gray-400',
      showInstructions: false,
    },
  };

  const config = categoryConfig[detectedCategory];

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${config.iconColor}`}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold mb-1 ${config.textColor}`}>
            {t(`errors.${detectedCategory}.title`)}
          </h3>
          <p className={`text-sm ${config.textColor} mb-3`}>{errorMessage}</p>

          {config.showInstructions && errorCode?.includes('MICROPHONE') && (
            <div
              className={`text-xs ${config.textColor} bg-white/50 dark:bg-black/20 rounded p-3 mb-3`}
            >
              <p className="font-medium mb-1">
                {t('errors.microphone.instructions.title', {
                  defaultValue: 'How to allow microphone access:',
                })}
              </p>
              <p>{getMicrophoneInstructions()}</p>
            </div>
          )}

          {showDetails &&
            typeof error === 'object' &&
            'originalError' in error &&
            error.originalError && (
              <div className="mt-3">
                <button
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                  className={`text-xs font-medium ${config.textColor} hover:underline flex items-center gap-1`}
                >
                  {t('errors.actions.viewDetails')}
                  <svg
                    className={`w-3 h-3 transition-transform ${detailsExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {detailsExpanded && (
                  <pre
                    className={`mt-2 text-xs ${config.textColor} bg-white/50 dark:bg-black/20 rounded p-2 overflow-auto max-h-32`}
                  >
                    {error.originalError}
                  </pre>
                )}
              </div>
            )}

          <div className="flex gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className={`px-3 py-1.5 text-xs font-medium rounded ${
                  config.color === 'red'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : config.color === 'orange'
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : config.color === 'yellow'
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : config.color === 'purple'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : config.color === 'blue'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-600 hover:bg-gray-700 text-white'
                } transition-colors`}
              >
                {t('errors.actions.retry')}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`px-3 py-1.5 text-xs font-medium rounded border ${config.borderColor} ${config.textColor} hover:bg-white/50 dark:hover:bg-black/20 transition-colors`}
              >
                {t('errors.actions.dismiss')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function detectCategory(errorCode: string | null): ErrorCategory {
  if (!errorCode) return 'unknown';

  if (errorCode.includes('MICROPHONE')) return 'microphone';
  if (errorCode.includes('WEBSOCKET')) return 'websocket';
  if (
    errorCode.includes('AUDIO') ||
    errorCode.includes('RECORDING') ||
    errorCode.includes('PLAYBACK')
  )
    return 'audio';
  if (
    errorCode.includes('STT') ||
    errorCode.includes('AI') ||
    errorCode.includes('TTS') ||
    errorCode.includes('API')
  )
    return 'api';
  if (errorCode.includes('SESSION')) return 'session';
  if (errorCode.includes('NETWORK') || errorCode.includes('TIMEOUT')) return 'network';

  return 'unknown';
}
