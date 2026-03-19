/**
 * Guest Authentication Lambda Function
 *
 * POST /api/guest/auth
 *
 * Authenticates a guest with token + PIN and issues a JWT token.
 * Implements rate limiting to prevent brute force attacks.
 *
 * @module guest/auth
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { verifyPin } from '../../shared/utils/pinHash';
import { generateGuestToken } from '../../shared/auth/guest-token';
import { checkRateLimit, recordAttempt, resetAttempts } from '../../shared/utils/rateLimiter';

const prisma = new PrismaClient();

interface AuthRequest {
  token: string;
  pinCode: string;
}

interface AuthResponse {
  success: boolean;
  accessToken?: string;
  guestSession?: {
    id: string;
    sessionId: string | null;
    scenarioId: string;
    avatarId: string | null;
    status: string;
  };
  error?: string;
  remainingAttempts?: number;
  lockedUntil?: string;
}

/**
 * Lambda handler for guest authentication
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('[GuestAuth] Event:', JSON.stringify(event, null, 2));

  try {
    // 1. Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing request body',
        }),
      };
    }

    const body: AuthRequest = JSON.parse(event.body);
    const { token, pinCode } = body;

    if (!token || !pinCode) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: token, pinCode',
        }),
      };
    }

    // 2. Get client IP address
    const ipAddress = event.requestContext?.identity?.sourceIp || 'unknown';
    console.log('[GuestAuth] Authentication attempt:', {
      token: token.substring(0, 8) + '...',
      ipAddress,
    });

    // 3. Check rate limit
    const rateLimitResult = await checkRateLimit(ipAddress, token);

    if (!rateLimitResult.allowed) {
      console.log('[GuestAuth] Rate limit exceeded:', {
        ipAddress,
        attempts: rateLimitResult.attempts,
        lockedUntil: rateLimitResult.lockedUntil,
      });

      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Too many failed attempts',
          lockedUntil: rateLimitResult.lockedUntil?.toISOString(),
        }),
      };
    }

    // 4. Find guest session
    const guestSession = await prisma.guestSession.findUnique({
      where: { token },
      include: {
        scenario: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!guestSession) {
      console.log('[GuestAuth] Token not found');

      // Record failed attempt
      await recordAttempt(ipAddress, token);

      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid token',
          remainingAttempts: rateLimitResult.remainingAttempts! - 1,
        }),
      };
    }

    // 5. Check if expired
    if (new Date() > guestSession.validUntil) {
      console.log('[GuestAuth] Token expired');

      // Update status to EXPIRED if not already
      if (guestSession.status !== 'EXPIRED') {
        await prisma.guestSession.update({
          where: { id: guestSession.id },
          data: { status: 'EXPIRED' },
        });
      }

      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Token expired',
        }),
      };
    }

    // 6. Check if revoked
    if (guestSession.status === 'REVOKED') {
      console.log('[GuestAuth] Token revoked');

      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Token revoked',
        }),
      };
    }

    // 7. Check if locked (guest-specific lock)
    if (guestSession.lockedUntil && new Date() < guestSession.lockedUntil) {
      console.log('[GuestAuth] Session locked until:', guestSession.lockedUntil);

      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Session locked due to too many failed attempts',
          lockedUntil: guestSession.lockedUntil.toISOString(),
        }),
      };
    }

    // 8. Verify PIN
    const isPinValid = await verifyPin(pinCode, guestSession.pinHash);

    if (!isPinValid) {
      console.log('[GuestAuth] Invalid PIN');

      // Record failed attempt
      await recordAttempt(ipAddress, token);

      // Increment failed attempts counter
      const updatedSession = await prisma.guestSession.update({
        where: { id: guestSession.id },
        data: {
          failedAttempts: guestSession.failedAttempts + 1,
        },
      });

      // Lock session if too many failed attempts (5)
      if (updatedSession.failedAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await prisma.guestSession.update({
          where: { id: guestSession.id },
          data: { lockedUntil },
        });

        console.log('[GuestAuth] Session locked due to too many failed attempts');

        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: false,
            error: 'Session locked due to too many failed attempts',
            lockedUntil: lockedUntil.toISOString(),
          }),
        };
      }

      // Log failed attempt
      await prisma.guestSessionLog.create({
        data: {
          guestSessionId: guestSession.id,
          eventType: 'AUTH_FAILED',
          ipAddress,
          userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || null,
          details: {
            reason: 'Invalid PIN',
            failedAttempts: updatedSession.failedAttempts,
          },
        },
      });

      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid PIN',
          remainingAttempts: Math.max(0, 5 - updatedSession.failedAttempts),
        }),
      };
    }

    // 9. PIN is valid - Reset counters
    await resetAttempts(ipAddress);

    await prisma.guestSession.update({
      where: { id: guestSession.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        accessCount: guestSession.accessCount + 1,
        firstAccessedAt: guestSession.firstAccessedAt || new Date(),
        status: guestSession.status === 'PENDING' ? 'ACTIVE' : guestSession.status,
      },
    });

    // 10. Generate guest JWT token
    const accessToken = generateGuestToken({
      guestSessionId: guestSession.id,
      orgId: guestSession.orgId,
      scenarioId: guestSession.scenarioId,
      avatarId: guestSession.avatarId,
    });

    console.log('[GuestAuth] Authentication successful:', {
      guestSessionId: guestSession.id,
      orgId: guestSession.orgId,
    });

    // 11. Log successful authentication
    await prisma.guestSessionLog.create({
      data: {
        guestSessionId: guestSession.id,
        eventType: 'AUTH_SUCCESS',
        ipAddress,
        userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || null,
        details: {
          accessCount: guestSession.accessCount + 1,
        },
      },
    });

    // 12. Return success response
    const response: AuthResponse = {
      success: true,
      accessToken,
      guestSession: {
        id: guestSession.id,
        sessionId: guestSession.sessionId,
        scenarioId: guestSession.scenarioId,
        avatarId: guestSession.avatarId,
        status: guestSession.status === 'PENDING' ? 'ACTIVE' : guestSession.status,
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
    console.error('[GuestAuth] Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
