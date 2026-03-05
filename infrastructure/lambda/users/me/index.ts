/**
 * 現在のユーザー情報取得Lambda関数
 * GET /api/v1/users/me
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { successResponse, errorResponse } from '../../shared/utils/response';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { AuthenticationError, NotFoundError } from '../../shared/types';

/**
 * Lambda ハンドラー
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Get current user request:', {
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
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
        },
        body: '',
      };
    }

    // JWT認証情報から現在のユーザーIDを取得
    const currentUser = getUserFromEvent(event);
    if (!currentUser) {
      throw new AuthenticationError('Authentication required');
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        createdAt: true,
        lastLoginAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // 最終ログイン日時を更新
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    console.log('User retrieved successfully:', { userId: user.id });

    // レスポンス
    return successResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      organization: user.organization,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return errorResponse(error as Error);
  }
};
