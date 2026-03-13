/**
 * Delete/Revoke Guest Session Lambda Function
 *
 * DELETE /api/guest-sessions/:id
 *
 * Revokes a guest session, preventing further access.
 * Only CLIENT_ADMIN can revoke sessions in their organization.
 *
 * @module guest-sessions/delete
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { verifyToken, extractTokenFromHeader } from '../../shared/auth/jwt';

const prisma = new PrismaClient();

interface RevokeGuestSessionResponse {
  message: string;
  guestSession: {
    id: string;
    status: string;
    revokedAt: string;
  };
}

/**
 * Lambda handler for revoking guest sessions
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[RevokeGuestSession] Event:', JSON.stringify(event, null, 2));

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
    console.log('[RevokeGuestSession] Authenticated user:', {
      userId: userData.userId,
      orgId: userData.orgId,
      role: userData.role,
    });

    // Role check: Only CLIENT_ADMIN and SUPER_ADMIN can revoke guest sessions
    if (userData.role !== 'CLIENT_ADMIN' && userData.role !== 'SUPER_ADMIN') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Forbidden: Only CLIENT_ADMIN and SUPER_ADMIN can revoke guest sessions',
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

    console.log('[RevokeGuestSession] Revoking guest session:', guestSessionId);

    // 3. Check if guest session exists and belongs to organization
    const existingSession = await prisma.guestSession.findUnique({
      where: { id: guestSessionId },
      select: {
        id: true,
        orgId: true,
        status: true,
      },
    });

    if (!existingSession) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Guest session not found' }),
      };
    }

    if (existingSession.orgId !== userData.orgId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Guest session does not belong to your organization' }),
      };
    }

    // 4. Check if already revoked
    if (existingSession.status === 'REVOKED') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Guest session is already revoked' }),
      };
    }

    // 5. Revoke the guest session
    const revokedSession = await prisma.guestSession.update({
      where: { id: guestSessionId },
      data: {
        status: 'REVOKED',
        updatedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    // 6. Create audit log
    await prisma.guestSessionLog.create({
      data: {
        guestSessionId: guestSessionId,
        eventType: 'REVOKED',
        ipAddress: event.requestContext?.identity?.sourceIp || null,
        userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || null,
        details: {
          revokedBy: userData.userId,
          previousStatus: existingSession.status,
        },
      },
    });

    console.log('[RevokeGuestSession] Guest session revoked:', {
      id: revokedSession.id,
      status: revokedSession.status,
    });

    // 7. Return response
    const response: RevokeGuestSessionResponse = {
      message: 'Guest session revoked successfully',
      guestSession: {
        id: revokedSession.id,
        status: revokedSession.status,
        revokedAt: revokedSession.updatedAt.toISOString(),
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
    console.error('[RevokeGuestSession] Error:', error);

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
