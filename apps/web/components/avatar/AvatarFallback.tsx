'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/provider';

interface AvatarFallbackProps {
  width?: number;
  height?: number;
  error?: Error;
  showDetails?: boolean;
}

/**
 * AvatarFallback - Fallback UI when avatar fails to render
 *
 * Displays a simple placeholder when the 3D/2D avatar cannot be loaded or rendered.
 * This ensures the session player remains functional even if avatar rendering fails.
 */
export function AvatarFallback({
  width = 1280,
  height = 720,
  error,
  showDetails = false,
}: AvatarFallbackProps) {
  const { t } = useI18n();

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: '8px',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      {/* Avatar Icon Placeholder */}
      <div
        style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          fontSize: '60px',
        }}
      >
        👤
      </div>

      {/* Message */}
      <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: 'bold' }}>
        {t('avatars.fallback.title')}
      </h3>
      <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
        {t('avatars.fallback.message')}
      </p>

      {/* Error Details (dev mode) */}
      {showDetails && error && (
        <details
          style={{
            marginTop: '20px',
            padding: '10px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '4px',
            fontSize: '12px',
            textAlign: 'left',
            maxWidth: '80%',
          }}
        >
          <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
            {t('avatars.fallback.errorDetails')}
          </summary>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {error.message}
          </pre>
        </details>
      )}
    </div>
  );
}
