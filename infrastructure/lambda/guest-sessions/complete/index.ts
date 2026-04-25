/**
 * Complete Guest Session Lambda Function
 *
 * POST /api/guest-sessions/:id/complete
 *
 * Marks a guest session as COMPLETED.
 * Can be called by the guest (via guest JWT) or by internal users.
 *
 * @module guest-sessions/complete
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { getAllowOriginHeader, setRequestOrigin } from '../../shared/utils/response';

const prisma = new PrismaClient();

interface CompleteGuestSessionResponse {
  message: string;
  guestSession: {
    id: string;
    status: string;
    completedAt: string;
  };
}

/**
 * Lambda handler for completing guest sessions
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('[CompleteGuestSession] Event:', JSON.stringify(event, null, 2));
  setRequestOrigin(event?.headers?.Origin || event?.headers?.origin);

  try {
    // 1. Authentication check - use Lambda Authorizer context
    const userData = getUserFromEvent(event);
    if (!userData) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    console.log('[CompleteGuestSession] Authenticated user:', {
      userId: userData.userId,
      orgId: userData.orgId,
      role: userData.role,
    });

    // 2. Extract ID from path parameters
    const guestSessionId = event.pathParameters?.id;

    if (!guestSessionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing guest session ID' }),
      };
    }

    console.log('[CompleteGuestSession] Completing guest session:', guestSessionId);

    // 3. Check if guest session exists
    const guestSession = await prisma.guestSession.findUnique({
      where: { id: guestSessionId },
      select: {
        id: true,
        orgId: true,
        status: true,
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

    // 4. Authorization check
    // - Guest can complete their own session (userData.guestSessionId === guestSessionId)
    // - Internal users can complete sessions in their organization
    const isGuest = userData.role === 'GUEST';
    const isInternalUser =
      userData.role === 'CLIENT_ADMIN' ||
      userData.role === 'CLIENT_USER' ||
      userData.role === 'SUPER_ADMIN';

    if (isGuest) {
      // Guest must be completing their own session
      if (userData.guestSessionId !== guestSessionId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
          },
          body: JSON.stringify({ error: 'Forbidden: Cannot complete another guest session' }),
        };
      }
    } else if (isInternalUser) {
      // Internal user must be in the same organization
      if (guestSession.orgId !== userData.orgId) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
          },
          body: JSON.stringify({
            error: 'Forbidden: Guest session does not belong to your organization',
          }),
        };
      }
    } else {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden: Invalid role' }),
      };
    }

    // 5. Check if already completed
    if (guestSession.status === 'COMPLETED') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Guest session is already completed' }),
      };
    }

    // 6. Check if revoked or expired
    if (guestSession.status === 'REVOKED') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Guest session is revoked' }),
      };
    }

    if (guestSession.status === 'EXPIRED') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Guest session is expired' }),
      };
    }

    // 7. Mark as completed
    const completedSession = await prisma.guestSession.update({
      where: { id: guestSessionId },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    // 8. Create audit log
    await prisma.guestSessionLog.create({
      data: {
        guestSessionId: guestSessionId,
        eventType: 'COMPLETED',
        ipAddress: event.requestContext?.identity?.sourceIp || null,
        userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || null,
        details: {
          completedBy: isGuest ? 'GUEST' : userData.userId,
          role: userData.role,
        },
      },
    });

    console.log('[CompleteGuestSession] Guest session completed:', {
      id: completedSession.id,
      status: completedSession.status,
    });

    // 9. Return response
    const response: CompleteGuestSessionResponse = {
      message: 'Guest session completed successfully',
      guestSession: {
        id: completedSession.id,
        status: completedSession.status,
        completedAt: completedSession.updatedAt.toISOString(),
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
    console.error('[CompleteGuestSession] Error:', error);

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
