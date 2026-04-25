import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse, setRequestOrigin } from '../../shared/utils/response';
import type { Visibility } from '../../shared/types';

/**
 * GET /api/v1/scenarios
 *
 * Get list of scenarios for the authenticated user's organization
 *
 * Query Parameters:
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 * - category: string (optional filter by category)
 * - visibility: Visibility enum (optional filter)
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('List scenarios request:', JSON.stringify(event, null, 2));

  try {
    setRequestOrigin(event.headers?.Origin || event.headers?.origin);
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = Math.min(parseInt(queryParams.limit || '20'), 100);
    const offset = parseInt(queryParams.offset || '0');
    const category = queryParams.category;
    const visibility = queryParams.visibility as Visibility | undefined;

    // Build where clause - get scenarios from user's org or public scenarios
    const where: any = {
      OR: [
        { orgId: user.orgId }, // User's organization scenarios
        { visibility: 'PUBLIC' }, // Public scenarios from any organization
      ],
    };

    // Add optional filters
    if (category) {
      where.category = category;
    }

    if (visibility) {
      // If specific visibility is requested, override the OR condition
      delete where.OR;
      where.orgId = user.orgId;
      where.visibility = visibility;
    }

    // Get scenarios from database
    const [scenarios, total] = await Promise.all([
      prisma.scenario.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          title: true,
          category: true,
          language: true,
          visibility: true,
          createdAt: true,
          userId: true,
          orgId: true,
          // Silence management fields
          initialGreeting: true,
          silenceTimeout: true,
          silencePromptTimeout: true,
          enableSilencePrompt: true,
          showSilenceTimer: true,
          silenceThreshold: true,
          minSilenceDuration: true,
        },
      }),
      prisma.scenario.count({ where }),
    ]);

    console.log(`Found ${scenarios.length} scenarios for user ${user.userId}`);

    return successResponse({
      scenarios,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + scenarios.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing scenarios:', error);
    return errorResponse(
      500,
      'Failed to list scenarios',
      error instanceof Error ? error.message : undefined
    );
  }
};
// Force rebuild - Wed Mar 11 11:32:33 PM UTC 2026
