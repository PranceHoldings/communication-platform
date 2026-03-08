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
  settings?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
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
}

/**
 * 認証完了メッセージ（サーバー → クライアント）
 */
export interface AuthenticatedMessage extends WebSocketMessageBase {
  type: 'authenticated';
  message: string;
  sessionId: string;
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
  partIndex: number;
  totalParts: number;
  data: string; // Base64 encoded
  timestamp: number;
}

/**
 * ビデオチャンク確認メッセージ（サーバー → クライアント）
 */
export interface VideoChunkAckMessage extends WebSocketMessageBase {
  type: 'video_chunk_ack';
  chunkId?: string;
  chunksReceived: number;
  timestamp: number;
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
 */
export interface AvatarResponseMessage extends WebSocketMessageBase {
  type: 'avatar_response';
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
 * Pongメッセージ（サーバー → クライアント）
 */
export interface PongMessage extends WebSocketMessageBase {
  type: 'pong';
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
  | PingMessage;

/**
 * サーバーからクライアントへのメッセージ（Union型）
 */
export type ServerToClientMessage =
  | AuthenticatedMessage
  | VideoChunkAckMessage
  | TranscriptMessage
  | AvatarResponseMessage
  | AudioResponseMessage
  | ProcessingUpdateMessage
  | VideoReadyMessage
  | SessionCompleteMessage
  | ErrorMessage
  | PongMessage
  | VersionMessage;
