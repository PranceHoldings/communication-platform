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
  REGION: process.env.AWS_REGION || 'us-east-1',
  ACCOUNT_ID: '',
} as const;

// ============================================================
// AWS Bedrock (Claude AI) Defaults
// ============================================================

export const BEDROCK_DEFAULTS = {
  REGION: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1',
  MODEL_ID: 'us.anthropic.claude-sonnet-4-6',
} as const;

// ============================================================
// AWS Rekognition Defaults
// ============================================================

export const REKOGNITION_DEFAULTS = {
  REGION: process.env.REKOGNITION_REGION || process.env.AWS_REGION || 'us-east-1',
} as const;

// ============================================================
// AWS Polly (TTS Fallback) Defaults
// ============================================================

export const POLLY_DEFAULTS = {
  REGION: process.env.POLLY_REGION || process.env.AWS_REGION || 'us-east-1',
  VOICE_ID: 'Mizuki',
  ENGINE: 'neural',
} as const;

// ============================================================
// ElevenLabs (TTS - Legacy, replaced by Azure TTS) Defaults
// ============================================================

export const ELEVENLABS_DEFAULTS = {
  MODEL_ID: 'eleven_flash_v2_5',
  VOICE_ID: '',
  API_KEY: '',
} as const;

// ============================================================
// Azure Speech Services (STT + TTS) Defaults
// ============================================================

export const AZURE_SPEECH_DEFAULTS = {
  REGION: 'eastus',
  KEY: '',
} as const;

// Azure TTS voice names (Neural voices, high quality)
// Japanese: ja-JP-NanamiNeural (F), ja-JP-KeitaNeural (M)
// English:  en-US-JennyNeural (F), en-US-GuyNeural (M)
export const AZURE_TTS_DEFAULTS = {
  VOICE_NAME: 'ja-JP-NanamiNeural', // Default: Japanese female neural voice
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
// Query & Processing Defaults
// ============================================================

export const QUERY_DEFAULTS = {
  // Database query limits
  MAX_RESULTS: 1000, // Maximum rows to return from database queries

  // Batch processing sizes
  VIDEO_CHUNK_BATCH_SIZE: 5, // Batch size for video chunk processing
  ANALYSIS_BATCH_SIZE: 10, // Batch size for analysis operations
} as const;

// ============================================================
// Security Defaults
// ============================================================

export const SECURITY_DEFAULTS = {
  // Password hashing
  BCRYPT_SALT_ROUNDS: 10, // bcrypt salt rounds for password/PIN hashing

  // Rate limiting (defined in rateLimiter.ts, values here for reference)
  RATE_LIMIT_MAX_ATTEMPTS: 5,
  RATE_LIMIT_LOCKOUT_DURATION_MS: 600000, // 10 minutes
  RATE_LIMIT_ATTEMPT_WINDOW_MS: 600000, // 10 minutes
} as const;

// ============================================================
// Audio Processing Defaults
// ============================================================

export const AUDIO_PROCESSING_DEFAULTS = {
  // Speech analysis
  MIN_PAUSE_DURATION_SEC: 0.5, // Minimum pause duration to detect
  OPTIMAL_PAUSE_SEC: 0.8, // Optimal pause duration for scoring

  // TTS voice settings (ElevenLabs)
  TTS_STABILITY: 0.5, // Voice stability (0.0 - 1.0)
  TTS_SIMILARITY_BOOST: 0.75, // Voice similarity boost (0.0 - 1.0)

  // STT confidence
  DEFAULT_STT_CONFIDENCE: 0.95, // Default confidence when not provided

  // Sample rates
  AUDIO_SAMPLE_RATE: 16000, // 16kHz for speech
  SILENCE_THRESHOLD: 0.15, // Silence detection threshold (0.0 - 1.0)
} as const;

// ============================================================
// AI Processing Defaults
// ============================================================

export const AI_DEFAULTS = {
  // Claude AI settings
  CLAUDE_TEMPERATURE: 0.7, // Temperature for text generation (0.0 - 1.0)
  CLAUDE_MAX_TOKENS: 1024, // Maximum tokens for completion

  // Language detection
  MAX_AUTO_DETECT_LANGUAGES: 4, // Maximum number of languages for auto-detection
} as const;

// ============================================================
// Score Calculation Defaults
// ============================================================

export const SCORE_DEFAULTS = {
  // Score weights
  EMOTION_WEIGHT: 0.25,
  AUDIO_WEIGHT: 0.25,
  CONTENT_WEIGHT: 0.3,
  DELIVERY_WEIGHT: 0.2,

  // Quality thresholds
  MIN_CONFIDENCE_THRESHOLD: 70, // Minimum confidence for valid analysis (0-100)
  MIN_QUALITY_THRESHOLD: 85, // Minimum quality threshold (0-100)
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
  QUERY: QUERY_DEFAULTS,
  SECURITY: SECURITY_DEFAULTS,
  AUDIO_PROCESSING: AUDIO_PROCESSING_DEFAULTS,
  AI: AI_DEFAULTS,
  SCORE: SCORE_DEFAULTS,
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
