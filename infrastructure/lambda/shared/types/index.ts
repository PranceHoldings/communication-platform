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

export * from '@prance/shared';

// ========================================
// JWT関連
// ========================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER';
  orgId: string; // Aligned with Prisma schema
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
