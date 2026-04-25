/**
 * Create Guest Session Lambda Function
 *
 * POST /api/guest-sessions
 *
 * Creates a new guest session with authentication token and PIN code.
 * Returns invite URL and PIN for sending to the guest.
 *
 * @module guest-sessions/create
 * @version 1.0.1
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { generateToken, generatePin, validateCustomPin } from '../../shared/utils/tokenGenerator';
import { hashPin } from '../../shared/utils/pinHash';
import { verifyToken, extractTokenFromHeader } from '../../shared/auth/jwt';
import { getFrontendUrl } from '../../shared/utils/env-validator';
import { getAllowOriginHeader, setRequestOrigin } from '../../shared/utils/response';

const prisma = new PrismaClient();

const FRONTEND_URL = getFrontendUrl();

interface CreateGuestSessionRequest {
  scenarioId: string;
  avatarId?: string;
  guestName?: string;
  guestEmail?: string;
  guestMetadata?: Record<string, any>;
  validUntil: string; // ISO 8601 date string
  dataRetentionDays?: number;
  pinCode?: string; // Custom PIN (optional, 4-8 digits)
}

interface CreateGuestSessionResponse {
  guestSession: {
    id: string;
    token: string;
    pinCode: string;
    inviteUrl: string;
    status: string;
    validFrom: string;
    validUntil: string;
    createdAt: string;
  };
}

/**
 * Lambda handler for creating guest sessions
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('[CreateGuestSession] Event:', JSON.stringify(event, null, 2));
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

    const authToken = extractTokenFromHeader(authHeader);
    const userData = verifyToken(authToken);
    console.log('[CreateGuestSession] Authenticated user:', {
      userId: userData.userId,
      orgId: userData.orgId,
      role: userData.role,
    });

    // Role check: Only CLIENT_ADMIN, CLIENT_USER, and SUPER_ADMIN can create guest sessions
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
            'Forbidden: Only CLIENT_ADMIN, CLIENT_USER, and SUPER_ADMIN can create guest sessions',
        }),
      };
    }

    // 2. Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const body: CreateGuestSessionRequest = JSON.parse(event.body);
    const {
      scenarioId,
      avatarId,
      guestName,
      guestEmail,
      guestMetadata,
      validUntil,
      dataRetentionDays,
      pinCode,
    } = body;

    // 3. Validation
    if (!scenarioId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required field: scenarioId' }),
      };
    }

    if (!validUntil) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required field: validUntil' }),
      };
    }

    // Validate validUntil date
    const validUntilDate = new Date(validUntil);
    if (isNaN(validUntilDate.getTime())) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid validUntil date format' }),
      };
    }

    if (validUntilDate <= new Date()) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'validUntil must be in the future' }),
      };
    }

    // Validate custom PIN if provided
    if (pinCode) {
      const isValidPin = validateCustomPin(pinCode);
      if (!isValidPin) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid PIN: Must be 4-8 digits' }),
        };
      }
    }

    // Validate scenario exists and belongs to the organization
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { id: true, orgId: true },
    });

    if (!scenario) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Scenario not found' }),
      };
    }

    if (scenario.orgId !== userData.orgId) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Scenario does not belong to your organization' }),
      };
    }

    // Validate avatar if provided
    if (avatarId) {
      const avatar = await prisma.avatar.findUnique({
        where: { id: avatarId },
        select: { id: true, orgId: true },
      });

      if (!avatar) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Avatar not found' }),
        };
      }

      if (avatar.orgId !== userData.orgId) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Avatar does not belong to your organization' }),
        };
      }
    }

    // 4. Generate token and PIN
    const token = generateToken();
    const pin = pinCode || generatePin(4);
    const pinHash = await hashPin(pin);

    console.log('[CreateGuestSession] Generated credentials:', {
      token: token.substring(0, 8) + '...',
      pinLength: pin.length,
    });

    // 5. Calculate auto_delete_at
    let autoDeleteAt: Date | undefined;
    if (dataRetentionDays && dataRetentionDays > 0) {
      autoDeleteAt = new Date(validUntilDate.getTime() + dataRetentionDays * 24 * 60 * 60 * 1000);
    }

    // 6. Create guest session
    const guestSession = await prisma.guestSession.create({
      data: {
        orgId: userData.orgId,
        creatorUserId: userData.userId,
        scenarioId,
        avatarId: avatarId || null,
        token,
        pinHash,
        guestName: guestName || null,
        guestEmail: guestEmail || null,
        guestMetadata: guestMetadata || {},
        status: 'PENDING',
        validFrom: new Date(),
        validUntil: validUntilDate,
        dataRetentionDays: dataRetentionDays || null,
        autoDeleteAt: autoDeleteAt || null,
      },
      include: {
        scenario: {
          select: {
            title: true,
            category: true,
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

    // 7. Create audit log
    await prisma.guestSessionLog.create({
      data: {
        guestSessionId: guestSession.id,
        eventType: 'CREATED',
        ipAddress: event.requestContext?.identity?.sourceIp || null,
        userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || null,
        details: {
          createdBy: userData.userId,
          scenario: guestSession.scenario?.title,
          avatar: guestSession.avatar?.name,
        },
      },
    });

    console.log('[CreateGuestSession] Guest session created:', {
      id: guestSession.id,
      orgId: guestSession.orgId,
      status: guestSession.status,
    });

    // 8. Generate invite URL
    const inviteUrl = `${FRONTEND_URL}/guest/${token}`;

    // 9. Return response
    const response: CreateGuestSessionResponse = {
      guestSession: {
        id: guestSession.id,
        token,
        pinCode: pin, // ⚠️ Only included in response, not stored in DB
        inviteUrl,
        status: guestSession.status,
        validFrom: guestSession.validFrom.toISOString(),
        validUntil: guestSession.validUntil.toISOString(),
        createdAt: guestSession.createdAt.toISOString(),
      },
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[CreateGuestSession] Error:', error);

    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return {
          statusCode: 409,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Conflict: Token already exists (retry)' }),
        };
      }
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
