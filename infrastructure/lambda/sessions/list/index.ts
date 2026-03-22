import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
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
 * - status: 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR'
 */
export const handler: APIGatewayProxyHandler = async event => {
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
    const status = queryParams.status as
      | 'ACTIVE'
      | 'PROCESSING'
      | 'COMPLETED'
      | 'ERROR'
      | undefined;

    // Build where clause
    const where: any = {
      userId: user.userId,
    };

    if (status) {
      where.status = status;
    }

    // Get sessions from database
    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: {
          startedAt: 'desc',
        },
        include: {
          scenario: {
            select: {
              id: true,
              title: true,
              category: true,
            },
          },
          avatar: {
            select: {
              id: true,
              name: true,
              thumbnailUrl: true,
            },
          },
          recordings: {
            select: {
              id: true,
              type: true,
              s3Key: true,
              s3Url: true,
              cdnUrl: true,
              thumbnailUrl: true,
              fileSizeBytes: true,
              durationSec: true,
              format: true,
              resolution: true,
              videoChunksCount: true,
              processingStatus: true,
              processedAt: true,
              errorMessage: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.session.count({ where }),
    ]);

    console.log(`Found ${sessions.length} sessions for user ${user.userId}`);

    return successResponse({
      sessions: sessions.map((session: any) => ({
        id: session.id,
        scenarioId: session.scenarioId,
        scenario: session.scenario,
        avatarId: session.avatarId,
        avatar: session.avatar || null,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSec: session.durationSec,
        metadataJson: session.metadataJson,
        recordings: (session.recordings || []).map((recording: any) => ({
          ...recording,
          fileSizeBytes: Number(recording.fileSizeBytes), // Convert BigInt to Number for JSON serialization
        })),
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
    return errorResponse(
      500,
      'Failed to list sessions',
      error instanceof Error ? error.message : undefined
    );
  }
};
