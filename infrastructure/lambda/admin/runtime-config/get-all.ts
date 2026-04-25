/**
 * GET /api/v1/admin/runtime-config
 * Get all runtime configuration values
 *
 * Authorization: SUPER_ADMIN only (read-only for CLIENT_ADMIN)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { verifyToken, JWTPayload } from '../../shared/utils/jwt';
import { getAllowOriginHeader, setRequestOrigin } from '../../shared/utils/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('GET /api/v1/admin/runtime-config - event:', JSON.stringify(event));
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

    // Only SUPER_ADMIN and CLIENT_ADMIN can view runtime config
    if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'CLIENT_ADMIN') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Insufficient permissions. Only SUPER_ADMIN and CLIENT_ADMIN can view runtime configuration.',
        }),
      };
    }

    // Query parameters for filtering
    const category = event.queryStringParameters?.category;

    // Determine which access levels the user can view
    const allowedAccessLevels: string[] = [];
    if (payload.role === 'SUPER_ADMIN') {
      // SUPER_ADMIN can view all except DEVELOPER_ONLY
      allowedAccessLevels.push(
        'SUPER_ADMIN_READ_ONLY',
        'SUPER_ADMIN_READ_WRITE',
        'CLIENT_ADMIN_READ_WRITE',
        'CLIENT_ADMIN_READ_ONLY'
      );
    } else if (payload.role === 'CLIENT_ADMIN') {
      // CLIENT_ADMIN can only view CLIENT_ADMIN_* configs
      allowedAccessLevels.push('CLIENT_ADMIN_READ_WRITE', 'CLIENT_ADMIN_READ_ONLY');
    }

    // Get all runtime configs (with optional category filter + access level filter)
    const configs = await prisma.runtimeConfig.findMany({
      where: {
        ...(category ? { category: category as any } : {}),
        accessLevel: { in: allowedAccessLevels as any },
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
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
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
