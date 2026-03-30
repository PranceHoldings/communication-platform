/**
 * APIレスポンス生成ユーティリティ
 *
 * CRITICAL: ALL Lambda functions MUST use these utilities.
 * Direct response construction is FORBIDDEN.
 */

import { APIResponse, SuccessResponse, ErrorResponse, AppError, PaginationMeta } from '../types';
import {
  StandardLambdaResponse,
  StandardSuccessResponse,
  validateResponseStructure,
} from '../types/api-response';

/**
 * 共通ヘッダー
 */
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

/**
 * 成功レスポンスを生成
 *
 * ENFORCED: Returns StandardLambdaResponse<T> type
 * Runtime validation in dev mode
 */
export const successResponse = <T>(data: T, statusCode = 200): StandardLambdaResponse<T> => {
  const response: StandardSuccessResponse<T> = {
    success: true,
    data,
  };

  // Runtime validation in dev mode
  if (process.env.ENVIRONMENT === 'dev' || process.env.NODE_ENV === 'development') {
    validateResponseStructure(response);
  }

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(response),
  };
};

/**
 * エラーレスポンスを生成 (オーバーロード)
 */
export function errorResponse(
  error: AppError | Error,
  statusCode?: number
): APIResponse<ErrorResponse>;
export function errorResponse(
  statusCode: number,
  message: string,
  details?: string
): APIResponse<ErrorResponse>;
export function errorResponse(
  errorOrStatusCode: AppError | Error | number,
  statusCodeOrMessage?: number | string,
  details?: string
): APIResponse<ErrorResponse> {
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let errorDetails: any;
  let finalStatusCode = 500;

  // 新しい形式: errorResponse(new AppError(...))
  if (typeof errorOrStatusCode === 'object') {
    const error = errorOrStatusCode;
    if (error instanceof AppError) {
      code = error.code;
      message = error.message;
      errorDetails = error.details;
      finalStatusCode = error.statusCode;
    } else if (error instanceof Error) {
      message = error.message;
    }
    if (typeof statusCodeOrMessage === 'number') {
      finalStatusCode = statusCodeOrMessage;
    }
  }
  // 古い形式: errorResponse(401, 'Unauthorized')
  else if (typeof errorOrStatusCode === 'number') {
    finalStatusCode = errorOrStatusCode;
    message = typeof statusCodeOrMessage === 'string' ? statusCodeOrMessage : message;
    if (details) {
      errorDetails = details;
    }

    // コードを自動設定
    if (finalStatusCode === 400) code = 'VALIDATION_ERROR';
    else if (finalStatusCode === 401) code = 'AUTHENTICATION_ERROR';
    else if (finalStatusCode === 403) code = 'AUTHORIZATION_ERROR';
    else if (finalStatusCode === 404) code = 'NOT_FOUND';
    else if (finalStatusCode === 409) code = 'CONFLICT';
    else if (finalStatusCode === 500) code = 'INTERNAL_SERVER_ERROR';
  }

  // 本番環境ではスタックトレースを隠す
  if (process.env.ENVIRONMENT !== 'dev') {
    delete errorDetails?.stack;
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(errorDetails && { details: errorDetails }),
    },
  };

  // エラーログ出力
  console.error('Error Response:', {
    code,
    message,
    statusCode: finalStatusCode,
    ...(typeof errorOrStatusCode === 'object' &&
      errorOrStatusCode instanceof Error && { stack: errorOrStatusCode.stack }),
  });

  return {
    statusCode: finalStatusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(response),
  };
}

/**
 * ページネーションレスポンスを生成
 */
export const paginatedResponse = <T>(
  items: T[],
  total: number,
  limit: number,
  offset: number
): APIResponse => {
  const pagination: PaginationMeta = {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };

  return successResponse({
    items,
    pagination,
  });
};

/**
 * リソース作成成功レスポンス
 */
export const createdResponse = <T>(data: T): APIResponse<SuccessResponse<T>> => {
  return successResponse(data, 201);
};

/**
 * リソース削除成功レスポンス
 */
export const deletedResponse = (): APIResponse => {
  return successResponse({ message: 'Resource deleted successfully' }, 204);
};

/**
 * OPTIONSリクエストへのレスポンス（CORS preflight）
 */
export const corsResponse = (): APIResponse => {
  return {
    statusCode: 200,
    headers: DEFAULT_HEADERS,
    body: '',
  };
};
