'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

interface ThreeDAvatarProps {
  modelUrl?: string;
  width?: number;
  height?: number;
  onReady?: () => void;
  lipSyncData?: number;
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised';
  autoRotate?: boolean;
}

/**
 * Client-side only wrapper for ThreeDAvatar
 *
 * This component ensures Three.js is only loaded on the client side,
 * preventing SSR-related errors with WebGL and React internals.
 *
 * The dynamic import with { ssr: false } ensures that:
 * 1. Three.js Canvas is only rendered in the browser
 * 2. React's internal state is properly initialized before Three.js accesses it
 * 3. WebGL context is available (not available during SSR)
 */
export const ThreeDAvatar = dynamic<ThreeDAvatarProps>(
  () => import('./ThreeDAvatar').then((mod) => mod.ThreeDAvatar),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a1a',
          color: 'white',
        }}
      >
        <div
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(255, 255, 255, 0.3)',
              borderTop: '4px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 10px',
            }}
          />
          <div>Loading 3D Avatar...</div>
          <style jsx>{`
            @keyframes spin {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </div>
    ),
  }
) as ComponentType<ThreeDAvatarProps>;
