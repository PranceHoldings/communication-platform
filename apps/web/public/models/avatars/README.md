# Avatar Models Directory

This directory contains 3D avatar models in GLTF/GLB format.

## Required Models

Place your avatar models here:

- `male-default.glb` - Default male avatar
- `female-default.glb` - Default female avatar
- `robot-default.glb` - Default robot avatar
- `anime-default.glb` - Default anime-style avatar

## Model Requirements

### File Format
- **GLTF 2.0** or **GLB** (binary GLTF)
- Textures embedded or in same directory

### Blendshapes (Morph Targets)

#### Required for Lip Sync:
- `mouthOpen` or `jawOpen` - Mouth opening
- `mouthClose` - Mouth closing (optional)

#### Required for Emotions:
- `mouthSmile` - Happy expression
- `mouthFrown` - Sad expression
- `browInnerUp` - Surprised/worried
- `browDown` - Angry expression

#### ARKit-compatible Blendshapes (Recommended):
The avatar should ideally support [ARKit Face Tracking blendshapes](https://arkit-face-blendshapes.com/) for best compatibility:

**Mouth:**
- mouthClose, mouthFunnel, mouthPucker
- mouthLeft, mouthRight
- mouthSmileLeft, mouthSmileRight
- mouthFrownLeft, mouthFrownRight
- mouthDimpleLeft, mouthDimpleRight
- mouthStretchLeft, mouthStretchRight
- mouthRollLower, mouthRollUpper
- mouthShrugLower, mouthShrugUpper
- mouthPressLeft, mouthPressRight
- mouthLowerDownLeft, mouthLowerDownRight
- mouthUpperUpLeft, mouthUpperUpRight

**Jaw:**
- jawOpen, jawForward, jawLeft, jawRight

**Cheek:**
- cheekPuff, cheekSquintLeft, cheekSquintRight

**Nose:**
- noseSneerLeft, noseSneerRight

**Brow:**
- browDownLeft, browDownRight
- browInnerUp
- browOuterUpLeft, browOuterUpRight

**Eye:**
- eyeBlinkLeft, eyeBlinkRight
- eyeSquintLeft, eyeSquintRight
- eyeWideLeft, eyeWideRight
- eyeLookDownLeft, eyeLookDownRight
- eyeLookInLeft, eyeLookInRight
- eyeLookOutLeft, eyeLookOutRight
- eyeLookUpLeft, eyeLookUpRight

## Recommended Tools

### Creating/Editing Models:
- **Blender** (Free, Open Source) - https://www.blender.org/
- **Ready Player Me** (Free avatars) - https://readyplayer.me/
- **Character Creator 4** (Commercial) - https://www.reallusion.com/

### Testing Models:
- **Three.js Editor** - https://threejs.org/editor/
- **glTF Viewer** - https://gltf-viewer.donmccurdy.com/

### Optimizing Models:
- **gltfpack** - https://github.com/zeux/meshoptimizer
- **Blender glTF Export** with compression options

## Example: Ready Player Me

To get a free avatar with blendshapes:

1. Go to https://readyplayer.me/
2. Create an avatar (customizable)
3. Export as GLB with "Morph Targets" enabled
4. Place the GLB file in this directory
5. Update the avatar configuration in the application

## License

Ensure you have the rights to use any 3D models placed in this directory.
Default models should be properly licensed for commercial use if applicable.
