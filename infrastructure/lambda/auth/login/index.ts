/**
 * ユーザーログインLambda関数
 * POST /auth/login
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { verifyPassword } from '../../shared/auth/password';
import { generateTokenPair } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';
import { validateRequestBody, validateEmail, validateRequired } from '../../shared/utils/validation';
import { AuthenticationError, JWTPayload } from '../../shared/types';

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
    const body = validateRequestBody(event.body);
    const { email, password }: LoginRequest = body;

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

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // パスワード検証
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // JWTトークン生成
    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as 'super_admin' | 'client_admin' | 'client_user',
      organizationId: user.orgId,
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
        organizationId: user.orgId,
      },
      tokens,
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(error as Error);
  }
};
