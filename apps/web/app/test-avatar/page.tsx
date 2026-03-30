'use client';

import { useState } from 'react';
import { AvatarRenderer } from '@/components/avatar';

export default function TestAvatarPage() {
  const [lipSync, setLipSync] = useState(0);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          Avatar Renderer Test
        </h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">3D Avatar</h2>
          <div className="bg-black rounded-lg overflow-hidden">
            <AvatarRenderer
              type="THREE_D"
              modelUrl="/models/avatars/test-model.glb"
              width={1280}
              height={720}
              lipSyncIntensity={lipSync}
              emotion="neutral"
              onReady={() => console.log('[TestAvatar] Avatar ready')}
            />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Controls</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-white mb-2">
                Lip Sync Intensity: {lipSync.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={lipSync}
                onChange={(e) => setLipSync(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setLipSync(0)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Silent
              </button>
              <button
                onClick={() => setLipSync(0.5)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Talking (50%)
              </button>
              <button
                onClick={() => setLipSync(1)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Shouting (100%)
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Model Info</h2>
          <div className="text-gray-300 space-y-2">
            <p><strong>Model:</strong> test-model.glb (Flamingo)</p>
            <p><strong>Size:</strong> 76 KB</p>
            <p><strong>Format:</strong> GLTF/GLB</p>
            <p><strong>Source:</strong> Three.js Examples</p>
          </div>
        </div>
      </div>
    </div>
  );
}
