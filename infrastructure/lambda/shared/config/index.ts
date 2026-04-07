/**
 * Configuration Module
 *
 * すべての環境変数を一元管理
 * デフォルト値は defaults.ts で定義
 */

import {
  AWS_DEFAULTS,
  BEDROCK_DEFAULTS,
  REKOGNITION_DEFAULTS,
  POLLY_DEFAULTS,
  ELEVENLABS_DEFAULTS,
  AZURE_SPEECH_DEFAULTS,
  AZURE_TTS_DEFAULTS,
  CLOUDFRONT_DEFAULTS,
  JWT_DEFAULTS,
  APP_DEFAULTS,
  getEnv,
  getRequiredEnv,
  getOptionalEnv,
} from './defaults';

// ============================================================
// AWS Configuration
// ============================================================

export const AWS_CONFIG = {
  get REGION() { return getEnv('AWS_REGION', AWS_DEFAULTS.REGION); },
  get ACCOUNT_ID() { return getOptionalEnv('AWS_ACCOUNT_ID', AWS_DEFAULTS.ACCOUNT_ID); },
};

// ============================================================
// AWS Bedrock Configuration
// ============================================================

export const BEDROCK_CONFIG = {
  get REGION() { return getEnv('BEDROCK_REGION', BEDROCK_DEFAULTS.REGION); },
  get MODEL_ID() { return getEnv('BEDROCK_MODEL_ID', BEDROCK_DEFAULTS.MODEL_ID); },
};

// ============================================================
// AWS Rekognition Configuration
// ============================================================

export const REKOGNITION_CONFIG = {
  get REGION() { return getEnv('REKOGNITION_REGION', REKOGNITION_DEFAULTS.REGION); },
};

// ============================================================
// AWS Polly Configuration
// ============================================================

export const POLLY_CONFIG = {
  get REGION() { return getEnv('POLLY_REGION', POLLY_DEFAULTS.REGION); },
  get VOICE_ID() { return getEnv('POLLY_VOICE_ID', POLLY_DEFAULTS.VOICE_ID); },
  get ENGINE() { return getEnv('POLLY_ENGINE', POLLY_DEFAULTS.ENGINE); },
};

// ============================================================
// ElevenLabs Configuration
// ============================================================

export const ELEVENLABS_CONFIG = {
  get API_KEY() { return getRequiredEnv('ELEVENLABS_API_KEY'); },
  get VOICE_ID() { return getRequiredEnv('ELEVENLABS_VOICE_ID'); },
  get MODEL_ID() { return getEnv('ELEVENLABS_MODEL_ID', ELEVENLABS_DEFAULTS.MODEL_ID); },
};

// ============================================================
// Azure Speech Services Configuration (STT + TTS)
// ============================================================

export const AZURE_SPEECH_CONFIG = {
  get KEY() { return getRequiredEnv('AZURE_SPEECH_KEY'); },
  get REGION() { return getEnv('AZURE_SPEECH_REGION', AZURE_SPEECH_DEFAULTS.REGION); },
};

export const AZURE_TTS_CONFIG = {
  get VOICE_NAME() { return getEnv('AZURE_TTS_VOICE_NAME', AZURE_TTS_DEFAULTS.VOICE_NAME); },
};

// ============================================================
// CloudFront Configuration
// ============================================================

export const CLOUDFRONT_CONFIG = {
  get DOMAIN() { return getOptionalEnv('CLOUDFRONT_DOMAIN', CLOUDFRONT_DEFAULTS.DOMAIN); },
  get KEY_PAIR_ID() { return getOptionalEnv('CLOUDFRONT_KEY_PAIR_ID', CLOUDFRONT_DEFAULTS.KEY_PAIR_ID); },
  get PRIVATE_KEY() { return getOptionalEnv('CLOUDFRONT_PRIVATE_KEY', CLOUDFRONT_DEFAULTS.PRIVATE_KEY); },
};

// ============================================================
// JWT Configuration
// ============================================================

export const JWT_CONFIG = {
  get SECRET() { return getRequiredEnv('JWT_SECRET'); },
  get ACCESS_TOKEN_EXPIRES_IN() {
    return getEnv('JWT_ACCESS_TOKEN_EXPIRES_IN', JWT_DEFAULTS.ACCESS_TOKEN_EXPIRES_IN);
  },
  get REFRESH_TOKEN_EXPIRES_IN() {
    return getEnv('JWT_REFRESH_TOKEN_EXPIRES_IN', JWT_DEFAULTS.REFRESH_TOKEN_EXPIRES_IN);
  },
};

// ============================================================
// Application Configuration
// ============================================================

export const APP_CONFIG = {
  get ENVIRONMENT() { return getEnv('ENVIRONMENT', 'development'); },
  get LOG_LEVEL() { return getEnv('LOG_LEVEL', APP_DEFAULTS.LOG_LEVEL); },
  get NODE_ENV() { return getEnv('NODE_ENV', APP_DEFAULTS.NODE_ENV); },
};

// ============================================================
// WebSocket Configuration
// ============================================================

export const WEBSOCKET_CONFIG = {
  get ENDPOINT() { return getRequiredEnv('WEBSOCKET_ENDPOINT'); },
  get CONNECTIONS_TABLE_NAME() { return getRequiredEnv('CONNECTIONS_TABLE_NAME'); },
};

// ============================================================
// Storage Configuration
// ============================================================

export const STORAGE_CONFIG = {
  get S3_BUCKET() { return getRequiredEnv('S3_BUCKET'); },
};

// ============================================================
// Feature Flags
// ============================================================

export const FEATURE_FLAGS = {
  get ENABLE_AUTO_ANALYSIS() { return getEnv('ENABLE_AUTO_ANALYSIS', 'false') === 'true'; },
  get STT_AUTO_DETECT_LANGUAGES() { return getOptionalEnv('STT_AUTO_DETECT_LANGUAGES', ''); },
};

// ============================================================
// すべての設定を統合
// ============================================================

export const CONFIG = {
  AWS: AWS_CONFIG,
  BEDROCK: BEDROCK_CONFIG,
  REKOGNITION: REKOGNITION_CONFIG,
  POLLY: POLLY_CONFIG,
  ELEVENLABS: ELEVENLABS_CONFIG,
  AZURE_SPEECH: AZURE_SPEECH_CONFIG,
  AZURE_TTS: AZURE_TTS_CONFIG,
  CLOUDFRONT: CLOUDFRONT_CONFIG,
  JWT: JWT_CONFIG,
  APP: APP_CONFIG,
  WEBSOCKET: WEBSOCKET_CONFIG,
  STORAGE: STORAGE_CONFIG,
  FEATURES: FEATURE_FLAGS,
};

// ============================================================
// Convenience Getters (duplication management - 2026-03-22)
// ============================================================

export function getAwsRegion(): string {
  return AWS_CONFIG.REGION;
}

export function getBedrockRegion(): string {
  return BEDROCK_CONFIG.REGION;
}

export function getConnectionsTableName(): string {
  return WEBSOCKET_CONFIG.CONNECTIONS_TABLE_NAME;
}

export function getEnableAutoAnalysis(): boolean {
  return FEATURE_FLAGS.ENABLE_AUTO_ANALYSIS;
}

export function getSttAutoDetectLanguages(): string[] {
  const languages = FEATURE_FLAGS.STT_AUTO_DETECT_LANGUAGES;
  if (!languages || languages.trim() === '') {
    return [];
  }
  return languages.split(',').map(lang => lang.trim());
}

// ============================================================
// エクスポート（後方互換性のため）
// ============================================================

export default CONFIG;
