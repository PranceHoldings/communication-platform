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
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  VALIDATION_RANGES,
  ALLOWED_VALUES,
} from '../../shared/defaults';

// 🔴 CRITICAL: デフォルト値は shared/defaults から取得（多重管理禁止）
const DEFAULT_SETTINGS = DEFAULT_ORGANIZATION_SETTINGS;

/**
 * 設定のバリデーション
 */
function validateSettings(settings: Partial<OrganizationSettings>): void {
  if (
    settings.enableSilencePrompt !== undefined &&
    typeof settings.enableSilencePrompt !== 'boolean'
  ) {
    throw new ValidationError('enableSilencePrompt must be a boolean');
  }

  if (settings.silenceTimeout !== undefined) {
    const { min, max } = VALIDATION_RANGES.silenceTimeout;
    if (
      typeof settings.silenceTimeout !== 'number' ||
      settings.silenceTimeout < min ||
      settings.silenceTimeout > max
    ) {
      throw new ValidationError(`silenceTimeout must be a number between ${min} and ${max}`);
    }
  }

  if (settings.silencePromptTimeout !== undefined) {
    const { min, max } = VALIDATION_RANGES.silencePromptTimeout;
    if (
      typeof settings.silencePromptTimeout !== 'number' ||
      settings.silencePromptTimeout < min ||
      settings.silencePromptTimeout > max
    ) {
      throw new ValidationError(`silencePromptTimeout must be a number between ${min} and ${max}`);
    }
  }

  if (settings.silencePromptStyle !== undefined) {
    if (!ALLOWED_VALUES.silencePromptStyle.includes(settings.silencePromptStyle as any)) {
      throw new ValidationError(
        `silencePromptStyle must be one of: ${ALLOWED_VALUES.silencePromptStyle.join(', ')}`
      );
    }
  }

  if (settings.showSilenceTimer !== undefined && typeof settings.showSilenceTimer !== 'boolean') {
    throw new ValidationError('showSilenceTimer must be a boolean');
  }

  if (settings.silenceThreshold !== undefined) {
    const { min, max } = VALIDATION_RANGES.silenceThreshold;
    if (
      typeof settings.silenceThreshold !== 'number' ||
      settings.silenceThreshold < min ||
      settings.silenceThreshold > max
    ) {
      throw new ValidationError(`silenceThreshold must be a number between ${min} and ${max}`);
    }
  }

  if (settings.minSilenceDuration !== undefined) {
    const { min, max } = VALIDATION_RANGES.minSilenceDuration;
    if (
      typeof settings.minSilenceDuration !== 'number' ||
      settings.minSilenceDuration < min ||
      settings.minSilenceDuration > max
    ) {
      throw new ValidationError(`minSilenceDuration must be a number between ${min} and ${max}`);
    }
  }

  if (settings.initialSilenceTimeout !== undefined) {
    const { min, max } = VALIDATION_RANGES.initialSilenceTimeout;
    if (
      typeof settings.initialSilenceTimeout !== 'number' ||
      settings.initialSilenceTimeout < min ||
      settings.initialSilenceTimeout > max
    ) {
      throw new ValidationError(
        `initialSilenceTimeout must be a number between ${min} and ${max} ms`
      );
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
    queryStringParameters: event.queryStringParameters,
    timestamp: new Date().toISOString(),
  });

  try {
    // CORSプリフライト対応
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,PUT,PATCH,OPTIONS',
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

      // 🔴 CRITICAL: Return raw DB values WITHOUT merging with defaults
      // Frontend/SessionPlayer will handle hierarchical resolution: Org → DEFAULT_SETTINGS
      const savedSettings = (organization.settings as OrganizationSettings) || {};

      console.log('Settings retrieved successfully:', {
        orgId: organization.id,
        savedSettings,
        timestamp: new Date().toISOString(),
      });

      return successResponse(savedSettings);
    }

    // PUT/PATCHリクエスト: 設定更新
    if (event.httpMethod === 'PUT' || event.httpMethod === 'PATCH') {
      // CLIENT_ADMINまたはSUPER_ADMINのみ設定更新可能
      if (currentUser.role !== 'CLIENT_ADMIN' && currentUser.role !== 'SUPER_ADMIN') {
        throw new AuthorizationError('Only administrators can update organization settings');
      }

      // リクエストボディをパース
      const body = JSON.parse(event.body || '{}');
      const newSettings: Partial<OrganizationSettings> = body;

      console.log('Updating organization settings:', {
        orgId: currentUser.orgId,
        requestBody: newSettings,
        timestamp: new Date().toISOString(),
      });

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

      console.log('Current settings before update:', {
        orgId: currentUser.orgId,
        currentSettings,
      });

      // 設定をマージして更新
      const updatedSettings: OrganizationSettings = {
        ...currentSettings,
        ...newSettings,
      };

      console.log('Merged settings to save:', {
        orgId: currentUser.orgId,
        updatedSettings,
      });

      // データベースに保存
      await prisma.organization.update({
        where: { id: currentUser.orgId },
        data: {
          settings: updatedSettings as any,
        },
      });

      console.log('Settings updated successfully:', {
        orgId: currentUser.orgId,
        updatedSettings,
        timestamp: new Date().toISOString(),
      });

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
