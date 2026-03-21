'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  modelUrl?: string;
  width?: number;
  height?: number;
  onReady?: () => void;
  lipSyncData?: number; // 0.0-1.0, current lip sync intensity
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised';
  autoRotate?: boolean;
}

interface AvatarModelProps {
  modelUrl: string;
  lipSyncData?: number;
  emotion?: string;
  onReady?: () => void;
}

/**
 * AvatarModel - GLTF model loader and blendshape controller
 */
function AvatarModel({ modelUrl, lipSyncData = 0, emotion = 'neutral', onReady }: AvatarModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [morphTargets, setMorphTargets] = useState<THREE.Mesh[]>([]);
  const gltf = useLoader(GLTFLoader, modelUrl);

  // Initialize morph targets
  useEffect(() => {
    if (!gltf) return;

    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary) {
        meshes.push(child);
        console.log('[ThreeDAvatar] Found morph target mesh:', {
          name: child.name,
          morphTargets: Object.keys(child.morphTargetDictionary),
        });
      }
    });

    setMorphTargets(meshes);
    onReady?.();
  }, [gltf, onReady]);

  // Update blendshapes based on lip sync data
  useFrame(() => {
    if (morphTargets.length === 0) return;

    morphTargets.forEach((mesh) => {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

      // Lip sync blendshapes (common names)
      const lipSyncTargets = ['mouthOpen', 'jawOpen', 'viseme_aa', 'viseme_O'];

      lipSyncTargets.forEach((targetName) => {
        const index = mesh.morphTargetDictionary[targetName];
        if (index !== undefined && mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[index] = lipSyncData;
        }
      });

      // Emotion blendshapes
      const emotionMap: Record<string, string[]> = {
        happy: ['mouthSmile', 'browInnerUp'],
        sad: ['mouthFrown', 'browDown'],
        angry: ['browDown', 'mouthFrown', 'noseSneer'],
        surprised: ['browInnerUp', 'mouthOpen', 'eyeWide'],
        neutral: [],
      };

      const emotionTargets = emotionMap[emotion] || [];

      // Reset all emotion blendshapes first
      Object.keys(mesh.morphTargetDictionary).forEach((targetName) => {
        const index = mesh.morphTargetDictionary[targetName];
        if (
          index !== undefined &&
          mesh.morphTargetInfluences &&
          !lipSyncTargets.includes(targetName)
        ) {
          // Smooth transition to 0
          mesh.morphTargetInfluences[index] *= 0.95;
        }
      });

      // Apply current emotion
      emotionTargets.forEach((targetName) => {
        const index = mesh.morphTargetDictionary[targetName];
        if (index !== undefined && mesh.morphTargetInfluences) {
          // Smooth transition to target value
          const targetValue = 0.8;
          const currentValue = mesh.morphTargetInfluences[index];
          mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
            currentValue,
            targetValue,
            0.1
          );
        }
      });
    });
  });

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} />
    </group>
  );
}

/**
 * ThreeDAvatar - 3D Avatar renderer using Three.js
 *
 * Features:
 * - GLTF model loading
 * - Blendshape-based lip sync
 * - Emotion-based facial expressions
 * - Camera controls
 *
 * Usage:
 * ```tsx
 * <ThreeDAvatar
 *   modelUrl="/models/avatar.glb"
 *   lipSyncData={0.5}
 *   emotion="happy"
 * />
 * ```
 */
export function ThreeDAvatar({
  modelUrl = '/models/default-avatar.glb',
  width = 1280,
  height = 720,
  onReady,
  lipSyncData = 0,
  emotion = 'neutral',
  autoRotate = false,
}: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleModelReady = useCallback(() => {
    console.log('[ThreeDAvatar] Model loaded successfully');
    setIsLoading(false);
    onReady?.();
  }, [onReady]);

  const handleError = useCallback((err: Error) => {
    console.error('[ThreeDAvatar] Failed to load model:', err);
    setError(err.message);
    setIsLoading(false);
  }, []);

  return (
    <div style={{ width, height, position: 'relative' }}>
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            color: 'white',
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '20px',
            borderRadius: '8px',
          }}
        >
          Loading avatar...
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            color: 'red',
            background: 'rgba(0, 0, 0, 0.9)',
            padding: '20px',
            borderRadius: '8px',
          }}
        >
          Error: {error}
        </div>
      )}

      <Canvas
        style={{ background: '#1a1a1a' }}
        gl={{ antialias: true, alpha: true }}
        onError={handleError}
      >
        <PerspectiveCamera makeDefault position={[0, 1.6, 2]} fov={50} />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <pointLight position={[-5, 5, -5]} intensity={0.5} />

        {/* Avatar Model */}
        <AvatarModel
          modelUrl={modelUrl}
          lipSyncData={lipSyncData}
          emotion={emotion}
          onReady={handleModelReady}
        />

        {/* Camera Controls */}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={1}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
    </div>
  );
}
