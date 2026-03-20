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

interface UpdateRuntimeConfigRequest {
  value: any;
  reason?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('PUT /api/v1/admin/runtime-config/:key - event:', JSON.stringify(event));

  try {
    // Authorization check
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing authorization header' }),
      };
    }

    const token = authHeader.replace('Bearer ', '');
    let payload: JWTPayload;

    try {
      payload = verifyToken(token);
    } catch (error) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    // Only SUPER_ADMIN can update runtime config
    if (payload.role !== 'SUPER_ADMIN') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Insufficient permissions. Only SUPER_ADMIN can update runtime configuration.',
        }),
      };
    }

    // Get key from path parameters
    const key = event.pathParameters?.key;
    if (!key) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing configuration key' }),
      };
    }

    // Parse request body
    const body: UpdateRuntimeConfigRequest = JSON.parse(event.body || '{}');
    if (body.value === undefined) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
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
        minValue: true,
        maxValue: true,
        description: true,
      },
    });

    if (!currentConfig) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Configuration not found',
          key,
        }),
      };
    }

    // Validate data type
    const validationError = validateValue(body.value, currentConfig);
    if (validationError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: validationError }),
      };
    }

    // Update config in database
    const updatedConfig = await prisma.runtimeConfig.update({
      where: { key },
      data: {
        value: body.value,
        updatedBy: payload.userId,
      },
      select: {
        key: true,
        value: true,
        dataType: true,
        category: true,
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
        changedBy: payload.userId,
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: updatedConfig,
        message: 'Runtime configuration updated successfully',
      }),
    };
  } catch (error) {
    console.error('Error updating runtime config:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
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
