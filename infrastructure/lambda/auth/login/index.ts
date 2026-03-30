/**
 * ユーザーログインLambda関数
 * POST /auth/login
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { verifyPassword } from '../../shared/auth/password';
import { generateTokenPair } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';
import {
  validateRequestBody,
  validateEmail,
  validateRequired,
} from '../../shared/utils/validation';
import { AuthenticationError, JWTPayload, UserRole } from '../../shared/types';

/**
 * リクエストボディの型定義
 */
interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Lambda ハンドラー
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Login request:', {
    method: event.httpMethod,
    path: event.path,
  });

  try {
    // CORSプリフライト対応
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: '',
      };
    }

    // リクエストボディの検証
    console.log('[DEBUG] Raw event.body:', event.body);
    console.log('[DEBUG] event.body type:', typeof event.body);
    console.log('[DEBUG] event.isBase64Encoded:', event.isBase64Encoded);

    const body = validateRequestBody(event.body);
    console.log('[DEBUG] Parsed body:', JSON.stringify(body));

    const { email, password }: LoginRequest = body;

    console.log('[DEBUG] Extracted credentials:', {
      email: email,
      emailType: typeof email,
      passwordLength: password?.length,
      passwordType: typeof password,
    });

    // 入力値のバリデーション
    validateRequired(email, 'Email');
    validateRequired(password, 'Password');
    validateEmail(email);

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        passwordHash: true,
      },
    });

    console.log('[DEBUG] User found:', {
      email: user?.email,
      hasPasswordHash: !!user?.passwordHash,
      passwordHashLength: user?.passwordHash?.length,
      passwordHashPrefix: user?.passwordHash?.substring(0, 10),
    });

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    console.log('[DEBUG] Verifying password:', {
      inputPasswordLength: password.length,
      storedHashLength: user.passwordHash.length,
      inputPasswordPrefix: password.substring(0, 3) + '***',
      storedHashPrefix: user.passwordHash.substring(0, 10),
    });

    // パスワード検証
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    console.log('[DEBUG] Password verification result:', isPasswordValid);

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // JWTトークン生成
    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      orgId: user.orgId,
    };

    const tokens = generateTokenPair(jwtPayload);

    console.log('User logged in successfully:', { userId: user.id, email: user.email });

    // レスポンス（passwordHashは除外）
    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
      },
      tokens,
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(error as Error);
  }
};
