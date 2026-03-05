/**
 * APIレスポンス生成ユーティリティ
 */

import { APIResponse, SuccessResponse, ErrorResponse, AppError } from '../types';

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
 */
export const successResponse = <T>(data: T, statusCode = 200): APIResponse<SuccessResponse<T>> => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(response),
  };
};

/**
 * エラーレスポンスを生成
 */
export const errorResponse = (
  error: AppError | Error,
  statusCode?: number
): APIResponse<ErrorResponse> => {
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any;
  let finalStatusCode = statusCode || 500;

  if (error instanceof AppError) {
    code = error.code;
    message = error.message;
    details = error.details;
    finalStatusCode = error.statusCode;
  } else if (error instanceof Error) {
    message = error.message;
  }

  // 本番環境ではスタックトレースを隠す
  if (process.env.ENVIRONMENT !== 'dev') {
    delete details?.stack;
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  // エラーログ出力
  console.error('Error Response:', {
    code,
    message,
    statusCode: finalStatusCode,
    ...(error instanceof Error && { stack: error.stack }),
  });

  return {
    statusCode: finalStatusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(response),
  };
};

/**
 * ページネーションレスポンスを生成
 */
export const paginatedResponse = <T>(
  items: T[],
  total: number,
  limit: number,
  offset: number
): APIResponse => {
  return successResponse({
    items,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
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
