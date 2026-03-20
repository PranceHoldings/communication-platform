/**
 * GET /api/v1/admin/runtime-config
 * Get all runtime configuration values
 *
 * Authorization: SUPER_ADMIN only (read-only for CLIENT_ADMIN)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { verifyToken, JWTPayload } from '../../shared/utils/jwt';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('GET /api/v1/admin/runtime-config - event:', JSON.stringify(event));

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

    // Only SUPER_ADMIN and CLIENT_ADMIN can view runtime config
    if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'CLIENT_ADMIN') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Insufficient permissions. Only SUPER_ADMIN and CLIENT_ADMIN can view runtime configuration.',
        }),
      };
    }

    // Query parameters for filtering
    const category = event.queryStringParameters?.category;

    // Get all runtime configs (with optional category filter)
    const configs = await prisma.runtimeConfig.findMany({
      where: category ? { category: category as any } : undefined,
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
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Group by category
    const groupedConfigs: Record<string, any[]> = {};
    for (const config of configs) {
      if (!groupedConfigs[config.category]) {
        groupedConfigs[config.category] = [];
      }
      groupedConfigs[config.category].push(config);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          configs,
          groupedByCategory: groupedConfigs,
          total: configs.length,
        },
      }),
    };
  } catch (error) {
    console.error('Error getting runtime configs:', error);

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
