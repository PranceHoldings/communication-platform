/**
 * Verify Guest Token Lambda Function
 *
 * GET /api/guest/verify/:token
 *
 * Verifies if a guest session token is valid and returns basic information.
 * This endpoint is called before the guest enters their PIN.
 *
 * @module guest/verify
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { getAllowOriginHeader, setRequestOrigin } from '../../shared/utils/response';

const prisma = new PrismaClient();

interface VerifyTokenResponse {
  valid: boolean;
  guestSession?: {
    id: string;
    status: string;
    validUntil: string;
    scenario: {
      title: string;
      category: string;
    };
    organization: {
      name: string;
    };
    avatar?: {
      name: string;
      thumbnailUrl: string | null;
    };
  };
  error?: string;
}

/**
 * Lambda handler for verifying guest tokens
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('[VerifyGuestToken] Event:', JSON.stringify(event, null, 2));
  setRequestOrigin(event?.headers?.Origin || event?.headers?.origin);

  try {
    // 1. Extract token from path parameters
    const token = event.pathParameters?.token;

    if (!token) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valid: false,
          error: 'Missing token parameter',
        }),
      };
    }

    console.log('[VerifyGuestToken] Verifying token:', token.substring(0, 8) + '...');

    // 2. Find guest session
    const guestSession = await prisma.guestSession.findUnique({
      where: { token },
      include: {
        scenario: {
          select: {
            title: true,
            category: true,
          },
        },
        organization: {
          select: {
            name: true,
          },
        },
        avatar: {
          select: {
            name: true,
            thumbnailUrl: true,
          },
        },
      },
    });

    if (!guestSession) {
      console.log('[VerifyGuestToken] Token not found');
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({
          valid: false,
          error: 'Invalid token',
        }),
      };
    }

    // 3. Check if expired
    if (new Date() > guestSession.validUntil) {
      console.log('[VerifyGuestToken] Token expired');

      // Update status to EXPIRED if not already
      if (guestSession.status !== 'EXPIRED') {
        await prisma.guestSession.update({
          where: { id: guestSession.id },
          data: { status: 'EXPIRED' },
        });
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({
          valid: false,
          error: 'Token expired',
        }),
      };
    }

    // 4. Check if revoked
    if (guestSession.status === 'REVOKED') {
      console.log('[VerifyGuestToken] Token revoked');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({
          valid: false,
          error: 'Token revoked',
        }),
      };
    }

    // 5. Check if locked
    if (guestSession.lockedUntil && new Date() < guestSession.lockedUntil) {
      const lockedMinutes = Math.ceil(
        (guestSession.lockedUntil.getTime() - new Date().getTime()) / 60000
      );
      console.log('[VerifyGuestToken] Token locked for', lockedMinutes, 'minutes');

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({
          valid: false,
          error: `Too many failed attempts. Locked for ${lockedMinutes} minutes.`,
        }),
      };
    }

    // 6. Check if already completed
    if (guestSession.status === 'COMPLETED') {
      console.log('[VerifyGuestToken] Session already completed');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({
          valid: false,
          error: 'Session already completed',
        }),
      };
    }

    // 7. Log verification
    await prisma.guestSessionLog.create({
      data: {
        guestSessionId: guestSession.id,
        eventType: 'TOKEN_VERIFIED',
        ipAddress: event.requestContext?.identity?.sourceIp || null,
        userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || null,
        details: {},
      },
    });

    console.log('[VerifyGuestToken] Token valid:', {
      id: guestSession.id,
      status: guestSession.status,
    });

    // 8. Return valid response
    const response: VerifyTokenResponse = {
      valid: true,
      guestSession: {
        id: guestSession.id,
        status: guestSession.status,
        validUntil: guestSession.validUntil.toISOString(),
        scenario: {
          title: guestSession.scenario.title,
          category: guestSession.scenario.category,
        },
        organization: {
          name: guestSession.organization.name,
        },
        avatar: guestSession.avatar
          ? {
              name: guestSession.avatar.name,
              thumbnailUrl: guestSession.avatar.thumbnailUrl,
            }
          : undefined,
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
    console.error('[VerifyGuestToken] Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
      },
      body: JSON.stringify({
        valid: false,
        error: 'Internal server error',
      }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
