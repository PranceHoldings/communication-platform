/**
 * ユーザー登録Lambda関数
 * POST /auth/register
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { hashPassword } from '../../shared/auth/password';
import { generateTokenPair } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';
import {
  validateRequestBody,
  validateEmail,
  validatePassword,
  validateRequired,
} from '../../shared/utils/validation';
import { ConflictError, ValidationError, JWTPayload, UserRole } from '../../shared/types';

/**
 * リクエストボディの型定義
 * IMPORTANT: フィールド名はPrismaスキーマと完全一致させること
 */
interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  orgId?: string; // Prisma: User.orgId
}

/**
 * Lambda ハンドラー
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // デバッグログ: イベント全体を出力
  console.log('Full event object:', JSON.stringify(event, null, 2));

  console.log('Register request:', {
    method: event.httpMethod,
    path: event.path,
    body: event.body,
    bodyType: typeof event.body,
    headers: event.headers,
    isBase64Encoded: event.isBase64Encoded,
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
    const { email, password, name, orgId }: RegisterRequest = body;

    // 入力値のバリデーション
    validateRequired(email, 'Email');
    validateRequired(password, 'Password');
    validateRequired(name, 'Name');
    validateEmail(email);
    validatePassword(password);

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // パスワードのハッシュ化
    const passwordHash = await hashPassword(password);

    // 組織の確認（招待の場合は既存組織に参加、自己登録の場合は新規組織作成）
    let finalOrgId = orgId;
    if (orgId) {
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      if (!organization) {
        throw new ValidationError('Invalid organization ID');
      }
    } else {
      // 組織が指定されていない場合、デフォルト組織を作成
      const defaultOrganization = await prisma.organization.create({
        data: {
          name: `${name}'s Organization`,
        },
      });
      finalOrgId = defaultOrganization.id;
    }

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: orgId ? 'CLIENT_USER' : 'CLIENT_ADMIN', // Invited users are CLIENT_USER, self-registered are CLIENT_ADMIN
        organization: {
          connect: { id: finalOrgId! },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        createdAt: true,
      },
    });

    // JWTトークン生成
    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      orgId: user.orgId,
    };

    const tokens = generateTokenPair(jwtPayload);

    console.log('User registered successfully:', { userId: user.id, email: user.email });

    // レスポンス
    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgId: user.orgId,
        },
        tokens,
      },
      201
    );
  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse(error as Error);
  }
};
