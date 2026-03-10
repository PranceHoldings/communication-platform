/**
 * Error Message Hook
 * Provides translated error messages for various error codes
 */

'use client';

import { useTranslations } from 'next-intl';

export interface ErrorDetails {
  code: string;
  message: string;
  originalError?: string;
}

export function useErrorMessage() {
  const t = useTranslations('errors');

  /**
   * Get user-friendly error message from error code
   */
  const getErrorMessage = (error: Error | string | ErrorDetails): string => {
    // If it's a string, return as-is
    if (typeof error === 'string') {
      return error;
    }

    // If it's an ErrorDetails object
    if ('code' in error && typeof error.code === 'string') {
      const code = error.code;

      // Microphone errors
      if (code === 'MICROPHONE_PERMISSION_DENIED') {
        return t('microphone.permissionDenied');
      }
      if (code === 'MICROPHONE_NOT_FOUND') {
        return t('microphone.notFound');
      }
      if (code === 'MICROPHONE_NOT_READABLE') {
        return t('microphone.notReadable');
      }
      if (code === 'MICROPHONE_CONSTRAINTS_ERROR') {
        return t('microphone.constraintsError');
      }
      if (code === 'MICROPHONE_ABORT_ERROR') {
        return t('microphone.abortError');
      }
      if (code === 'MICROPHONE_SECURITY_ERROR') {
        return t('microphone.securityError');
      }
      if (code === 'BROWSER_NOT_SUPPORTED') {
        return t('microphone.notSupported');
      }
      if (code === 'LOW_VOLUME') {
        return t('microphone.lowVolume');
      }
      if (code === 'NO_AUDIO_DETECTED') {
        return t('audio.noSpeechDetected');
      }

      // WebSocket errors
      if (code === 'WEBSOCKET_CONNECTION_FAILED') {
        return t('websocket.connectionFailed');
      }
      if (code === 'WEBSOCKET_CONNECTION_LOST') {
        return t('websocket.connectionLost');
      }
      if (code === 'WEBSOCKET_RECONNECT_FAILED') {
        return t('websocket.reconnectFailed', { maxAttempts: 5 });
      }
      if (code === 'WEBSOCKET_AUTH_FAILED') {
        return t('websocket.authenticationFailed');
      }
      if (code === 'WEBSOCKET_TIMEOUT') {
        return t('websocket.timeout');
      }

      // Audio processing errors
      if (code === 'AUDIO_PROCESSING_FAILED') {
        return t('audio.processingFailed');
      }
      if (code === 'RECORDING_FAILED') {
        return t('audio.recordingFailed');
      }
      if (code === 'PLAYBACK_FAILED') {
        return t('audio.playbackFailed');
      }

      // API errors
      if (code === 'STT_FAILED') {
        return t('api.sttFailed');
      }
      if (code === 'AI_FAILED') {
        return t('api.aiFailed');
      }
      if (code === 'TTS_FAILED') {
        return t('api.ttsFailed');
      }
      if (code === 'API_TIMEOUT') {
        return t('api.timeout');
      }

      // Session errors
      if (code === 'SESSION_NOT_FOUND') {
        return t('session.notFound');
      }
      if (code === 'SESSION_EXPIRED') {
        return t('session.expired');
      }
      if (code === 'SESSION_ALREADY_ACTIVE') {
        return t('session.alreadyActive');
      }
      if (code === 'SESSION_START_FAILED') {
        return t('session.startFailed');
      }
      if (code === 'SESSION_END_FAILED') {
        return t('session.endFailed');
      }

      // If code not recognized, return message field or generic error
      return error.message || t('generic');
    }

    // If it's a standard Error object
    if (error instanceof Error) {
      return error.message || t('generic');
    }

    return t('generic');
  };

  /**
   * Get browser-specific instructions for microphone permission
   */
  const getMicrophoneInstructions = (): string => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('chrome') && !userAgent.includes('edge')) {
      return t('microphone.instructions.chrome');
    }
    if (userAgent.includes('firefox')) {
      return t('microphone.instructions.firefox');
    }
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      return t('microphone.instructions.safari');
    }
    if (userAgent.includes('edg')) {
      return t('microphone.instructions.edge');
    }

    return t('microphone.instructions.chrome'); // Default to Chrome
  };

  return {
    getErrorMessage,
    getMicrophoneInstructions,
    t,
  };
}
