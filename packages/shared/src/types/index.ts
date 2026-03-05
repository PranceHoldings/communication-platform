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
    public code: string,
    public statusCode: number,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super('AUTHENTICATION_ERROR', 401, message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super('AUTHORIZATION_ERROR', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', 404, `${resource} not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: string) {
    super('VALIDATION_ERROR', 400, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super('CONFLICT', 409, message);
  }
}
