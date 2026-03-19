/**
 * トークン・PIN生成ユーティリティ
 *
 * ゲストセッション用のトークン（UUID v4）とPINコードを生成します。
 */

import { randomUUID, randomInt } from 'crypto';
import { getFrontendUrl } from './env-validator';

/**
 * 招待URL用トークンを生成（UUID v4、ハイフンなし）
 *
 * @returns 32文字のランダム文字列（UUID v4からハイフン除去）
 *
 * @example
 * const token = generateToken();
 * // token: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
 * // URL: https://prance.app/guest/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
 */
export function generateToken(): string {
  // UUID v4を生成し、ハイフンを除去
  // UUID v4は128bitのランダム値（衝突確率は極めて低い）
  return randomUUID().replace(/-/g, '');
}

/**
 * PINコードを生成（4-8桁のランダム数字）
 *
 * @param length PIN長（デフォルト: 4桁）
 * @returns ランダムなPINコード文字列
 *
 * @example
 * generatePin()     // "1234" (4桁)
 * generatePin(6)    // "567890" (6桁)
 * generatePin(8)    // "12345678" (8桁)
 */
export function generatePin(length: number = 4): string {
  // 入力検証
  if (length < 4 || length > 8) {
    throw new Error('PIN length must be between 4 and 8');
  }

  // 暗号学的に安全な乱数生成
  // 0 から 10^length - 1 の範囲（先頭ゼロを含む）
  const max = Math.pow(10, length);

  // randomInt は crypto モジュールの暗号学的に安全な乱数生成関数
  const pin = randomInt(0, max);

  // ゼロパディングして指定桁数に揃える
  return pin.toString().padStart(length, '0');
}

/**
 * カスタムPINを検証（4-8桁の数字）
 *
 * @param pin 検証するPIN
 * @returns 有効な場合true
 *
 * @example
 * validateCustomPin('1234')    // true
 * validateCustomPin('123')     // false (3桁)
 * validateCustomPin('abc123')  // false (英字含む)
 */
export function validateCustomPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

/**
 * トークンとPINをセットで生成
 *
 * @param pinLength PIN長（デフォルト: 4桁）
 * @returns { token, pin }
 *
 * @example
 * const { token, pin } = generateTokenAndPin();
 * console.log('Token:', token);  // "a1b2c3d4..."
 * console.log('PIN:', pin);      // "1234"
 */
export function generateTokenAndPin(pinLength: number = 4): { token: string; pin: string } {
  return {
    token: generateToken(),
    pin: generatePin(pinLength),
  };
}

/**
 * 招待URLを生成
 *
 * @param token トークン
 * @param baseUrl ベースURL（デフォルト: 環境変数から取得）
 * @returns 完全なURL
 *
 * @example
 * const url = generateInviteUrl('a1b2c3d4...');
 * // url: "https://prance.app/guest/a1b2c3d4..."
 */
export function generateInviteUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || getFrontendUrl();
  return `${base}/guest/${token}`;
}
