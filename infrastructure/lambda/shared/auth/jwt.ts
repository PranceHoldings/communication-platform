/**
 * JWT認証ユーティリティ
 */

import jwt from 'jsonwebtoken';
import { JWTPayload, AuthenticationError, UserRole } from '../types';
import { getRequiredEnv } from '../utils/env-validator';

const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

/**
 * アクセストークンを生成
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * リフレッシュトークンを生成
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
};

/**
 * トークンを検証
 */
export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    throw new AuthenticationError('Token verification failed');
  }
};

/**
 * トークンペアを生成
 */
export const generateTokenPair = (
  payload: JWTPayload
): { accessToken: string; refreshToken: string; expiresIn: number } => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: 24 * 60 * 60, // 24時間（秒）
  };
};

/**
 * Authorization headerからトークンを抽出
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string => {
  if (!authHeader) {
    throw new AuthenticationError('Authorization header is missing');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthenticationError('Invalid authorization header format');
  }

  return parts[1];
};

/**
 * APIGatewayProxyEventから認証されたユーザー情報を取得
 * Lambda Authorizerを使用している場合は requestContext.authorizer から取得
 */
export const getUserFromEvent = (event: {
  headers: { [key: string]: string | undefined };
  requestContext?: {
    authorizer?: any; // Allow any type for authorizer to accept Lambda Authorizer context
  };
}): JWTPayload | null => {
  try {
    // Lambda Authorizerがある場合は、そこからユーザー情報を取得
    // IMPORTANT: Authorizer context field names must match Prisma schema
    if (event.requestContext?.authorizer) {
      const auth = event.requestContext.authorizer;
      if (auth.userId && auth.email && auth.role && auth.orgId) {
        const payload: JWTPayload = {
          userId: auth.userId,
          email: auth.email,
          role: auth.role as UserRole,
          orgId: auth.orgId, // Prisma: User.orgId
        };

        // Add guest-specific fields if present
        if (auth.type) {
          payload.type = auth.type;
        }
        if (auth.guestSessionId) {
          payload.guestSessionId = auth.guestSessionId;
        }
        if (auth.sessionId) {
          payload.sessionId = auth.sessionId;
        }

        return payload;
      }
    }

    // AuthorizerがないかAuthentication context がない場合は、ヘッダーから直接トークンを検証
    const authHeader = event.headers['Authorization'] || event.headers['authorization'];
    const token = extractTokenFromHeader(authHeader);
    return verifyToken(token);
  } catch (error) {
    console.error('Failed to get user from event:', error);
    return null;
  }
};
