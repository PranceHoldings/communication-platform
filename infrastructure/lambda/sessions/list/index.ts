import { APIGatewayProxyHandler } from 'aws-lambda';
import { getPrismaClient } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * GET /api/v1/sessions
 *
 * Get list of sessions for the authenticated user
 *
 * Query Parameters:
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - status: 'pending' | 'in_progress' | 'completed' | 'failed'
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('List sessions request:', JSON.stringify(event, null, 2));

  try {
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = Math.min(parseInt(queryParams.limit || '20'), 100);
    const offset = parseInt(queryParams.offset || '0');
    const status = queryParams.status as 'pending' | 'in_progress' | 'completed' | 'failed' | undefined;

    // Build where clause
    const where: any = {
      userId: user.userId,
    };

    if (status) {
      where.status = status;
    }

    // Get sessions from database
    const prisma = getPrismaClient();

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          scenario: {
            select: {
              id: true,
              title: true,
              description: true,
            },
          },
          avatar: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      }),
      prisma.session.count({ where }),
    ]);

    console.log(`Found ${sessions.length} sessions for user ${user.userId}`);

    return successResponse({
      sessions: sessions.map((session) => ({
        id: session.id,
        scenarioId: session.scenarioId,
        scenario: session.scenario,
        avatarId: session.avatarId,
        avatar: session.avatar,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        metadata: session.metadata,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + sessions.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    return errorResponse(500, 'Failed to list sessions', error instanceof Error ? error.message : undefined);
  }
};
