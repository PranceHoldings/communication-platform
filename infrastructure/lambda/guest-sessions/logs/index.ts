/**
 * Get Guest Session Logs Lambda Function
 *
 * GET /api/guest-sessions/:id/logs
 *
 * Retrieves audit logs for a specific guest session.
 * Only CLIENT_ADMIN and CLIENT_USER can view logs in their organization.
 *
 * @module guest-sessions/logs
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { verifyToken, extractTokenFromHeader } from '../../shared/auth/jwt';
import { getAllowOriginHeader, setRequestOrigin } from '../../shared/utils/response';

const prisma = new PrismaClient();

interface GuestSessionLogItem {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: any;
  createdAt: string;
}

interface GetGuestSessionLogsResponse {
  logs: GuestSessionLogItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Lambda handler for getting guest session logs
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('[GetGuestSessionLogs] Event:', JSON.stringify(event, null, 2));
  setRequestOrigin(event?.headers?.Origin || event?.headers?.origin);

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

    const token = extractTokenFromHeader(authHeader);
    const userData = verifyToken(token);
    console.log('[GetGuestSessionLogs] Authenticated user:', {
      userId: userData.userId,
      orgId: userData.orgId,
      role: userData.role,
    });

    // Role check: Only CLIENT_ADMIN, CLIENT_USER, and SUPER_ADMIN can view logs
    if (
      userData.role !== 'CLIENT_ADMIN' &&
      userData.role !== 'CLIENT_USER' &&
      userData.role !== 'SUPER_ADMIN'
    ) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Forbidden: Only CLIENT_ADMIN, CLIENT_USER, and SUPER_ADMIN can view logs',
        }),
      };
    }

    // 2. Extract ID from path parameters
    const guestSessionId = event.pathParameters?.id;

    if (!guestSessionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing guest session ID' }),
      };
    }

    // 3. Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 50;
    const offset = queryParams.offset ? parseInt(queryParams.offset, 10) : 0;
    const eventType = queryParams.eventType;

    // Validate limit
    if (limit < 1 || limit > 200) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Limit must be between 1 and 200' }),
      };
    }

    // Validate offset
    if (offset < 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Offset must be non-negative' }),
      };
    }

    console.log('[GetGuestSessionLogs] Fetching logs:', {
      guestSessionId,
      limit,
      offset,
      eventType,
    });

    // 4. Check if guest session exists and belongs to organization
    const guestSession = await prisma.guestSession.findUnique({
      where: { id: guestSessionId },
      select: {
        id: true,
        orgId: true,
      },
    });

    if (!guestSession) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Guest session not found' }),
      };
    }

    if (guestSession.orgId !== userData.orgId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Guest session does not belong to your organization' }),
      };
    }

    // 5. Build where clause
    const where: any = {
      guestSessionId,
    };

    if (eventType) {
      where.eventType = eventType;
    }

    // 6. Fetch logs with pagination
    const [logs, total] = await Promise.all([
      prisma.guestSessionLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
        select: {
          id: true,
          eventType: true,
          ipAddress: true,
          userAgent: true,
          details: true,
          createdAt: true,
        },
      }),
      prisma.guestSessionLog.count({ where }),
    ]);

    console.log('[GetGuestSessionLogs] Found:', {
      count: logs.length,
      total,
    });

    // 7. Format response
    const formattedLogs: GuestSessionLogItem[] = logs.map(log => ({
      id: log.id,
      eventType: log.eventType,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: log.details,
      createdAt: log.createdAt.toISOString(),
    }));

    const response: GetGuestSessionLogsResponse = {
      logs: formattedLogs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[GetGuestSessionLogs] Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
