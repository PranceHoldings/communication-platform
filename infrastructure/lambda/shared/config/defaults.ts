/**
 * Default Configuration Values
 *
 * すべての環境変数のデフォルト値を一元管理
 * 将来的にスーパー管理者UIでこれらの値を変更可能にする予定
 */

// ============================================================
// AWS Configuration Defaults
// ============================================================

export const AWS_DEFAULTS = {
  REGION: 'us-east-1',
  ACCOUNT_ID: '',
} as const;

// ============================================================
// AWS Bedrock (Claude AI) Defaults
// ============================================================

export const BEDROCK_DEFAULTS = {
  REGION: 'us-east-1',
  MODEL_ID: 'us.anthropic.claude-sonnet-4-6',
} as const;

// ============================================================
// AWS Rekognition Defaults
// ============================================================

export const REKOGNITION_DEFAULTS = {
  REGION: 'us-east-1',
} as const;

// ============================================================
// AWS Polly (TTS Fallback) Defaults
// ============================================================

export const POLLY_DEFAULTS = {
  REGION: 'us-east-1',
  VOICE_ID: 'Mizuki',
  ENGINE: 'neural',
} as const;

// ============================================================
// ElevenLabs (TTS Primary) Defaults
// ============================================================

export const ELEVENLABS_DEFAULTS = {
  MODEL_ID: 'eleven_flash_v2_5',
  VOICE_ID: '',
  API_KEY: '',
} as const;

// ============================================================
// Azure Speech Services (STT) Defaults
// ============================================================

export const AZURE_SPEECH_DEFAULTS = {
  REGION: 'eastus',
  KEY: '',
} as const;

// ============================================================
// CloudFront Defaults
// ============================================================

export const CLOUDFRONT_DEFAULTS = {
  DOMAIN: '',
  KEY_PAIR_ID: '',
  PRIVATE_KEY: '',
} as const;

// ============================================================
// JWT Defaults
// ============================================================

export const JWT_DEFAULTS = {
  ACCESS_TOKEN_EXPIRES_IN: '24h',
  REFRESH_TOKEN_EXPIRES_IN: '30d',
} as const;

// ============================================================
// Application Defaults
// ============================================================

export const APP_DEFAULTS = {
  LOG_LEVEL: 'INFO',
  NODE_ENV: 'production',
} as const;

// ============================================================
// すべてのデフォルト値を統合
// ============================================================

export const ALL_DEFAULTS = {
  AWS: AWS_DEFAULTS,
  BEDROCK: BEDROCK_DEFAULTS,
  REKOGNITION: REKOGNITION_DEFAULTS,
  POLLY: POLLY_DEFAULTS,
  ELEVENLABS: ELEVENLABS_DEFAULTS,
  AZURE_SPEECH: AZURE_SPEECH_DEFAULTS,
  CLOUDFRONT: CLOUDFRONT_DEFAULTS,
  JWT: JWT_DEFAULTS,
  APP: APP_DEFAULTS,
} as const;

// ============================================================
// 環境変数取得ヘルパー関数
// ============================================================

/**
 * 環境変数を取得（デフォルト値付き）
 */
export function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * 必須環境変数を取得（未設定の場合はエラー）
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * 環境変数を取得（デフォルト値付き、オプショナル）
 */
export function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}
