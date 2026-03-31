/**
 * Blendshape Controller for 3D Avatar
 *
 * Controls facial expressions and lip sync using blendshapes (morph targets).
 * Supports standard ARKit and VRM blendshape names.
 */

import * as THREE from 'three';

/**
 * Emotion types supported by the avatar
 */
export type AvatarEmotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'fearful';

/**
 * Viseme types for lip sync (based on ARKit Face Tracking)
 */
export type Viseme =
  | 'sil' // Silence
  | 'PP' // P, B, M
  | 'FF' // F, V
  | 'TH' // TH
  | 'DD' // D, T, N, L
  | 'kk' // K, G
  | 'CH' // CH, J, SH
  | 'SS' // S, Z
  | 'nn' // N, NG
  | 'RR' // R
  | 'aa' // A (open)
  | 'E' // E
  | 'I' // I
  | 'O' // O
  | 'U'; // U

/**
 * Blendshape mapping for emotions
 */
export const EMOTION_BLENDSHAPES: Record<AvatarEmotion, Record<string, number>> = {
  neutral: {},
  happy: {
    mouthSmile: 0.8,
    mouthSmileLeft: 0.8,
    mouthSmileRight: 0.8,
    browInnerUp: 0.3,
    eyeSquintLeft: 0.2,
    eyeSquintRight: 0.2,
  },
  sad: {
    mouthFrown: 0.6,
    mouthFrownLeft: 0.6,
    mouthFrownRight: 0.6,
    browDown: 0.5,
    browDownLeft: 0.5,
    browDownRight: 0.5,
    eyeSquintLeft: 0.3,
    eyeSquintRight: 0.3,
  },
  angry: {
    browDown: 0.8,
    browDownLeft: 0.8,
    browDownRight: 0.8,
    mouthFrown: 0.5,
    noseSneerLeft: 0.4,
    noseSneerRight: 0.4,
    eyeSquintLeft: 0.5,
    eyeSquintRight: 0.5,
  },
  surprised: {
    browInnerUp: 0.9,
    browOuterUpLeft: 0.9,
    browOuterUpRight: 0.9,
    mouthOpen: 0.7,
    jawOpen: 0.6,
    eyeWideLeft: 0.8,
    eyeWideRight: 0.8,
  },
  fearful: {
    browInnerUp: 0.7,
    mouthOpen: 0.4,
    eyeWideLeft: 0.9,
    eyeWideRight: 0.9,
  },
};

/**
 * Blendshape mapping for visemes (lip sync)
 */
export const VISEME_BLENDSHAPES: Record<Viseme, Record<string, number>> = {
  sil: {}, // Silence - no mouth movement
  PP: { mouthPucker: 0.8, mouthClose: 0.6 },
  FF: { mouthLowerDownLeft: 0.5, mouthLowerDownRight: 0.5, mouthUpperUp: 0.3 },
  TH: { mouthRollLower: 0.3, mouthRollUpper: 0.3, jawForward: 0.2 },
  DD: { mouthClose: 0.4, jawOpen: 0.3 },
  kk: { mouthClose: 0.3, jawOpen: 0.4 },
  CH: { mouthFunnel: 0.6, mouthPucker: 0.4 },
  SS: { mouthSmileLeft: 0.3, mouthSmileRight: 0.3, mouthClose: 0.5 },
  nn: { mouthClose: 0.6, jawOpen: 0.2 },
  RR: { mouthPucker: 0.5, jawOpen: 0.3 },
  aa: { mouthOpen: 0.8, jawOpen: 0.9 },
  E: { mouthSmileLeft: 0.6, mouthSmileRight: 0.6, jawOpen: 0.4 },
  I: { mouthSmileLeft: 0.5, mouthSmileRight: 0.5, jawOpen: 0.2 },
  O: { mouthFunnel: 0.7, jawOpen: 0.6 },
  U: { mouthPucker: 0.9, jawOpen: 0.3 },
};

/**
 * BlendshapeController - Manages avatar facial expressions
 */
export class BlendshapeController {
  private meshes: THREE.Mesh[] = [];
  private currentEmotion: AvatarEmotion = 'neutral';
  private currentViseme: Viseme = 'sil';
  private transitionSpeed: number = 0.1;

  constructor(private scene: THREE.Group) {
    this.findMorphTargetMeshes();
  }

  /**
   * Find all meshes with morph targets in the scene
   */
  private findMorphTargetMeshes(): void {
    this.meshes = [];
    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary) {
        this.meshes.push(child);
      }
    });
    console.log(`[BlendshapeController] Found ${this.meshes.length} morph target meshes`);
  }

  /**
   * Set emotion with smooth transition
   */
  public setEmotion(emotion: AvatarEmotion): void {
    this.currentEmotion = emotion;
  }

  /**
   * Set viseme for lip sync
   */
  public setViseme(viseme: Viseme): void {
    this.currentViseme = viseme;
  }

  /**
   * Set viseme from audio intensity (0.0-1.0)
   * Simplified lip sync: maps intensity to mouth open
   */
  public setLipSyncIntensity(intensity: number): void {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));

    if (clampedIntensity < 0.1) {
      this.setViseme('sil');
    } else if (clampedIntensity < 0.3) {
      this.setViseme('nn');
    } else if (clampedIntensity < 0.6) {
      this.setViseme('E');
    } else {
      this.setViseme('aa');
    }
  }

  /**
   * Update blendshapes (call this in animation loop)
   */
  public update(_deltaTime: number = 0.016): void {
    if (this.meshes.length === 0) return;

    const emotionBlendshapes = EMOTION_BLENDSHAPES[this.currentEmotion];
    const visemeBlendshapes = VISEME_BLENDSHAPES[this.currentViseme];

    this.meshes.forEach((mesh) => {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

      // Reset all blendshapes to 0 (smooth transition)
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences.forEach((_, index) => {
          if (mesh.morphTargetInfluences && mesh.morphTargetInfluences[index] !== undefined) {
            mesh.morphTargetInfluences[index] *= 1 - this.transitionSpeed;
          }
        });
      }

      // Apply emotion blendshapes
      Object.entries(emotionBlendshapes).forEach(([targetName, targetValue]) => {
        this.applyBlendshape(mesh, targetName, targetValue);
      });

      // Apply viseme blendshapes (overrides emotion for mouth)
      Object.entries(visemeBlendshapes).forEach(([targetName, targetValue]) => {
        this.applyBlendshape(mesh, targetName, targetValue);
      });
    });
  }

  /**
   * Apply a blendshape with smooth transition
   */
  private applyBlendshape(mesh: THREE.Mesh, targetName: string, targetValue: number): void {
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

    const index = mesh.morphTargetDictionary[targetName];
    if (index !== undefined) {
      const currentValue = mesh.morphTargetInfluences[index] ?? 0;
      mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
        currentValue,
        targetValue,
        this.transitionSpeed
      );
    }
  }

  /**
   * Reset all blendshapes to neutral
   */
  public reset(): void {
    this.currentEmotion = 'neutral';
    this.currentViseme = 'sil';
  }

  /**
   * Get available blendshape names for debugging
   */
  public getAvailableBlendshapes(): string[] {
    const blendshapes = new Set<string>();
    this.meshes.forEach((mesh) => {
      if (mesh.morphTargetDictionary) {
        Object.keys(mesh.morphTargetDictionary).forEach((name) => blendshapes.add(name));
      }
    });
    return Array.from(blendshapes).sort();
  }
}
