/**
 * パスワードハッシュ化ユーティリティ
 */

import bcrypt from 'bcryptjs';
import { getBcryptSaltRounds } from '../utils/env-validator';

/**
 * パスワードをハッシュ化
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, getBcryptSaltRounds());
};

/**
 * パスワードを検証
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
