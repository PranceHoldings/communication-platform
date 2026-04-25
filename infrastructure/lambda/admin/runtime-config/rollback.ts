/**
 * POST /api/v1/admin/runtime-config/:key/rollback
 * Rollback a runtime configuration to a previous value
 *
 * Authorization: SUPER_ADMIN only
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { verifyToken, JWTPayload } from '../../shared/utils/jwt';
import { setCacheValue } from '../../shared/utils/elasticache-client';
import { clearMemoryCache } from '../../shared/utils/runtime-config-loader';
import { getAllowOriginHeader, setRequestOrigin } from '../../shared/utils/response';

interface RollbackRequest {
  historyId: string;
  reason?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('POST /api/v1/admin/runtime-config/:key/rollback - event:', JSON.stringify(event));
  setRequestOrigin(event?.headers?.Origin || event?.headers?.origin);

  try {
    // Extract user from API Gateway Lambda Authorizer context
    let payload: JWTPayload;
    try {
      payload = verifyToken(event);
    } catch (error) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Authorization: SUPER_ADMIN or CLIENT_ADMIN (with restrictions)
    if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'CLIENT_ADMIN') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Insufficient permissions. Only SUPER_ADMIN and CLIENT_ADMIN can rollback runtime configuration.',
        }),
      };
    }

    // Get key from path parameters
    const key = event.pathParameters?.key;
    if (!key) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({ error: 'Missing configuration key' }),
      };
    }

    // Parse request body
    const body: RollbackRequest = JSON.parse(event.body || '{}');
    if (!body.historyId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({ error: 'Missing historyId in request body' }),
      };
    }

    // Get history record
    const historyRecord = await prisma.runtimeConfigHistory.findUnique({
      where: { id: body.historyId },
      select: {
        id: true,
        key: true,
        oldValue: true,
        newValue: true,
        changedAt: true,
        changedBy: true,
      },
    });

    if (!historyRecord) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'History record not found',
          historyId: body.historyId,
        }),
      };
    }

    // Verify key matches
    if (historyRecord.key !== key) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'History record does not match configuration key',
          expected: key,
          actual: historyRecord.key,
        }),
      };
    }

    // Get current value
    const currentConfig = await prisma.runtimeConfig.findUnique({
      where: { key },
      select: {
        key: true,
        value: true,
        accessLevel: true,
      },
    });

    if (!currentConfig) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Configuration not found',
          key,
        }),
      };
    }

    // Check write permissions based on access level (same logic as update)
    if (currentConfig.accessLevel === 'DEVELOPER_ONLY') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Access denied. This configuration is for developers only.',
        }),
      };
    }

    if (currentConfig.accessLevel === 'SUPER_ADMIN_READ_ONLY') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Access denied. This configuration is read-only for security reasons.',
        }),
      };
    }

    if (currentConfig.accessLevel === 'SUPER_ADMIN_READ_WRITE' && payload.role !== 'SUPER_ADMIN') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Access denied. Only SUPER_ADMIN can rollback this configuration.',
        }),
      };
    }

    if (currentConfig.accessLevel === 'CLIENT_ADMIN_READ_ONLY') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Access denied. This configuration is read-only.',
        }),
      };
    }

    // CLIENT_ADMIN can rollback CLIENT_ADMIN_READ_WRITE configs
    // SUPER_ADMIN can rollback all except DEVELOPER_ONLY and *_READ_ONLY configs

    // Rollback to old value from history
    const rollbackValue = historyRecord.oldValue;

    // Update config in database
    const updatedConfig = await prisma.runtimeConfig.update({
      where: { key },
      data: {
        value: rollbackValue,
        updatedBy: payload.sub,
      },
      select: {
        key: true,
        value: true,
        dataType: true,
        category: true,
        accessLevel: true,
        defaultValue: true,
        minValue: true,
        maxValue: true,
        description: true,
        updatedAt: true,
        updatedBy: true,
      },
    });

    // Record rollback in history
    await prisma.runtimeConfigHistory.create({
      data: {
        key,
        oldValue: currentConfig.value,
        newValue: rollbackValue,
        changedBy: payload.sub,
        reason:
          body.reason ||
          `Rollback to previous value (history: ${body.historyId}, changed at: ${historyRecord.changedAt.toISOString()})`,
        ipAddress: event.requestContext?.identity?.sourceIp || null,
      },
    });

    // Update ElastiCache immediately
    await setCacheValue(`runtime:${key}`, rollbackValue, 60);

    // Clear Lambda memory cache
    clearMemoryCache(key);

    console.log(`[RuntimeConfig] Rolled back: ${key} = ${JSON.stringify(rollbackValue)}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
      body: JSON.stringify({
        data: updatedConfig,
        message: 'Runtime configuration rolled back successfully',
        rolledBackFrom: {
          historyId: body.historyId,
          changedAt: historyRecord.changedAt,
          changedBy: historyRecord.changedBy,
        },
      }),
    };
  } catch (error) {
    console.error('Error rolling back runtime config:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
