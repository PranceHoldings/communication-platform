/**
 * GET /api/v1/admin/runtime-config/:key
 * Get a specific runtime configuration value
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
  console.log('GET /api/v1/admin/runtime-config/:key - event:', JSON.stringify(event));
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
          error: 'Insufficient permissions',
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

    // Get runtime config
    const config = await prisma.runtimeConfig.findUnique({
      where: { key },
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

    if (!config) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Configuration not found',
          key,
        }),
      };
    }

    // Check if user has permission to view this config
    if (config.accessLevel === 'DEVELOPER_ONLY') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Access denied. This configuration is for developers only.',
        }),
      };
    }

    // CLIENT_ADMIN can only view CLIENT_ADMIN_* configs
    if (
      payload.role === 'CLIENT_ADMIN' &&
      !config.accessLevel.startsWith('CLIENT_ADMIN')
    ) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
        body: JSON.stringify({
          error: 'Access denied. You do not have permission to view this configuration.',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
      body: JSON.stringify({
        data: config,
      }),
    };
  } catch (error) {
    console.error('Error getting runtime config:', error);

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
