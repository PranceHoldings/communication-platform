/**
 * Lambda固有型定義
 * Lambda関数特有の型（JWT, API Gateway レスポンス等）
 *
 * NOTE: 共有型は @prance/shared からimportしてください
 * - User, Avatar, Scenario, Session, Recording, Transcript
 * - エラークラス (AppError, ValidationError, etc.)
 * - Pagination 型
 */

// ========================================
// Re-export shared types for convenience
// ========================================

// Note: @prance/shared cannot be imported in Lambda bundling context
// All shared types that Lambda needs should be defined here or copied
// For language types, see ../config/language-config.ts

// Export organization types
export * from './organization';

// Export API response types (ENFORCED)
export * from './api-response';

// ========================================
// Enum Types (Prisma Schema aligned)
// ========================================

export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';
export type AvatarType = 'TWO_D' | 'THREE_D';
export type AvatarStyle = 'ANIME' | 'REALISTIC';
export type AvatarSource = 'PRESET' | 'GENERATED' | 'ORG_CUSTOM';
export type Visibility = 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
export type SessionStatus = 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
export type RecordingType = 'USER' | 'AVATAR' | 'COMBINED';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
export type Speaker = 'AI' | 'USER';
export type Highlight = 'POSITIVE' | 'NEGATIVE' | 'IMPORTANT';

// Runtime Configuration Access Levels
export type RuntimeConfigAccessLevel =
  | 'DEVELOPER_ONLY'
  | 'SUPER_ADMIN_READ_ONLY'
  | 'SUPER_ADMIN_READ_WRITE'
  | 'CLIENT_ADMIN_READ_WRITE'
  | 'CLIENT_ADMIN_READ_ONLY';

// ========================================
// Error Types (copied from @prance/shared)
// ========================================

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
  constructor(message = 'Internal server error', details?: any) {
    super(500, 'INTERNAL_SERVER_ERROR', message, details);
  }
}

// ========================================
// JWT関連
// ========================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole; // Enum type from Prisma schema
  orgId: string; // Aligned with Prisma schema

  // ✅ ゲストユーザー対応フィールド（オプション）
  type?: 'user' | 'guest'; // ユーザータイプ識別
  guestSessionId?: string; // ゲストセッションID
  sessionId?: string; // 紐づくセッションID

  iat?: number;
  exp?: number;
}

// ========================================
// API Gateway関連
// ========================================

export interface APIResponse<T = any> {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// ========================================
// WebSocket関連
// ========================================

export interface WebSocketMessage {
  action: 'message' | 'ai-response' | 'status';
  sessionId: string;
  content?: {
    type: 'text' | 'audio';
    data: string;
  };
  response?: {
    text: string;
    audioUrl: string;
    visemeData: object;
  };
}

// ========================================
// Pagination Types (copied from @prance/shared)
// ========================================

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

// ========================================
// Enum Types (from Prisma schema)
// ========================================

export enum Visibility {
  PRIVATE = 'PRIVATE',
  ORGANIZATION = 'ORGANIZATION',
  PUBLIC = 'PUBLIC',
}

// ========================================
// Scenario Validation Types (Day 36)
// ========================================

export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ScenarioValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ========================================
// WebSocket Message Types (Day 36)
// ========================================

export interface SessionLimitReachedMessage {
  type: 'session_limit_reached';
  message: string;
  turnCount: number;
  maxTurns: number;
  sessionId: string;
  timestamp: number;
}

export interface AIFallbackMessage {
  type: 'ai_fallback';
  message: string;
  originalError: string;
  usedFallback: boolean;
  sessionId: string;
  timestamp: number;
}
