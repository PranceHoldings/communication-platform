/**
 * GLTF Model Loader for 3D Avatars
 *
 * Utility functions for loading and preparing GLTF/GLB models
 * for use with Three.js avatars.
 */

import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

/**
 * Avatar model metadata
 */
export interface AvatarModelInfo {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  meshes: THREE.Mesh[];
  morphTargetMeshes: THREE.Mesh[];
  morphTargetNames: string[];
  bounds: THREE.Box3;
}

/**
 * Load a GLTF/GLB model from URL
 *
 * @param url - URL to the GLTF/GLB file
 * @param onProgress - Optional progress callback
 * @returns Promise resolving to avatar model info
 */
export async function loadGLTFModel(
  url: string,
  onProgress?: (progress: number) => void
): Promise<AvatarModelInfo> {
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf: GLTF) => {
        const info = extractModelInfo(gltf);
        console.log('[GLTFLoader] Model loaded successfully:', {
          url,
          meshes: info.meshes.length,
          morphTargetMeshes: info.morphTargetMeshes.length,
          animations: info.animations.length,
        });
        resolve(info);
      },
      (xhr) => {
        if (onProgress && xhr.total > 0) {
          const progress = (xhr.loaded / xhr.total) * 100;
          onProgress(progress);
        }
      },
      (error) => {
        console.error('[GLTFLoader] Failed to load model:', url, error);
        reject(error);
      }
    );
  });
}

/**
 * Extract model information from loaded GLTF
 */
function extractModelInfo(gltf: GLTF): AvatarModelInfo {
  const meshes: THREE.Mesh[] = [];
  const morphTargetMeshes: THREE.Mesh[] = [];
  const morphTargetNames = new Set<string>();

  // Traverse scene to find meshes
  gltf.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshes.push(child);

      // Check if mesh has morph targets
      if (child.morphTargetDictionary && Object.keys(child.morphTargetDictionary).length > 0) {
        morphTargetMeshes.push(child);
        Object.keys(child.morphTargetDictionary).forEach((name) => morphTargetNames.add(name));
      }
    }
  });

  // Calculate bounding box
  const bounds = new THREE.Box3().setFromObject(gltf.scene);

  return {
    scene: gltf.scene,
    animations: gltf.animations || [],
    meshes,
    morphTargetMeshes,
    morphTargetNames: Array.from(morphTargetNames).sort(),
    bounds,
  };
}

/**
 * Center and scale model to fit in a unit box
 *
 * @param scene - The model scene to transform
 * @param targetHeight - Target height in world units (default: 1.8 for ~human height)
 */
export function normalizeModelScale(scene: THREE.Group, targetHeight: number = 1.8): void {
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  bounds.getSize(size);

  // Calculate scale to match target height
  const scale = targetHeight / size.y;
  scene.scale.setScalar(scale);

  // Center model at origin
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
}

/**
 * Enable shadows for all meshes in the scene
 */
export function enableShadows(scene: THREE.Group): void {
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/**
 * Default avatar model URLs (fallback models)
 */
export const DEFAULT_AVATAR_MODELS = {
  male: '/models/avatars/male-default.glb',
  female: '/models/avatars/female-default.glb',
  robot: '/models/avatars/robot-default.glb',
  anime: '/models/avatars/anime-default.glb',
} as const;

/**
 * Check if model has required morph targets for expressions
 */
export function validateAvatarModel(info: AvatarModelInfo): {
  isValid: boolean;
  hasLipSync: boolean;
  hasEmotions: boolean;
  missingTargets: string[];
} {
  const requiredLipSyncTargets = ['mouthOpen', 'jawOpen'];
  const requiredEmotionTargets = ['mouthSmile', 'mouthFrown', 'browInnerUp'];

  const hasLipSync = requiredLipSyncTargets.some((target) =>
    info.morphTargetNames.includes(target)
  );

  const hasEmotions = requiredEmotionTargets.some((target) =>
    info.morphTargetNames.includes(target)
  );

  const missingTargets = [...requiredLipSyncTargets, ...requiredEmotionTargets].filter(
    (target) => !info.morphTargetNames.includes(target)
  );

  return {
    isValid: info.morphTargetMeshes.length > 0,
    hasLipSync,
    hasEmotions,
    missingTargets,
  };
}
