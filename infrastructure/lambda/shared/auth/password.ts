/**
 * パスワードハッシュ化ユーティリティ
 * Updated: 2026-03-21 - Phase 5.4 Integration with runtime-config-loader
 */

import bcrypt from 'bcryptjs';
import { getBcryptSaltRounds } from '../utils/runtime-config-loader';

/**
 * パスワードをハッシュ化
 * Runtime configuration から salt rounds を取得
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = await getBcryptSaltRounds();
  return bcrypt.hash(password, saltRounds);
};

/**
 * パスワードを検証
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
