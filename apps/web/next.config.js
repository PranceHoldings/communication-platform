/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Standalone build for Lambda deployment (SSR enabled)
  output: 'standalone',

  // 実験的機能
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

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

  // Webpack設定（Three.js対応）
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
};

module.exports = nextConfig;
