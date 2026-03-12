/**
 * 組織設定（AI & Audio Settings）Lambda関数
 * GET /api/v1/organizations/settings - 設定取得
 * PUT /api/v1/organizations/settings - 設定更新
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { successResponse, errorResponse } from '../../shared/utils/response';
import { getUserFromEvent } from '../../shared/auth/jwt';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  OrganizationSettings,
} from '../../shared/types';

// デフォルト設定値
const DEFAULT_SETTINGS: OrganizationSettings = {
  enableSilencePrompt: true,
  silenceTimeout: 10,
  silencePromptStyle: 'neutral',
  showSilenceTimer: false,
  silenceThreshold: 0.12,
  minSilenceDuration: 500,
};

/**
 * 設定のバリデーション
 */
function validateSettings(settings: Partial<OrganizationSettings>): void {
  if (settings.enableSilencePrompt !== undefined && typeof settings.enableSilencePrompt !== 'boolean') {
    throw new ValidationError('enableSilencePrompt must be a boolean');
  }

  if (settings.silenceTimeout !== undefined) {
    if (typeof settings.silenceTimeout !== 'number' || settings.silenceTimeout < 5 || settings.silenceTimeout > 60) {
      throw new ValidationError('silenceTimeout must be a number between 5 and 60');
    }
  }

  if (settings.silencePromptStyle !== undefined) {
    if (!['formal', 'casual', 'neutral'].includes(settings.silencePromptStyle)) {
      throw new ValidationError('silencePromptStyle must be formal, casual, or neutral');
    }
  }

  if (settings.showSilenceTimer !== undefined && typeof settings.showSilenceTimer !== 'boolean') {
    throw new ValidationError('showSilenceTimer must be a boolean');
  }

  if (settings.silenceThreshold !== undefined) {
    if (typeof settings.silenceThreshold !== 'number' || settings.silenceThreshold < 0.01 || settings.silenceThreshold > 0.2) {
      throw new ValidationError('silenceThreshold must be a number between 0.01 and 0.2');
    }
  }

  if (settings.minSilenceDuration !== undefined) {
    if (typeof settings.minSilenceDuration !== 'number' || settings.minSilenceDuration < 100 || settings.minSilenceDuration > 2000) {
      throw new ValidationError('minSilenceDuration must be a number between 100 and 2000');
    }
  }
}

/**
 * Lambda ハンドラー
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Organization settings request:', {
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
          'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
        },
        body: '',
      };
    }

    // JWT認証情報から現在のユーザーを取得
    const currentUser = getUserFromEvent(event);
    if (!currentUser) {
      throw new AuthenticationError('Authentication required');
    }

    // GETリクエスト: 設定取得
    if (event.httpMethod === 'GET') {
      const organization = await prisma.organization.findUnique({
        where: { id: currentUser.orgId },
        select: {
          id: true,
          name: true,
          settings: true,
        },
      });

      if (!organization) {
        throw new AuthorizationError('Organization not found');
      }

      // 保存済み設定とデフォルト設定をマージ
      const savedSettings = (organization.settings as OrganizationSettings) || {};
      const mergedSettings: OrganizationSettings = {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
      };

      console.log('Settings retrieved successfully:', { orgId: organization.id });

      return successResponse(mergedSettings);
    }

    // PUTリクエスト: 設定更新
    if (event.httpMethod === 'PUT') {
      // CLIENT_ADMINまたはSUPER_ADMINのみ設定更新可能
      if (currentUser.role !== 'CLIENT_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('Only administrators can update organization settings');
      }

      // リクエストボディをパース
      const body = JSON.parse(event.body || '{}');
      const newSettings: Partial<OrganizationSettings> = body;

      // バリデーション
      validateSettings(newSettings);

      // 現在の設定を取得
      const organization = await prisma.organization.findUnique({
        where: { id: currentUser.orgId },
        select: {
          settings: true,
        },
      });

      const currentSettings = (organization?.settings as OrganizationSettings) || {};

      // 設定をマージして更新
      const updatedSettings: OrganizationSettings = {
        ...currentSettings,
        ...newSettings,
      };

      // データベースに保存
      await prisma.organization.update({
        where: { id: currentUser.orgId },
        data: {
          settings: updatedSettings as any,
        },
      });

      console.log('Settings updated successfully:', { orgId: currentUser.orgId });

      return successResponse(updatedSettings);
    }

    // サポートされていないメソッド
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Organization settings error:', error);
    return errorResponse(error as Error);
  }
};
