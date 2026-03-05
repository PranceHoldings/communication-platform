/**
 * パスワードハッシュ化ユーティリティ
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * パスワードをハッシュ化
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * パスワードを検証
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
