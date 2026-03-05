/**
 * 共通型定義
 * すべてのLambda関数で使用される型
 */

// ========================================
// JWT関連
// ========================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'super_admin' | 'client_admin' | 'client_user';
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
  role: 'super_admin' | 'client_admin' | 'client_user';
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// アバター関連
// ========================================

export interface Avatar {
  id: string;
  name: string;
  type: '2d' | '3d';
  thumbnailUrl: string;
  modelUrl: string;
  voiceSettings: object;
  description: string;
}

// ========================================
// シナリオ関連
// ========================================

export interface Scenario {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  topics: string[];
  evaluationCriteria: object;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
}

// ========================================
// セッション関連
// ========================================

export interface Session {
  id: string;
  userId: string;
  avatarId: string;
  scenarioId: string;
  status: 'created' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date | null;
  endedAt: Date | null;
  duration: number | null;
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
  type: 'user' | 'avatar' | 'merged';
  url: string;
  duration: number;
  createdAt: Date;
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
