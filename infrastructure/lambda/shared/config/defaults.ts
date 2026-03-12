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
// Language Defaults
// ============================================================
//
// 注意: より詳細な言語設定は language-config.ts を参照してください
// - normalizeLanguageCode(): 言語コード正規化（'ja' → 'ja-JP'）
// - getLanguagePriority(): 自動検出の優先順位リスト取得
// - LANGUAGE_MAP: ISO 639-1 → BCP-47 マッピング
// - REGIONAL_PRIORITY: 地域別優先順位
// ============================================================

export const LANGUAGE_DEFAULTS = {
  // ============================================================
  // 言語設定（@prance/shared から動的に取得）
  // ============================================================
  //
  // 重要: 言語設定は packages/shared/src/language/index.ts で一元管理されています。
  //
  // 新言語追加時のフロー:
  // 1. packages/shared/src/language/index.ts の LANGUAGES 配列に追加
  // 2. apps/web/messages/{languageCode}.json を作成（UI翻訳用）
  // 3. デプロイ - コード変更不要！
  //
  // Phase 2以降:
  // - スーパー管理者UIから言語リソースをアップロード
  // - S3に保存 + CloudFront経由で配信
  // - 1-5分でホットデプロイ（リビルド不要）
  //
  // ============================================================

  // STT固定言語（非推奨・後方互換性のみ）
  // 注意: 実際の使用では getLanguagePriority(scenarioLanguage) を使用すること
  STT_LANGUAGE: 'ja-JP', // Deprecated: 自動言語検出を使用

  // デフォルトフォールバック言語（@prance/shared から取得）
  // 動的取得: import { DEFAULT_FALLBACK_LANGUAGES } from '@prance/shared'
  get STT_AUTO_DETECT_LANGUAGES_DEFAULT() {
    // NOTE: この getter は後方互換性のため
    // 実際の使用では language-config.ts の DEFAULT_FALLBACK_LANGUAGES を直接 import すること
    return ['ja-JP', 'en-US'] as const;
  },

  // サポートされている言語コード（ISO 639-1形式）
  // シナリオで使用される言語コード: 'ja', 'en', 'zh-CN', 'zh-TW', etc.
  SUPPORTED_LANGUAGES: ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it'] as const,

  // デフォルトのシナリオ言語
  // 実際の使用: import { getBaseLanguageCode } from '@prance/shared'
  get SCENARIO_LANGUAGE() {
    // NOTE: この getter は後方互換性のため
    return 'ja';
  },
} as const;

// ============================================================
// Media Format Defaults
// ============================================================

export const MEDIA_DEFAULTS = {
  // 動画設定
  VIDEO_FORMAT: 'webm',
  VIDEO_RESOLUTION: '1280x720',
  VIDEO_CONTENT_TYPE: 'video/webm',

  // 音声設定
  AUDIO_FORMAT: 'webm',
  AUDIO_CONTENT_TYPE: 'audio/webm',

  // 録画設定
  DEFAULT_CHUNK_DURATION_MS: 250, // MediaRecorderのtimeslice
} as const;

// ============================================================
// DynamoDB Defaults
// ============================================================

export const DYNAMODB_DEFAULTS = {
  // ビデオチャンクロックのTTL（秒）
  // Phase D: 5分 (300秒) → 2分 (120秒) に最適化
  VIDEO_LOCK_TTL_SECONDS: 120, // 2 minutes

  // WebSocket接続のTTL（秒）
  CONNECTION_TTL_SECONDS: 3600 * 4, // 4 hours
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
  LANGUAGE: LANGUAGE_DEFAULTS,
  MEDIA: MEDIA_DEFAULTS,
  DYNAMODB: DYNAMODB_DEFAULTS,
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
