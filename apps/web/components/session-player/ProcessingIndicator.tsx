/**
 * Processing Indicator Component
 * Displays real-time processing status for STT, AI, and TTS operations
 */

'use client';

import { useI18n } from '@/lib/i18n/provider';

export type ProcessingStage = 'stt' | 'ai' | 'tts' | 'idle';

interface ProcessingIndicatorProps {
  stage: ProcessingStage;
  message?: string;
  className?: string;
}

export function ProcessingIndicator({ stage, message, className = '' }: ProcessingIndicatorProps) {
  const { t } = useI18n();

  if (stage === 'idle') {
    return null;
  }

  const getStageConfig = (s: ProcessingStage) => {
    switch (s) {
      case 'stt':
        return {
          icon: '🎤',
          label: t('sessions.player.processing.stt'),
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          spinnerColor: 'border-blue-600',
        };
      case 'ai':
        return {
          icon: '🤖',
          label: t('sessions.player.processing.ai'),
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          spinnerColor: 'border-purple-600',
        };
      case 'tts':
        return {
          icon: '🔊',
          label: t('sessions.player.processing.tts'),
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          spinnerColor: 'border-green-600',
        };
      default:
        return {
          icon: '⏳',
          label: t('sessions.player.processing.processing'),
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          spinnerColor: 'border-gray-600',
        };
    }
  };

  const config = getStageConfig(stage);

  return (
    <div
      className={`${config.bgColor} ${config.borderColor} border rounded-lg p-3 ${className}`}
      data-testid="processing-stage"
      role="status"
      aria-live="polite"
      aria-label={config.label}
    >
      <div className="flex items-center space-x-3">
        {/* Spinner */}
        <div className="relative">
          <div
            className={`animate-spin rounded-full h-5 w-5 border-2 border-gray-300 ${config.spinnerColor}`}
            style={{ borderTopColor: 'transparent' }}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center text-xs">
            {config.icon}
          </div>
        </div>

        {/* Label and Message */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${config.color}`}>{config.label}</div>
          {message && <div className="text-xs text-gray-600 mt-0.5 truncate">{message}</div>}
        </div>

        {/* Animated dots */}
        <div className="flex space-x-1">
          <span
            className={`inline-block w-1.5 h-1.5 ${config.bgColor.replace('50', '400')} rounded-full animate-bounce`}
            style={{ animationDelay: '0ms' }}
          ></span>
          <span
            className={`inline-block w-1.5 h-1.5 ${config.bgColor.replace('50', '400')} rounded-full animate-bounce`}
            style={{ animationDelay: '150ms' }}
          ></span>
          <span
            className={`inline-block w-1.5 h-1.5 ${config.bgColor.replace('50', '400')} rounded-full animate-bounce`}
            style={{ animationDelay: '300ms' }}
          ></span>
        </div>
      </div>
    </div>
  );
}
