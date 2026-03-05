import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * GET /api/v1/avatars
 *
 * Get list of avatars for the authenticated user's organization
 *
 * Query Parameters:
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - type: 'TWO_D' | 'THREE_D' (optional filter by avatar type)
 * - style: 'ANIME' | 'REALISTIC' (optional filter by style)
 * - source: 'PRESET' | 'GENERATED' | 'ORG_CUSTOM' (optional filter)
 * - visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' (optional filter)
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('List avatars request:', JSON.stringify(event, null, 2));

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
    const type = queryParams.type as 'TWO_D' | 'THREE_D' | undefined;
    const style = queryParams.style as 'ANIME' | 'REALISTIC' | undefined;
    const source = queryParams.source as 'PRESET' | 'GENERATED' | 'ORG_CUSTOM' | undefined;
    const visibility = queryParams.visibility as 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' | undefined;

    // Build where clause - get avatars from user's org, presets, or public avatars
    const where: any = {
      OR: [
        { orgId: user.orgId }, // User's organization avatars
        { source: 'PRESET' }, // System preset avatars
        { visibility: 'PUBLIC' }, // Public avatars from any organization
      ],
    };

    // Add optional filters
    if (type) {
      where.type = type;
    }

    if (style) {
      where.style = style;
    }

    if (source) {
      // If specific source is requested, override the OR condition
      delete where.OR;
      if (source === 'PRESET') {
        where.source = 'PRESET';
      } else {
        where.orgId = user.orgId;
        where.source = source;
      }
    }

    if (visibility) {
      // If specific visibility is requested, add to filter
      if (!where.OR) {
        where.orgId = user.orgId;
      }
      where.visibility = visibility;
    }

    // Get avatars from database
    const [avatars, total] = await Promise.all([
      prisma.avatar.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          type: true,
          style: true,
          source: true,
          modelUrl: true,
          thumbnailUrl: true,
          tags: true,
          visibility: true,
          allowCloning: true,
          createdAt: true,
          userId: true,
          orgId: true,
        },
      }),
      prisma.avatar.count({ where }),
    ]);

    console.log(`Found ${avatars.length} avatars for user ${user.userId}`);

    return successResponse({
      avatars,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + avatars.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing avatars:', error);
    return errorResponse(500, 'Failed to list avatars', error instanceof Error ? error.message : undefined);
  }
};
