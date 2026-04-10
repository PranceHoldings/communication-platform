/** @type {import('next').NextConfig} */

// Load environment variables from monorepo root
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const nextConfig = {
  reactStrictMode: true,

  // Lambda deployment requires standalone output
  output: 'standalone',

  // Fix workspace root detection (prevents deep nesting due to /Users/ken/package-lock.json)
  outputFileTracingRoot: path.resolve(__dirname, '../../'),

  // 実験的機能
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Transpile packages from monorepo
  transpilePackages: ['@react-three/drei', 'detect-gpu'],

  // 画像最適化
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '**.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'models.readyplayer.me',
      },
    ],
  },

  // TypeScript設定
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint設定
  eslint: {
    dirs: ['app', 'components', 'lib', 'hooks'],
    ignoreDuringBuilds: true, // ビルド時にESLintエラーを無視
  },

  // 環境変数
  env: {
    NEXT_PUBLIC_APP_NAME: 'Prance Communication Platform',
    NEXT_PUBLIC_APP_VERSION: '0.1.0-alpha',
  },

  // Webpack設定（Three.js対応 + System Error -35対策）
  webpack: (config, { isServer }) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];

    // ファイルウォッチャーの範囲制限（System Error -35対策）
    if (!isServer && config.watchOptions) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/playwright-report/**',
          '**/test-results/**',
          '**/test-output/**',
        ],
      };
    }

    return config;
  },
};

module.exports = nextConfig;
