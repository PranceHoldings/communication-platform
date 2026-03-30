/**
 * ゲストユーザー用JWT認証ユーティリティ
 *
 * ゲストユーザー（面接候補者、研修受講者等）のための簡易認証を提供します。
 * トークン + PINコードによる認証フローをサポートします。
 */

import { JWTPayload } from '../types';
import { generateAccessToken, verifyToken } from './jwt';
import { AuthenticationError } from '../types';

/**
 * ゲストトークン生成用のペイロード
 */
export interface GuestTokenPayload {
  guestSessionId: string;
  orgId: string;
  sessionId?: string; // Optional: session is created when guest starts conversation
  scenarioId?: string;
  avatarId?: string | null;
}

/**
 * ゲスト用JWTトークンを生成
 *
 * @param payload ゲストセッション情報
 * @returns JWT文字列
 *
 * @example
 * const token = generateGuestToken({
 *   guestSessionId: 'uuid-guest-session',
 *   orgId: 'uuid-org',
 *   sessionId: 'uuid-session',
 * });
 */
export const generateGuestToken = (payload: GuestTokenPayload): string => {
  const fullPayload: JWTPayload = {
    userId: 'guest', // プレースホルダー（ゲストユーザーはユーザーIDを持たない）
    email: 'guest@system', // プレースホルダー
    role: 'GUEST',
    type: 'guest',
    orgId: payload.orgId,
    guestSessionId: payload.guestSessionId,
    sessionId: payload.sessionId || undefined, // Optional until guest starts conversation
  };

  // 既存のgenerateAccessToken関数を再利用（24時間有効）
  return generateAccessToken(fullPayload);
};

/**
 * ゲストトークンを検証
 *
 * @param token JWT文字列
 * @returns デコードされたJWTペイロード
 * @throws {AuthenticationError} トークンが無効、期限切れ、またはゲストトークンでない場合
 *
 * @example
 * try {
 *   const payload = verifyGuestToken(token);
 *   console.log('Guest session:', payload.guestSessionId);
 * } catch (error) {
 *   console.error('Invalid guest token');
 * }
 */
export const verifyGuestToken = (token: string): JWTPayload => {
  // 既存のverifyToken関数を再利用
  const decoded = verifyToken(token);

  // ゲストトークンであることを確認
  if (decoded.type !== 'guest' || decoded.role !== 'GUEST') {
    throw new AuthenticationError('Not a guest token');
  }

  // guestSessionIdが存在することを確認
  if (!decoded.guestSessionId) {
    throw new AuthenticationError('Invalid guest token: missing guestSessionId');
  }

  return decoded;
};

/**
 * トークンがゲストトークンかどうかを判定
 *
 * @param token JWT文字列
 * @returns ゲストトークンの場合true
 *
 * @example
 * if (isGuestToken(token)) {
 *   // ゲストユーザー向け処理
 * } else {
 *   // 通常ユーザー向け処理
 * }
 */
export const isGuestToken = (token: string): boolean => {
  try {
    const decoded = verifyToken(token);
    return decoded.type === 'guest' && decoded.role === 'GUEST';
  } catch (error) {
    return false;
  }
};

/**
 * トークンからゲストセッションIDを抽出
 *
 * @param token JWT文字列
 * @returns ゲストセッションID、またはnull
 *
 * @example
 * const guestSessionId = extractGuestSessionId(token);
 * if (guestSessionId) {
 *   // ゲストセッション処理
 * }
 */
export const extractGuestSessionId = (token: string): string | null => {
  try {
    const decoded = verifyGuestToken(token);
    return decoded.guestSessionId || null;
  } catch (error) {
    return null;
  }
};
