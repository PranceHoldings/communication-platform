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

export const LANGUAGE_DEFAULTS = {
  // ============================================================
  // Phase 1: 最小限のデフォルト値（フォールバック用）
  // ============================================================

  // STT固定言語（非推奨・後方互換性のみ）
  STT_LANGUAGE: 'en-US', // Deprecated: 自動言語検出を使用すること

  // STT自動言語検出デフォルト候補（Phase 1: 日本語・英語のみ）
  // 注意: これはフォールバック値です。実際の候補言語は以下から取得すべき:
  //   1. 環境変数 STT_AUTO_DETECT_LANGUAGES（カンマ区切り）
  //   2. 組織設定（Phase 2以降）
  //   3. システムに登録された言語リソースから動的生成（Phase 2以降）
  STT_AUTO_DETECT_LANGUAGES_DEFAULT: ['ja-JP', 'en-US'] as const,

  // サポートされている言語コード（Phase 1）
  // 注意: STT_AUTO_DETECT_LANGUAGES_DEFAULTを参照（DRY原則）
  get SUPPORTED_LANGUAGES() {
    return this.STT_AUTO_DETECT_LANGUAGES_DEFAULT;
  },

  // デフォルトのシナリオ言語
  // 注意: 最初のサポート言語から自動的に決定（DRY原則）
  get SCENARIO_LANGUAGE() {
    // 'ja-JP' -> 'ja' に変換
    return this.STT_AUTO_DETECT_LANGUAGES_DEFAULT[0].split('-')[0];
  },

  // ============================================================
  // Phase 2以降の実装方針（重要）
  // ============================================================
  //
  // 新言語追加時の正しいフロー:
  // 1. 言語リソースファイル追加: apps/web/messages/{code}.json
  // 2. リソースファイルにメタデータ含める:
  //    {
  //      "meta": {
  //        "languageCode": "zh",
  //        "sttCode": "zh-CN",
  //        "displayName": "中文"
  //      },
  //      "common": { ... }
  //    }
  // 3. このファイルは変更しない（ハードコード禁止）
  // 4. システムが自動的に言語を認識
  //
  // または:
  // 1. スーパー管理者UIから言語リソースをアップロード
  // 2. S3に保存 + CloudFront経由で配信
  // 3. 1-5分でホットデプロイ（リビルド不要）
  //
  // STT候補言語の決定方法（Phase 2以降）:
  // - デフォルト: システムに登録されたすべての言語
  // - 組織設定: 組織が選択した言語のみ（パフォーマンス最適化）
  // - 推奨: 2-4言語（Azure自動検出の精度が最適）
  //
  // ============================================================
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
