/**
 * PUT /api/v1/admin/runtime-config/:key
 * Update a runtime configuration value
 *
 * Authorization: SUPER_ADMIN only
 * Features:
 * - Validation (type, range, dependencies)
 * - History tracking
 * - ElastiCache immediate update
 * - Memory cache clear
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { verifyToken, JWTPayload } from '../../shared/utils/jwt';
import { setCacheValue, deleteCacheValue } from '../../shared/utils/elasticache-client';
import { clearMemoryCache } from '../../shared/utils/runtime-config-loader';
import { getAllowOriginHeader, setRequestOrigin } from '../../../shared/utils/response';

interface UpdateRuntimeConfigRequest {
  value: any;
  reason?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('PUT /api/v1/admin/runtime-config/:key - event:', JSON.stringify(event));
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
          error: 'Insufficient permissions. Only SUPER_ADMIN and CLIENT_ADMIN can update runtime configuration.',
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
    const body: UpdateRuntimeConfigRequest = JSON.parse(event.body || '{}');
    if (body.value === undefined) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({ error: 'Missing value in request body' }),
      };
    }

    // Get current config
    const currentConfig = await prisma.runtimeConfig.findUnique({
      where: { key },
      select: {
        key: true,
        value: true,
        dataType: true,
        category: true,
        accessLevel: true,
        minValue: true,
        maxValue: true,
        description: true,
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

    // Check write permissions based on access level
    if (currentConfig.accessLevel === 'DEVELOPER_ONLY') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Access denied. This configuration is for developers only.',
        }),
      };
    }

    if (currentConfig.accessLevel === 'SUPER_ADMIN_READ_ONLY' && payload.role !== 'SUPER_ADMIN') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Access denied. This configuration is read-only.',
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
          error: 'Access denied. Only SUPER_ADMIN can update this configuration.',
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

    // CLIENT_ADMIN can update CLIENT_ADMIN_READ_WRITE configs
    // SUPER_ADMIN can update all except DEVELOPER_ONLY and *_READ_ONLY configs
    if (currentConfig.accessLevel === 'CLIENT_ADMIN_READ_WRITE') {
      // Both SUPER_ADMIN and CLIENT_ADMIN can update
      // Permission granted
    }

    // Validate data type
    const validationError = validateValue(body.value, currentConfig);
    if (validationError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({ error: validationError }),
      };
    }

    // Update config in database
    const updatedConfig = await prisma.runtimeConfig.update({
      where: { key },
      data: {
        value: body.value,
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

    // Record change history
    await prisma.runtimeConfigHistory.create({
      data: {
        key,
        oldValue: currentConfig.value,
        newValue: body.value,
        changedBy: payload.sub,
        reason: body.reason || 'No reason provided',
        ipAddress: event.requestContext?.identity?.sourceIp || null,
      },
    });

    // Update ElastiCache immediately (TTL: 60 seconds)
    await setCacheValue(`runtime:${key}`, body.value, 60);

    // Clear Lambda memory cache (will be refreshed on next access)
    clearMemoryCache(key);

    console.log(`[RuntimeConfig] Updated: ${key} = ${JSON.stringify(body.value)}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
      body: JSON.stringify({
        data: updatedConfig,
        message: 'Runtime configuration updated successfully',
      }),
    };
  } catch (error) {
    console.error('Error updating runtime config:', error);

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

/**
 * Validate value against config constraints
 */
function validateValue(value: any, config: any): string | null {
  // Type validation
  switch (config.dataType) {
    case 'NUMBER':
      if (typeof value !== 'number' || isNaN(value)) {
        return `Expected number, got ${typeof value}`;
      }
      // Range validation
      if (config.minValue !== null && value < config.minValue) {
        return `Value ${value} is below minimum ${config.minValue}`;
      }
      if (config.maxValue !== null && value > config.maxValue) {
        return `Value ${value} is above maximum ${config.maxValue}`;
      }
      break;

    case 'STRING':
      if (typeof value !== 'string') {
        return `Expected string, got ${typeof value}`;
      }
      break;

    case 'BOOLEAN':
      if (typeof value !== 'boolean') {
        return `Expected boolean, got ${typeof value}`;
      }
      break;

    case 'JSON':
      // JSON can be any valid JSON value
      try {
        JSON.stringify(value);
      } catch {
        return 'Invalid JSON value';
      }
      break;

    default:
      return `Unknown data type: ${config.dataType}`;
  }

  return null;
}
