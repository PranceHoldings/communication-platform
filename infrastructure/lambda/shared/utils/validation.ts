/**
 * バリデーションユーティリティ
 */

import { ValidationError, PaginationParams } from '../types';

/**
 * メールアドレスのバリデーション
 */
export const validateEmail = (email: string): void => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
};

/**
 * パスワードのバリデーション
 * - 最低8文字
 * - 大文字・小文字・数字を含む
 */
export const validatePassword = (password: string): void => {
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }

  if (!/[a-z]/.test(password)) {
    throw new ValidationError('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    throw new ValidationError('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    throw new ValidationError('Password must contain at least one number');
  }
};

/**
 * 必須フィールドのバリデーション
 */
export const validateRequired = (value: any, fieldName: string): void => {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`);
  }
};

/**
 * UUIDフォーマットのバリデーション
 */
export const validateUUID = (value: string, fieldName = 'ID'): void => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`);
  }
};

/**
 * 列挙値のバリデーション
 */
export const validateEnum = <T>(value: T, allowedValues: T[], fieldName: string): void => {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }
};

/**
 * 数値範囲のバリデーション
 */
export const validateRange = (value: number, min: number, max: number, fieldName: string): void => {
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
  }
};

/**
 * 文字列長のバリデーション
 */
export const validateLength = (
  value: string,
  min: number,
  max: number,
  fieldName: string
): void => {
  if (value.length < min || value.length > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max} characters`);
  }
};

/**
 * ページネーションパラメータのバリデーション
 */
export const validatePagination = (
  limit?: string | number,
  offset?: string | number
): PaginationParams => {
  const parsedLimit = limit ? parseInt(String(limit), 10) : 20;
  const parsedOffset = offset ? parseInt(String(offset), 10) : 0;

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }

  if (isNaN(parsedOffset) || parsedOffset < 0) {
    throw new ValidationError('Offset must be a non-negative number');
  }

  return {
    limit: parsedLimit,
    offset: parsedOffset,
  };
};

/**
 * リクエストボディのバリデーション
 */
export const validateRequestBody = (body: string | null): any => {
  if (!body) {
    throw new ValidationError('Request body is required');
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new ValidationError('Invalid JSON format');
  }
};
