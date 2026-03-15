/**
 * 共通型定義（Prismaスキーマベース）
 *
 * 注意: APIレスポンスでは、Lambda関数が一部のフィールドをマッピングしています。
 * - durationSec → duration
 * - metadataJson → metadata
 * - startedAt → createdAt (互換性のため)
 */

// ============================================================
// Enums（Prismaスキーマと完全一致）
// ============================================================

export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER';

export type AvatarType = 'TWO_D' | 'THREE_D';

export type AvatarStyle = 'ANIME' | 'REALISTIC';

export type AvatarSource = 'PRESET' | 'GENERATED' | 'ORG_CUSTOM';

export type Visibility = 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';

export type SessionStatus = 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export type RecordingType = 'USER' | 'AVATAR' | 'COMBINED';

export type Speaker = 'AI' | 'USER';

export type Highlight = 'POSITIVE' | 'NEGATIVE' | 'IMPORTANT';

// ============================================================
// 組織・ユーザー
// ============================================================

export interface Organization {
  id: string;
  name: string;
  settings?: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

// 組織の設定（AI & Audio のグローバルデフォルト）
export interface OrganizationSettings {
  // AI Response Behavior
  enableSilencePrompt?: boolean; // 無音時に会話を促す
  silenceTimeout?: number; // 無音待機時間（秒）- ユーザー発話終了検出用
  silencePromptTimeout?: number; // AI会話促し待機時間（秒）- AIプロンプト発動用
  silencePromptStyle?: 'formal' | 'casual' | 'neutral'; // 促し言葉のトーン
  showSilenceTimer?: boolean; // UIに無音タイマーを表示

  // Audio Detection Settings
  silenceThreshold?: number; // 音量閾値（0.01-0.2）
  minSilenceDuration?: number; // 最小無音継続時間（ms）
  initialSilenceTimeout?: number; // Azure STT初期無音タイムアウト（ms、3000-15000、組織設定のみ）
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash?: string;
  cognitoSub?: string;
  profileJson?: Record<string, unknown>;
  preferencesJson?: Record<string, unknown>;
  createdAt: Date;
  lastLoginAt?: Date;
}

// ============================================================
// アバター
// ============================================================

export interface Avatar {
  id: string;
  userId?: string;
  orgId: string;
  name: string;
  type: AvatarType;
  style: AvatarStyle;
  source: AvatarSource;
  modelUrl: string;
  thumbnailUrl?: string;
  configJson?: Record<string, unknown>;
  tags: string[];
  visibility: Visibility;
  allowCloning: boolean;
  createdAt: Date;
}

// ============================================================
// シナリオ
// ============================================================

export interface Scenario {
  id: string;
  userId?: string;
  orgId: string;
  title: string;
  category: string;
  language: string;
  visibility: Visibility;
  configJson: Record<string, unknown>;
  createdAt: Date;

  // 無音時間管理（Silence Management）
  initialGreeting?: string; // AI初回挨拶テキスト
  silenceTimeout?: number; // 無音タイマー（秒）
  enableSilencePrompt?: boolean; // 無音促し有効/無効
  showSilenceTimer?: boolean; // UIにタイマー表示
  silenceThreshold?: number; // 音量閾値（0.01-0.2）
  minSilenceDuration?: number; // 最小無音継続時間（ms）
}

// ============================================================
// セッション
// ============================================================

export interface Session {
  id: string;
  userId: string;
  orgId: string;
  scenarioId: string;
  avatarId: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt?: Date;
  durationSec?: number; // API では "duration" としてレスポンス
  metadataJson?: Record<string, unknown>; // API では "metadata" としてレスポンス
}

// ============================================================
// 録画
// ============================================================

export interface Recording {
  id: string;
  sessionId: string;
  type: RecordingType;
  s3Url: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  fileSizeBytes: bigint;
  createdAt: Date;
}

// ============================================================
// トランスクリプト
// ============================================================

export interface Transcript {
  id: string;
  sessionId: string;
  speaker: Speaker;
  text: string;
  timestampStart: number;
  timestampEnd: number;
  confidence?: number;
  highlight?: Highlight;
}

// ============================================================
// エラー型
// ============================================================

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(401, 'AUTHENTICATION_ERROR', message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(403, 'AUTHORIZATION_ERROR', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(500, 'INTERNAL_SERVER_ERROR', message);
  }
}

// ============================================================
// ページネーション
// ============================================================

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ============================================================
// WebSocket Messages（フロントエンド・バックエンド共有型）
// ============================================================

/**
 * WebSocketメッセージのベース型
 */
export interface WebSocketMessageBase {
  type: string;
  timestamp?: number;
}

/**
 * 認証メッセージ（クライアント → サーバー）
 */
export interface AuthenticateMessage extends WebSocketMessageBase {
  type: 'authenticate';
  sessionId: string;
  scenarioPrompt?: string; // Optional: System prompt from scenario configJson
  scenarioLanguage?: string; // Optional: Scenario language ('ja', 'en', etc.)
  initialGreeting?: string; // Optional: Initial AI greeting text from scenario
  silenceTimeout?: number; // Optional: Silence timeout in seconds from scenario
  enableSilencePrompt?: boolean; // Optional: Enable silence prompt from scenario
  silenceThreshold?: number; // Optional: Audio level threshold (0.0-1.0) to detect speech vs silence
  minSilenceDuration?: number; // Optional: Minimum silence duration in milliseconds to trigger speech_end
}

/**
 * 認証完了メッセージ（サーバー → クライアント）
 */
export interface AuthenticatedMessage extends WebSocketMessageBase {
  type: 'authenticated';
  message: string;
  sessionId: string;
  initialGreeting?: string; // Optional: Initial AI greeting text
  silenceTimeout?: number; // Optional: Silence timeout in seconds
  enableSilencePrompt?: boolean; // Optional: Enable silence prompt
  silenceThreshold?: number; // Optional: Audio level threshold (0.0-1.0) to detect speech vs silence
  minSilenceDuration?: number; // Optional: Minimum silence duration in milliseconds to trigger speech_end
}

/**
 * 音声チャンクメッセージ（クライアント → サーバー）
 */
export interface AudioChunkMessage extends WebSocketMessageBase {
  type: 'audio_chunk';
  data: string; // Base64 encoded
  timestamp: number;
}

/**
 * ビデオチャンクパートメッセージ（クライアント → サーバー）
 */
export interface VideoChunkPartMessage extends WebSocketMessageBase {
  type: 'video_chunk_part';
  chunkId: string;
  sequenceNumber: number; // Global sequence number for gap detection
  partIndex: number;
  totalParts: number;
  data: string; // Base64 encoded
  hash: string; // SHA-256 hash (hex) for integrity validation
  timestamp: number;
}

/**
 * 音声パート確認メッセージ（サーバー → クライアント）
 */
export interface AudioPartAckMessage extends WebSocketMessageBase {
  type: 'audio_part_ack';
  chunkId: string;
  partsReceived: number;
  totalParts: number;
}

/**
 * ビデオチャンク確認メッセージ（サーバー → クライアント）
 */
export interface VideoChunkAckMessage extends WebSocketMessageBase {
  type: 'video_chunk_ack';
  chunkId: string;
  sequenceNumber: number; // Acknowledged sequence number
  chunksReceived: number;
  timestamp: number;
}

/**
 * ビデオチャンク欠損通知メッセージ（サーバー → クライアント）
 */
export interface VideoChunkMissingMessage extends WebSocketMessageBase {
  type: 'video_chunk_missing';
  missingSequences: number[];
}

/**
 * ビデオチャンクエラーメッセージ（サーバー → クライアント）
 */
export interface VideoChunkErrorMessage extends WebSocketMessageBase {
  type: 'video_chunk_error';
  chunkId: string;
  error: 'HASH_MISMATCH' | 'SEQUENCE_ERROR' | 'STORAGE_ERROR';
  message: string;
}

/**
 * トランスクリプトメッセージ（サーバー → クライアント）
 */
export interface TranscriptMessage extends WebSocketMessageBase {
  type: 'transcript_partial' | 'transcript_final';
  speaker: Speaker;
  text: string;
  timestamp_start?: number;
  confidence?: number;
}

/**
 * アバター応答メッセージ（サーバー → クライアント）
 * Phase 1.5: Supports streaming with partial/final message types
 */
export interface AvatarResponseMessage extends WebSocketMessageBase {
  type: 'avatar_response' | 'avatar_response_partial' | 'avatar_response_final';
  speaker: 'AI';
  text: string;
  timestamp: number;
}

/**
 * 音声応答メッセージ（サーバー → クライアント）
 */
export interface AudioResponseMessage extends WebSocketMessageBase {
  type: 'audio_response';
  audioUrl?: string;
  audio?: string; // Base64 encoded (legacy)
  audioKey?: string;
  contentType: string;
  timestamp: number;
}

/**
 * TTSストリーミング音声チャンクメッセージ（サーバー → クライアント）
 * Phase 1.5 Day 6-7: Real-time TTS streaming
 */
export interface TTSAudioChunkMessage extends WebSocketMessageBase {
  type: 'audio_chunk';
  audio: string; // Base64 encoded MP3 chunk
  isFinal: boolean;
  timestamp: number;
}

/**
 * 処理状況更新メッセージ（サーバー → クライアント）
 */
export interface ProcessingUpdateMessage extends WebSocketMessageBase {
  type: 'processing_update';
  stage: string;
  progress: number;
  chunksReceived?: number;
}

/**
 * ビデオ準備完了メッセージ（サーバー → クライアント）
 */
export interface VideoReadyMessage extends WebSocketMessageBase {
  type: 'video_ready';
  videoUrl: string;
  videoKey: string;
  videoSize: number;
  processingDuration: number;
}

/**
 * セッション完了メッセージ（サーバー → クライアント）
 */
export interface SessionCompleteMessage extends WebSocketMessageBase {
  type: 'session_complete';
  sessionId?: string;
  message: string;
}

/**
 * エラーメッセージ（サーバー → クライアント）
 */
export interface ErrorMessage extends WebSocketMessageBase {
  type: 'error';
  code: string;
  message: string;
  details?: string;
  chunkId?: string;
  partIndex?: number;
}

/**
 * セッション終了メッセージ（クライアント → サーバー）
 */
export interface SessionEndMessage extends WebSocketMessageBase {
  type: 'session_end';
}

/**
 * ユーザー発話メッセージ（クライアント → サーバー）
 */
export interface UserSpeechMessage extends WebSocketMessageBase {
  type: 'user_speech';
  text: string;
  timestamp: number;
  confidence: number;
}

/**
 * Pingメッセージ（クライアント → サーバー）
 */
export interface PingMessage extends WebSocketMessageBase {
  type: 'ping';
}

/**
 * 無音促しリクエストメッセージ（クライアント → サーバー）
 */
export interface SilencePromptRequestMessage extends WebSocketMessageBase {
  type: 'silence_prompt_request';
}

/**
 * Pongメッセージ（サーバー → クライアント）
 */
export interface PongMessage extends WebSocketMessageBase {
  type: 'pong';
  timestamp: number;
}

/**
 * 音声未検出メッセージ（サーバー → クライアント）
 * エラーではなく、ユーザーへの案内として使用
 */
export interface NoSpeechDetectedMessage extends WebSocketMessageBase {
  type: 'no_speech_detected';
  message: string;
  timestamp: number;
}

/**
 * バージョン情報メッセージ（サーバー → クライアント）
 */
export interface VersionMessage extends WebSocketMessageBase {
  type: 'version';
  version: string;
  name: string;
  runtime?: string;
  audioProcessing?: {
    volume: string;
    compressor: string;
    sttAutoDetect: boolean;
    languages: string[];
  };
}

/**
 * クライアントからサーバーへのメッセージ（Union型）
 */
export type ClientToServerMessage =
  | AuthenticateMessage
  | AudioChunkMessage
  | VideoChunkPartMessage
  | SessionEndMessage
  | UserSpeechMessage
  | SilencePromptRequestMessage
  | PingMessage;

/**
 * サーバーからクライアントへのメッセージ（Union型）
 */
export type ServerToClientMessage =
  | AuthenticatedMessage
  | AudioPartAckMessage
  | VideoChunkAckMessage
  | VideoChunkMissingMessage
  | VideoChunkErrorMessage
  | TranscriptMessage
  | AvatarResponseMessage
  | AudioResponseMessage
  | TTSAudioChunkMessage
  | ProcessingUpdateMessage
  | VideoReadyMessage
  | SessionCompleteMessage
  | ErrorMessage
  | NoSpeechDetectedMessage
  | PongMessage
  | VersionMessage;

// ============================================================
// 感情・表情解析
// ============================================================

export interface EmotionScore {
  type: string; // 'HAPPY', 'SAD', 'ANGRY', 'CONFUSED', 'DISGUSTED', 'SURPRISED', 'CALM', 'FEAR'
  confidence: number; // 0-100
}

export interface AgeRange {
  low: number;
  high: number;
}

export interface Pose {
  pitch: number; // 上下の傾き (-90 to 90)
  roll: number; // 回転 (-180 to 180)
  yaw: number; // 左右の向き (-90 to 90)
}

export interface EmotionAnalysis {
  id: string;
  sessionId: string;
  recordingId?: string;
  timestamp: number; // セッション開始からの秒数
  frameUrl?: string; // 解析に使用したフレームのS3 URL

  // AWS Rekognition - Emotions
  emotions: EmotionScore[]; // [{ type: 'HAPPY', confidence: 95.5 }, ...]
  dominantEmotion?: string; // 最も強い感情

  // AWS Rekognition - Face Details
  ageRange?: AgeRange; // { low: 25, high: 32 }
  gender?: string; // 'Male' | 'Female'
  genderConfidence?: number;

  // AWS Rekognition - Face Quality
  eyesOpen?: boolean;
  eyesOpenConfidence?: number;
  mouthOpen?: boolean;
  mouthOpenConfidence?: number;

  // AWS Rekognition - Pose (Head orientation)
  pose?: Pose;

  // Overall quality
  confidence: number;
  brightness?: number;
  sharpness?: number;

  // Processing metadata
  processingTimeMs?: number;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * 感情解析サマリー
 */
export interface EmotionAnalysisSummary {
  averageEmotions: { [emotion: string]: number }; // 平均感情スコア
  dominantEmotionFrequency: { [emotion: string]: number }; // 支配的感情の出現頻度
  totalFrames: number;
  successfulFrames: number;
  failedFrames: number;
  averageConfidence: number;
}

/**
 * セッション感情解析結果
 */
export interface SessionEmotionAnalysis {
  sessionId: string;
  analyses: EmotionAnalysis[];
  summary: EmotionAnalysisSummary;
}

// ============================================================
// 音声特徴解析
// ============================================================

/**
 * 音声特徴量
 */
export interface AudioFeatures {
  pitch?: number; // 平均ピッチ (Hz)
  pitchVariance?: number; // ピッチの分散
  volume?: number; // 平均音量 (dB)
  volumeVariance?: number; // 音量の分散
  speakingRate?: number; // 話速 (words per minute)
  pauseCount?: number; // ポーズ回数
  pauseDuration?: number; // 平均ポーズ時間 (秒)
  clarity?: number; // 音声の明瞭度 (0-1)
  snr?: number; // Signal-to-Noise Ratio (dB)
}

/**
 * フィラー語情報
 */
export interface FillerWordsInfo {
  words: string[]; // 検出されたフィラー語のリスト
  count: number; // 合計出現回数
  frequency: { [word: string]: number }; // 各フィラー語の出現回数
}

/**
 * 音声解析結果
 */
export interface AudioAnalysis {
  id: string;
  sessionId: string;
  transcriptId?: string;
  timestamp: number; // セッション開始からの秒数

  // 音声特徴量
  pitch?: number;
  pitchVariance?: number;
  volume?: number;
  volumeVariance?: number;
  speakingRate?: number;
  pauseCount?: number;
  pauseDuration?: number;

  // 音声品質
  clarity?: number;
  confidence?: number;
  snr?: number;

  // フィラー語
  fillerWords?: string[];
  fillerCount?: number;

  // メタデータ
  audioUrl?: string;
  duration?: number;
  processingTimeMs?: number;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * 音声解析サマリー
 */
export interface AudioAnalysisSummary {
  averagePitch: number;
  averageVolume: number;
  averageSpeakingRate: number;
  totalPauses: number;
  averagePauseDuration: number;
  totalFillerWords: number;
  fillerWordsFrequency: { [word: string]: number };
  averageClarity: number;
  averageConfidence: number;
  totalDuration: number;
}

/**
 * セッション音声解析結果
 */
export interface SessionAudioAnalysis {
  sessionId: string;
  analyses: AudioAnalysis[];
  summary: AudioAnalysisSummary;
}

/**
 * ポーズ情報
 */
export interface PauseInfo {
  startTime: number; // 秒
  endTime: number; // 秒
  duration: number; // 秒
}

// ============================================================
// セッションスコア
// ============================================================

/**
 * スコアリング重み
 */
export interface ScoringWeights {
  emotion: number; // 0-1 (default: 0.35)
  audio: number; // 0-1 (default: 0.35)
  content: number; // 0-1 (default: 0.20)
  delivery: number; // 0-1 (default: 0.10)
}

/**
 * スコアリング基準プリセット
 */
export type ScoringPreset = 'default' | 'interview_practice' | 'language_learning' | 'presentation' | 'custom';

/**
 * スコアリング基準
 */
export interface ScoringCriteria {
  preset: ScoringPreset;
  customWeights?: ScoringWeights;
  description?: string;
}

/**
 * 感情スコア詳細
 */
export interface EmotionScoreDetails {
  stability: number; // 感情の安定性 (0-100)
  positivity: number; // ポジティブさ (0-100)
  confidence: number; // 自信 (0-100)
  engagement: number; // エンゲージメント (0-100)
}

/**
 * 音声スコア詳細
 */
export interface AudioScoreDetails {
  clarity: number; // 明瞭さ (0-100)
  fluency: number; // 流暢さ (0-100)
  pacing: number; // ペース配分 (0-100)
  volume: number; // 音量適正 (0-100)
}

/**
 * コンテンツスコア詳細
 */
export interface ContentScoreDetails {
  relevance: number; // 関連性 (0-100)
  structure: number; // 構造 (0-100)
  completeness: number; // 完全性 (0-100)
}

/**
 * セッションスコア
 */
export interface SessionScore {
  id: string;
  sessionId: string;

  // 総合スコア
  overallScore: number; // 0-100

  // カテゴリ別スコア
  emotionScore?: number;
  audioScore?: number;
  contentScore?: number;
  deliveryScore?: number;

  // 詳細スコア（感情関連）
  emotionStability?: number;
  emotionPositivity?: number;
  confidence?: number;
  engagement?: number;

  // 詳細スコア（音声関連）
  clarity?: number;
  fluency?: number;
  pacing?: number;
  volume?: number;

  // 詳細スコア（コンテンツ関連）
  relevance?: number;
  structure?: number;
  completeness?: number;

  // 改善ポイント
  strengths?: string[];
  improvements?: string[];

  // スコアリング設定
  criteria?: ScoringCriteria;
  weights?: ScoringWeights;

  // メタデータ
  calculatedAt: Date;
  version: string;
}

/**
 * スコア計算結果
 */
export interface ScoreCalculationResult {
  overallScore: number;
  emotionScore: number;
  audioScore: number;
  contentScore: number;
  deliveryScore: number;
  emotionDetails: EmotionScoreDetails;
  audioDetails: AudioScoreDetails;
  contentDetails: ContentScoreDetails;
  strengths: string[];
  improvements: string[];
}

/**
 * スコア評価レベル
 */
export type ScoreLevel = 'excellent' | 'very_good' | 'good' | 'fair' | 'needs_improvement' | 'poor';

/**
 * スコア評価
 */
export interface ScoreAssessment {
  level: ScoreLevel;
  label: string;
  description: string;
  color: string; // For UI display
}
