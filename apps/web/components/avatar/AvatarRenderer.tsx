'use client';

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ThreeDAvatar } from './ThreeDAvatar';
import type { AvatarEmotion } from '@/lib/avatar/blendshape-controller';

export type AvatarType = 'TWO_D' | 'THREE_D' | 'STATIC_IMAGE';

export interface AvatarRendererProps {
  type: AvatarType;
  modelUrl?: string;
  imageUrl?: string;
  width?: number;
  height?: number;
  lipSyncIntensity?: number; // 0.0-1.0
  emotion?: AvatarEmotion;
  onReady?: () => void;
}

export interface AvatarRendererRef {
  getCanvas: () => HTMLCanvasElement | null;
  setLipSync: (intensity: number) => void;
  setEmotion: (emotion: AvatarEmotion) => void;
}

/**
 * AvatarRenderer - Unified avatar rendering interface
 *
 * Supports multiple avatar types:
 * - THREE_D: 3D GLTF models with blendshapes
 * - TWO_D: Live2D models (future implementation)
 * - STATIC_IMAGE: Static images
 *
 * Usage:
 * ```tsx
 * const avatarRef = useRef<AvatarRendererRef>(null);
 *
 * <AvatarRenderer
 *   ref={avatarRef}
 *   type="THREE_D"
 *   modelUrl="/models/avatar.glb"
 *   lipSyncIntensity={0.5}
 *   emotion="happy"
 * />
 * ```
 */
export const AvatarRenderer = forwardRef<AvatarRendererRef, AvatarRendererProps>(
  (
    {
      type,
      modelUrl,
      imageUrl,
      width = 1280,
      height = 720,
      lipSyncIntensity = 0,
      emotion = 'neutral',
      onReady,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [currentLipSync, setCurrentLipSync] = useState(lipSyncIntensity);
    const [currentEmotion, setCurrentEmotion] = useState<AvatarEmotion>(emotion);

    // Update state when props change
    useEffect(() => {
      setCurrentLipSync(lipSyncIntensity);
    }, [lipSyncIntensity]);

    useEffect(() => {
      setCurrentEmotion(emotion);
    }, [emotion]);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      setLipSync: (intensity: number) => setCurrentLipSync(intensity),
      setEmotion: (newEmotion: AvatarEmotion) => setCurrentEmotion(newEmotion),
    }));

    // Extract canvas from Three.js renderer
    const handleThreeDReady = useCallback(() => {
      if (containerRef.current) {
        const threeCanvas = containerRef.current.querySelector('canvas');
        if (threeCanvas) {
          canvasRef.current = threeCanvas;
          console.log('[AvatarRenderer] Three.js canvas extracted:', {
            width: threeCanvas.width,
            height: threeCanvas.height,
          });
        }
      }
      onReady?.();
    }, [onReady]);

    // Render based on avatar type
    if (type === 'THREE_D') {
      return (
        <div ref={containerRef} style={{ width, height }}>
          <ThreeDAvatar
            modelUrl={modelUrl || '/models/default-avatar.glb'}
            width={width}
            height={height}
            lipSyncData={currentLipSync}
            emotion={currentEmotion}
            onReady={handleThreeDReady}
            autoRotate={false}
          />
        </div>
      );
    }

    if (type === 'TWO_D') {
      // Live2D implementation (future)
      return (
        <div
          ref={containerRef}
          style={{
            width,
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a1a',
            color: 'white',
          }}
        >
          <div>Live2D Avatar (Not implemented yet)</div>
        </div>
      );
    }

    if (type === 'STATIC_IMAGE') {
      // Static image avatar
      return (
        <div ref={containerRef} style={{ width, height, position: 'relative' }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Avatar"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onLoad={onReady}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#2a2a2a',
                color: 'white',
              }}
            >
              No image provided
            </div>
          )}
        </div>
      );
    }

    // Fallback
    return (
      <div
        ref={containerRef}
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a1a',
          color: 'white',
        }}
      >
        Unknown avatar type: {type}
      </div>
    );
  }
);

AvatarRenderer.displayName = 'AvatarRenderer';
