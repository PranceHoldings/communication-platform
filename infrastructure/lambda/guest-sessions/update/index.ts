/**
 * Update Guest Session Lambda Function
 *
 * PATCH /api/guest-sessions/:id
 *
 * Updates a guest session's properties.
 * Only CLIENT_ADMIN can update sessions in their organization.
 *
 * @module guest-sessions/update
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient, GuestSessionStatus } from '@prisma/client';
import { verifyToken, extractTokenFromHeader } from '../../shared/auth/jwt';

const prisma = new PrismaClient();

interface UpdateGuestSessionRequest {
  guestName?: string;
  guestEmail?: string;
  guestMetadata?: Record<string, any>;
  validUntil?: string; // ISO 8601 date string
  dataRetentionDays?: number;
  status?: GuestSessionStatus;
}

interface UpdateGuestSessionResponse {
  guestSession: {
    id: string;
    status: string;
    guestName: string | null;
    guestEmail: string | null;
    validUntil: string;
    updatedAt: string;
  };
}

/**
 * Lambda handler for updating guest sessions
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[UpdateGuestSession] Event:', JSON.stringify(event, null, 2));

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
    console.log('[UpdateGuestSession] Authenticated user:', {
      userId: userData.userId,
      orgId: userData.orgId,
      role: userData.role,
    });

    // Role check: Only CLIENT_ADMIN and SUPER_ADMIN can update guest sessions
    if (userData.role !== 'CLIENT_ADMIN' && userData.role !== 'SUPER_ADMIN') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Forbidden: Only CLIENT_ADMIN and SUPER_ADMIN can update guest sessions',
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

    // 3. Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const body: UpdateGuestSessionRequest = JSON.parse(event.body);

    // 4. Check if guest session exists and belongs to organization
    const existingSession = await prisma.guestSession.findUnique({
      where: { id: guestSessionId },
      select: {
        id: true,
        orgId: true,
        status: true,
        validUntil: true,
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

    // 5. Validate update fields
    const updateData: any = {};

    if (body.guestName !== undefined) {
      updateData.guestName = body.guestName;
    }

    if (body.guestEmail !== undefined) {
      updateData.guestEmail = body.guestEmail;
    }

    if (body.guestMetadata !== undefined) {
      updateData.guestMetadata = body.guestMetadata;
    }

    if (body.validUntil !== undefined) {
      const validUntilDate = new Date(body.validUntil);
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

      updateData.validUntil = validUntilDate;
    }

    if (body.dataRetentionDays !== undefined) {
      if (body.dataRetentionDays < 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'dataRetentionDays must be non-negative' }),
        };
      }

      updateData.dataRetentionDays = body.dataRetentionDays;

      // Recalculate auto_delete_at
      if (body.dataRetentionDays > 0) {
        const validUntil = updateData.validUntil || existingSession.validUntil;
        updateData.autoDeleteAt = new Date(
          validUntil.getTime() + body.dataRetentionDays * 24 * 60 * 60 * 1000
        );
      } else {
        updateData.autoDeleteAt = null;
      }
    }

    if (body.status !== undefined) {
      // Validate status enum
      if (!['PENDING', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED'].includes(body.status)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid status value' }),
        };
      }

      updateData.status = body.status;
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No fields to update' }),
      };
    }

    console.log('[UpdateGuestSession] Updating guest session:', {
      id: guestSessionId,
      fields: Object.keys(updateData),
    });

    // 6. Update guest session
    const updatedSession = await prisma.guestSession.update({
      where: { id: guestSessionId },
      data: updateData,
      select: {
        id: true,
        status: true,
        guestName: true,
        guestEmail: true,
        validUntil: true,
        updatedAt: true,
      },
    });

    // 7. Create audit log
    await prisma.guestSessionLog.create({
      data: {
        guestSessionId: guestSessionId,
        eventType: 'UPDATED',
        ipAddress: event.requestContext?.identity?.sourceIp || null,
        userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || null,
        details: {
          updatedBy: userData.userId,
          updatedFields: Object.keys(updateData),
          oldStatus: existingSession.status,
          newStatus: updatedSession.status,
        },
      },
    });

    console.log('[UpdateGuestSession] Guest session updated:', {
      id: updatedSession.id,
      status: updatedSession.status,
    });

    // 8. Return response
    const response: UpdateGuestSessionResponse = {
      guestSession: {
        id: updatedSession.id,
        status: updatedSession.status,
        guestName: updatedSession.guestName,
        guestEmail: updatedSession.guestEmail,
        validUntil: updatedSession.validUntil.toISOString(),
        updatedAt: updatedSession.updatedAt.toISOString(),
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
    console.error('[UpdateGuestSession] Error:', error);

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
