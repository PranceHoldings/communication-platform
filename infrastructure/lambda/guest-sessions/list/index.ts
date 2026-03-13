/**
 * List Guest Sessions Lambda Function
 *
 * GET /api/guest-sessions
 *
 * Lists guest sessions with filtering, pagination, and sorting.
 * Only CLIENT_ADMIN and CLIENT_USER can list sessions in their organization.
 *
 * @module guest-sessions/list
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient, GuestSessionStatus } from '@prisma/client';
import { verifyToken } from '../../shared/auth/jwt';

const prisma = new PrismaClient();

interface ListGuestSessionsQuery {
  status?: GuestSessionStatus;
  scenarioId?: string;
  guestEmail?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'validUntil' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
}

interface GuestSessionListItem {
  id: string;
  token: string;
  status: GuestSessionStatus;
  guestName: string | null;
  guestEmail: string | null;
  validFrom: string;
  validUntil: string;
  accessCount: number;
  failedAttempts: number;
  firstAccessedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
  scenario: {
    id: string;
    title: string;
    category: string;
  };
  avatar: {
    id: string;
    name: string;
    thumbnailUrl: string | null;
  } | null;
  session: {
    id: string;
    status: string;
  } | null;
}

interface ListGuestSessionsResponse {
  guestSessions: GuestSessionListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Lambda handler for listing guest sessions
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[ListGuestSessions] Event:', JSON.stringify(event, null, 2));

  try {
    // 1. Authentication check
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing authorization header' }),
      };
    }

    const userData = verifyToken(authHeader);
    console.log('[ListGuestSessions] Authenticated user:', {
      userId: userData.sub,
      orgId: userData.orgId,
      role: userData.role,
    });

    // Role check: Only CLIENT_ADMIN and CLIENT_USER can list guest sessions
    if (userData.role !== 'CLIENT_ADMIN' && userData.role !== 'CLIENT_USER') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Forbidden: Only CLIENT_ADMIN and CLIENT_USER can list guest sessions',
        }),
      };
    }

    // 2. Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const query: ListGuestSessionsQuery = {
      status: queryParams.status as GuestSessionStatus | undefined,
      scenarioId: queryParams.scenarioId,
      guestEmail: queryParams.guestEmail,
      limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 50,
      offset: queryParams.offset ? parseInt(queryParams.offset, 10) : 0,
      sortBy: (queryParams.sortBy as 'createdAt' | 'validUntil' | 'accessCount') || 'createdAt',
      sortOrder: (queryParams.sortOrder as 'asc' | 'desc') || 'desc',
    };

    // Validate limit
    if (query.limit! < 1 || query.limit! > 100) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Limit must be between 1 and 100' }),
      };
    }

    // Validate offset
    if (query.offset! < 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Offset must be non-negative' }),
      };
    }

    // Validate status enum
    if (query.status && !['PENDING', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED'].includes(query.status)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid status value' }),
      };
    }

    console.log('[ListGuestSessions] Query params:', query);

    // 3. Build where clause
    const where: any = {
      orgId: userData.orgId, // Only sessions in user's organization
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.scenarioId) {
      where.scenarioId = query.scenarioId;
    }

    if (query.guestEmail) {
      where.guestEmail = {
        contains: query.guestEmail,
        mode: 'insensitive',
      };
    }

    // 4. Build orderBy
    const orderBy: any = {
      [query.sortBy!]: query.sortOrder,
    };

    // 5. Fetch guest sessions with pagination
    const [guestSessions, total] = await Promise.all([
      prisma.guestSession.findMany({
        where,
        orderBy,
        skip: query.offset,
        take: query.limit,
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
          session: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      prisma.guestSession.count({ where }),
    ]);

    console.log('[ListGuestSessions] Found:', {
      count: guestSessions.length,
      total,
      orgId: userData.orgId,
    });

    // 6. Format response
    const formattedSessions: GuestSessionListItem[] = guestSessions.map((gs) => ({
      id: gs.id,
      token: gs.token,
      status: gs.status,
      guestName: gs.guestName,
      guestEmail: gs.guestEmail,
      validFrom: gs.validFrom.toISOString(),
      validUntil: gs.validUntil.toISOString(),
      accessCount: gs.accessCount,
      failedAttempts: gs.failedAttempts,
      firstAccessedAt: gs.firstAccessedAt?.toISOString() || null,
      lastAccessedAt: gs.lastAccessedAt?.toISOString() || null,
      createdAt: gs.createdAt.toISOString(),
      scenario: {
        id: gs.scenario.id,
        title: gs.scenario.title,
        category: gs.scenario.category,
      },
      avatar: gs.avatar
        ? {
            id: gs.avatar.id,
            name: gs.avatar.name,
            thumbnailUrl: gs.avatar.thumbnailUrl,
          }
        : null,
      session: gs.session
        ? {
            id: gs.session.id,
            status: gs.session.status,
          }
        : null,
    }));

    const response: ListGuestSessionsResponse = {
      guestSessions: formattedSessions,
      pagination: {
        total,
        limit: query.limit!,
        offset: query.offset!,
        hasMore: query.offset! + query.limit! < total,
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[ListGuestSessions] Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
