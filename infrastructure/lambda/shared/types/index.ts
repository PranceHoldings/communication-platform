/**
 * 共通型定義
 * すべてのLambda関数で使用される型
 *
 * NOTE: これらの型はPrismaスキーマと整合性を保つ必要があります
 * スキーマ: packages/database/prisma/schema.prisma
 */

// ========================================
// JWT関連
// ========================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER';
  organizationId: string;
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
// ユーザー関連
// ========================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER';
  organizationId: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

// ========================================
// アバター関連
// ========================================

export interface Avatar {
  id: string;
  name: string;
  type: 'TWO_D' | 'THREE_D';
  style: 'ANIME' | 'REALISTIC';
  source: 'PRESET' | 'GENERATED' | 'ORG_CUSTOM';
  thumbnailUrl: string | null;
  modelUrl: string;
  configJson: object | null;
  tags: string[];
  visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
  createdAt: Date;
}

// ========================================
// シナリオ関連
// ========================================

export interface Scenario {
  id: string;
  title: string;
  category: string;
  language: string;
  visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
  configJson: object;
  createdAt: Date;
}

// ========================================
// セッション関連
// ========================================

export interface Session {
  id: string;
  userId: string;
  orgId: string;
  avatarId: string;
  scenarioId: string;
  status: 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number | null;
  metadataJson: object | null;
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
// 録画関連
// ========================================

export interface Recording {
  id: string;
  sessionId: string;
  type: 'USER' | 'AVATAR' | 'COMBINED';
  s3Url: string;
  cdnUrl: string | null;
  thumbnailUrl: string | null;
  fileSizeBytes: bigint;
  createdAt: Date;
}

// ========================================
// 書き起こし関連
// ========================================

export interface Transcript {
  id: string;
  sessionId: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestampStart: number;
  timestampEnd: number;
  confidence: number | null;
  highlight: 'POSITIVE' | 'NEGATIVE' | 'IMPORTANT' | null;
}

// ========================================
// エラー関連
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
  constructor(message = 'Internal server error') {
    super(500, 'INTERNAL_SERVER_ERROR', message);
  }
}
