/**
 * GET /api/v1/admin/runtime-config/:key/history
 * Get change history for a runtime configuration
 *
 * Authorization: SUPER_ADMIN and CLIENT_ADMIN
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { verifyToken, JWTPayload } from '../../shared/utils/jwt';
import { getAllowOriginHeader, setRequestOrigin } from '../../../shared/utils/response';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('GET /api/v1/admin/runtime-config/:key/history - event:', JSON.stringify(event));
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

    // Only SUPER_ADMIN and CLIENT_ADMIN can view history
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

    // Query parameters for pagination
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');

    // Get change history
    const [history, total] = await Promise.all([
      prisma.runtimeConfigHistory.findMany({
        where: { key },
        select: {
          id: true,
          key: true,
          oldValue: true,
          newValue: true,
          changedBy: true,
          changedAt: true,
          reason: true,
          ipAddress: true,
        },
        orderBy: { changedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.runtimeConfigHistory.count({
        where: { key },
      }),
    ]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin), 'Access-Control-Allow-Credentials': 'true' },
      body: JSON.stringify({
        data: {
          history,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + history.length < total,
          },
        },
      }),
    };
  } catch (error) {
    console.error('Error getting runtime config history:', error);

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
