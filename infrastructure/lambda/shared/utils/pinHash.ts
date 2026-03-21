/**
 * PINコードハッシュ化ユーティリティ
 *
 * bcryptを使用してPINコードを安全にハッシュ化・検証します。
 * ゲストユーザー認証で使用されます。
 */

import bcrypt from 'bcryptjs';
import { getBcryptSaltRounds } from './runtime-config-loader';

/**
 * PINコードをbcryptでハッシュ化
 *
 * @param pin PINコード（4-8桁の数字）
 * @returns bcryptハッシュ文字列
 *
 * @example
 * const pin = '1234';
 * const hash = await hashPin(pin);
 * // hash: "$2a$10$..."
 */
export async function hashPin(pin: string): Promise<string> {
  // PINフォーマット検証（オプション）
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('Invalid PIN format: must be 4-8 digits');
  }

  const saltRounds = await getBcryptSaltRounds();
  return bcrypt.hash(pin, saltRounds);
}

/**
 * PINコードをハッシュと照合
 *
 * @param pin 入力されたPINコード
 * @param hash データベースに保存されたハッシュ
 * @returns 一致する場合true
 *
 * @example
 * const inputPin = '1234';
 * const storedHash = '$2a$10$...';
 * const isValid = await verifyPin(inputPin, storedHash);
 * if (isValid) {
 *   console.log('PIN correct');
 * }
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pin, hash);
  } catch (error) {
    console.error('PIN verification error:', error);
    return false;
  }
}

/**
 * PINフォーマットを検証
 *
 * @param pin 検証するPINコード
 * @returns 有効な場合true
 *
 * @example
 * isValidPinFormat('1234')  // true
 * isValidPinFormat('12345') // true
 * isValidPinFormat('abc')   // false
 * isValidPinFormat('12')    // false
 */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}
