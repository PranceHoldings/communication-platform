/**
 * Get Guest Session Detail Lambda Function
 *
 * GET /api/guest-sessions/:id
 *
 * Retrieves detailed information about a specific guest session.
 * Only CLIENT_ADMIN and CLIENT_USER can view sessions in their organization.
 *
 * @module guest-sessions/get
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { verifyToken, extractTokenFromHeader } from '../../shared/auth/jwt';
import { getAllowOriginHeader, setRequestOrigin, successResponse } from '../../shared/utils/response';

const prisma = new PrismaClient();

interface GuestSessionDetail {
  id: string;
  token: string;
  status: string;
  guestName: string | null;
  guestEmail: string | null;
  guestMetadata: any;
  validFrom: string;
  validUntil: string;
  accessCount: number;
  failedAttempts: number;
  lockedUntil: string | null;
  firstAccessedAt: string | null;
  lastAccessedAt: string | null;
  dataRetentionDays: number | null;
  autoDeleteAt: string | null;
  createdAt: string;
  updatedAt: string;
  scenario: {
    id: string;
    title: string;
    category: string;
  };
  avatar: {
    id: string;
    name: string;
    type: string;
    thumbnailUrl: string | null;
  } | null;
  session: {
    id: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    durationSec: number | null;
  } | null;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
  };
  recentLogs: Array<{
    id: string;
    eventType: string;
    ipAddress: string | null;
    userAgent: string | null;
    details: any;
    createdAt: string;
  }>;
}

/**
 * Lambda handler for getting guest session detail
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('[GetGuestSession] Event:', JSON.stringify(event, null, 2));
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
    console.log('[GetGuestSession] Authenticated user:', {
      userId: userData.userId,
      orgId: userData.orgId,
      role: userData.role,
    });

    // Role check: Only CLIENT_ADMIN, CLIENT_USER, and SUPER_ADMIN can view guest sessions
    if (
      userData.role !== 'CLIENT_ADMIN' &&
      userData.role !== 'CLIENT_USER' &&
      userData.role !== 'SUPER_ADMIN'
    ) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error:
            'Forbidden: Only CLIENT_ADMIN, CLIENT_USER, and SUPER_ADMIN can view guest sessions',
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

    console.log('[GetGuestSession] Fetching guest session:', guestSessionId);

    // 3. Fetch guest session with all relations
    const guestSession = await prisma.guestSession.findUnique({
      where: { id: guestSessionId },
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
            type: true,
            thumbnailUrl: true,
          },
        },
        session: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
            durationSec: true,
          },
        },
        creatorUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        logs: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
          select: {
            id: true,
            eventType: true,
            ipAddress: true,
            userAgent: true,
            details: true,
            createdAt: true,
          },
        },
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

    // 4. Check organization ownership
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

    console.log('[GetGuestSession] Guest session found:', {
      id: guestSession.id,
      status: guestSession.status,
      orgId: guestSession.orgId,
    });

    // 5. Format response
    const response: GuestSessionDetail = {
      id: guestSession.id,
      token: guestSession.token,
      status: guestSession.status,
      guestName: guestSession.guestName,
      guestEmail: guestSession.guestEmail,
      guestMetadata: guestSession.guestMetadata,
      validFrom: guestSession.validFrom.toISOString(),
      validUntil: guestSession.validUntil.toISOString(),
      accessCount: guestSession.accessCount,
      failedAttempts: guestSession.failedAttempts,
      lockedUntil: guestSession.lockedUntil?.toISOString() || null,
      firstAccessedAt: guestSession.firstAccessedAt?.toISOString() || null,
      lastAccessedAt: guestSession.lastAccessedAt?.toISOString() || null,
      dataRetentionDays: guestSession.dataRetentionDays,
      autoDeleteAt: guestSession.autoDeleteAt?.toISOString() || null,
      createdAt: guestSession.createdAt.toISOString(),
      updatedAt: guestSession.updatedAt.toISOString(),
      scenario: {
        id: guestSession.scenario.id,
        title: guestSession.scenario.title,
        category: guestSession.scenario.category,
      },
      avatar: guestSession.avatar
        ? {
            id: guestSession.avatar.id,
            name: guestSession.avatar.name,
            type: guestSession.avatar.type,
            thumbnailUrl: guestSession.avatar.thumbnailUrl,
          }
        : null,
      session: guestSession.session
        ? {
            id: guestSession.session.id,
            status: guestSession.session.status,
            startedAt: guestSession.session.startedAt.toISOString(),
            endedAt: guestSession.session.endedAt?.toISOString() || null,
            durationSec: guestSession.session.durationSec,
          }
        : null,
      creator: {
        id: guestSession.creatorUser.id,
        name: guestSession.creatorUser.name,
        email: guestSession.creatorUser.email,
      },
      organization: {
        id: guestSession.organization.id,
        name: guestSession.organization.name,
      },
      recentLogs: guestSession.logs.map(log => ({
        id: log.id,
        eventType: log.eventType,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        details: log.details,
        createdAt: log.createdAt.toISOString(),
      })),
    };

    return successResponse({ guestSession: response });
  } catch (error) {
    console.error('[GetGuestSession] Error:', error);

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
