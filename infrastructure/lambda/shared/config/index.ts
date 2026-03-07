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
  REGION: getEnv('AWS_REGION', AWS_DEFAULTS.REGION),
  ACCOUNT_ID: getOptionalEnv('AWS_ACCOUNT_ID', AWS_DEFAULTS.ACCOUNT_ID),
} as const;

// ============================================================
// AWS Bedrock Configuration
// ============================================================

export const BEDROCK_CONFIG = {
  REGION: getEnv('BEDROCK_REGION', BEDROCK_DEFAULTS.REGION),
  MODEL_ID: getEnv('BEDROCK_MODEL_ID', BEDROCK_DEFAULTS.MODEL_ID),
} as const;

// ============================================================
// AWS Rekognition Configuration
// ============================================================

export const REKOGNITION_CONFIG = {
  REGION: getEnv('REKOGNITION_REGION', REKOGNITION_DEFAULTS.REGION),
} as const;

// ============================================================
// AWS Polly Configuration
// ============================================================

export const POLLY_CONFIG = {
  REGION: getEnv('POLLY_REGION', POLLY_DEFAULTS.REGION),
  VOICE_ID: getEnv('POLLY_VOICE_ID', POLLY_DEFAULTS.VOICE_ID),
  ENGINE: getEnv('POLLY_ENGINE', POLLY_DEFAULTS.ENGINE),
} as const;

// ============================================================
// ElevenLabs Configuration
// ============================================================

export const ELEVENLABS_CONFIG = {
  API_KEY: getRequiredEnv('ELEVENLABS_API_KEY'),
  VOICE_ID: getRequiredEnv('ELEVENLABS_VOICE_ID'),
  MODEL_ID: getEnv('ELEVENLABS_MODEL_ID', ELEVENLABS_DEFAULTS.MODEL_ID),
} as const;

// ============================================================
// Azure Speech Services Configuration
// ============================================================

export const AZURE_SPEECH_CONFIG = {
  KEY: getRequiredEnv('AZURE_SPEECH_KEY'),
  REGION: getEnv('AZURE_SPEECH_REGION', AZURE_SPEECH_DEFAULTS.REGION),
} as const;

// ============================================================
// CloudFront Configuration
// ============================================================

export const CLOUDFRONT_CONFIG = {
  DOMAIN: getOptionalEnv('CLOUDFRONT_DOMAIN', CLOUDFRONT_DEFAULTS.DOMAIN),
  KEY_PAIR_ID: getOptionalEnv('CLOUDFRONT_KEY_PAIR_ID', CLOUDFRONT_DEFAULTS.KEY_PAIR_ID),
  PRIVATE_KEY: getOptionalEnv('CLOUDFRONT_PRIVATE_KEY', CLOUDFRONT_DEFAULTS.PRIVATE_KEY),
} as const;

// ============================================================
// JWT Configuration
// ============================================================

export const JWT_CONFIG = {
  SECRET: getRequiredEnv('JWT_SECRET'),
  ACCESS_TOKEN_EXPIRES_IN: getEnv('JWT_ACCESS_TOKEN_EXPIRES_IN', JWT_DEFAULTS.ACCESS_TOKEN_EXPIRES_IN),
  REFRESH_TOKEN_EXPIRES_IN: getEnv('JWT_REFRESH_TOKEN_EXPIRES_IN', JWT_DEFAULTS.REFRESH_TOKEN_EXPIRES_IN),
} as const;

// ============================================================
// Application Configuration
// ============================================================

export const APP_CONFIG = {
  ENVIRONMENT: getEnv('ENVIRONMENT', 'development'),
  LOG_LEVEL: getEnv('LOG_LEVEL', APP_DEFAULTS.LOG_LEVEL),
  NODE_ENV: getEnv('NODE_ENV', APP_DEFAULTS.NODE_ENV),
} as const;

// ============================================================
// WebSocket Configuration
// ============================================================

export const WEBSOCKET_CONFIG = {
  ENDPOINT: getRequiredEnv('WEBSOCKET_ENDPOINT'),
  CONNECTIONS_TABLE_NAME: getRequiredEnv('CONNECTIONS_TABLE_NAME'),
} as const;

// ============================================================
// Storage Configuration
// ============================================================

export const STORAGE_CONFIG = {
  S3_BUCKET: getRequiredEnv('S3_BUCKET'),
} as const;

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
  CLOUDFRONT: CLOUDFRONT_CONFIG,
  JWT: JWT_CONFIG,
  APP: APP_CONFIG,
  WEBSOCKET: WEBSOCKET_CONFIG,
  STORAGE: STORAGE_CONFIG,
} as const;

// ============================================================
// エクスポート（後方互換性のため）
// ============================================================

export default CONFIG;
