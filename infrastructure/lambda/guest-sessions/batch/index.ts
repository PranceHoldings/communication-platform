/**
 * Batch Create Guest Sessions Lambda Function
 *
 * POST /api/guest-sessions/batch
 *
 * Creates multiple guest sessions at once for bulk invitation scenarios.
 * Returns individual results for each creation attempt.
 *
 * @module guest-sessions/batch
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { generateToken, generatePin, validateCustomPin } from '../../shared/utils/tokenGenerator';
import { hashPin } from '../../shared/utils/pinHash';
import { verifyToken, extractTokenFromHeader } from '../../shared/auth/jwt';
import { getFrontendUrl } from '../../shared/utils/env-validator';

const prisma = new PrismaClient();

const FRONTEND_URL = getFrontendUrl();

interface BatchGuestSessionItem {
  scenarioId: string;
  avatarId?: string;
  guestName?: string;
  guestEmail?: string;
  guestMetadata?: Record<string, any>;
  validUntil: string; // ISO 8601 date string
  dataRetentionDays?: number;
  pinCode?: string; // Custom PIN (optional)
}

interface BatchCreateGuestSessionsRequest {
  sessions: BatchGuestSessionItem[];
  sharedValidUntil?: string; // Optional: apply to all sessions without individual validUntil
  sharedDataRetentionDays?: number; // Optional: apply to all sessions
}

interface BatchGuestSessionResult {
  success: boolean;
  guestSession?: {
    id: string;
    token: string;
    pinCode: string;
    inviteUrl: string;
    guestName: string | null;
    guestEmail: string | null;
  };
  error?: string;
  index: number;
}

interface BatchCreateGuestSessionsResponse {
  results: BatchGuestSessionResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * Lambda handler for batch creating guest sessions
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('[BatchCreateGuestSessions] Event:', JSON.stringify(event, null, 2));

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
    console.log('[BatchCreateGuestSessions] Authenticated user:', {
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

    const body: BatchCreateGuestSessionsRequest = JSON.parse(event.body);

    if (!body.sessions || !Array.isArray(body.sessions) || body.sessions.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing or empty sessions array' }),
      };
    }

    // Limit batch size
    if (body.sessions.length > 100) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Batch size cannot exceed 100 sessions' }),
      };
    }

    console.log('[BatchCreateGuestSessions] Creating batch:', {
      count: body.sessions.length,
      orgId: userData.orgId,
    });

    // 3. Process each session
    const results: BatchGuestSessionResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < body.sessions.length; i++) {
      const item = body.sessions[i];

      try {
        // Validate required fields
        if (!item.scenarioId) {
          results.push({
            success: false,
            error: 'Missing required field: scenarioId',
            index: i,
          });
          failCount++;
          continue;
        }

        // Use individual validUntil or shared one
        const validUntilStr = item.validUntil || body.sharedValidUntil;
        if (!validUntilStr) {
          results.push({
            success: false,
            error: 'Missing validUntil (individual or shared)',
            index: i,
          });
          failCount++;
          continue;
        }

        // Validate validUntil date
        const validUntilDate = new Date(validUntilStr);
        if (isNaN(validUntilDate.getTime())) {
          results.push({
            success: false,
            error: 'Invalid validUntil date format',
            index: i,
          });
          failCount++;
          continue;
        }

        if (validUntilDate <= new Date()) {
          results.push({
            success: false,
            error: 'validUntil must be in the future',
            index: i,
          });
          failCount++;
          continue;
        }

        // Validate custom PIN if provided
        if (item.pinCode) {
          const pinValidation = validateCustomPin(item.pinCode);
          if (!pinValidation.isValid) {
            results.push({
              success: false,
              error: `Invalid PIN: ${pinValidation.error}`,
              index: i,
            });
            failCount++;
            continue;
          }
        }

        // Validate scenario exists and belongs to the organization
        const scenario = await prisma.scenario.findUnique({
          where: { id: item.scenarioId },
          select: { id: true, orgId: true },
        });

        if (!scenario) {
          results.push({
            success: false,
            error: 'Scenario not found',
            index: i,
          });
          failCount++;
          continue;
        }

        if (scenario.orgId !== userData.orgId) {
          results.push({
            success: false,
            error: 'Scenario does not belong to your organization',
            index: i,
          });
          failCount++;
          continue;
        }

        // Validate avatar if provided
        if (item.avatarId) {
          const avatar = await prisma.avatar.findUnique({
            where: { id: item.avatarId },
            select: { id: true, orgId: true },
          });

          if (!avatar) {
            results.push({
              success: false,
              error: 'Avatar not found',
              index: i,
            });
            failCount++;
            continue;
          }

          if (avatar.orgId !== userData.orgId) {
            results.push({
              success: false,
              error: 'Avatar does not belong to your organization',
              index: i,
            });
            failCount++;
            continue;
          }
        }

        // Generate token and PIN
        const token = generateToken();
        const pin = item.pinCode || generatePin(4);
        const pinHash = await hashPin(pin);

        // Calculate auto_delete_at
        const dataRetentionDays = item.dataRetentionDays ?? body.sharedDataRetentionDays;
        let autoDeleteAt: Date | undefined;
        if (dataRetentionDays && dataRetentionDays > 0) {
          autoDeleteAt = new Date(
            validUntilDate.getTime() + dataRetentionDays * 24 * 60 * 60 * 1000
          );
        }

        // Create guest session
        const guestSession = await prisma.guestSession.create({
          data: {
            orgId: userData.orgId,
            creatorUserId: userData.userId,
            scenarioId: item.scenarioId,
            avatarId: item.avatarId || null,
            token,
            pinHash,
            guestName: item.guestName || null,
            guestEmail: item.guestEmail || null,
            guestMetadata: item.guestMetadata || {},
            status: 'PENDING',
            validFrom: new Date(),
            validUntil: validUntilDate,
            dataRetentionDays: dataRetentionDays || null,
            autoDeleteAt: autoDeleteAt || null,
          },
        });

        // Create audit log
        await prisma.guestSessionLog.create({
          data: {
            guestSessionId: guestSession.id,
            eventType: 'CREATED',
            ipAddress: event.requestContext?.identity?.sourceIp || null,
            userAgent: event.headers['User-Agent'] || event.headers['user-agent'] || null,
            details: {
              createdBy: userData.userId,
              batchIndex: i,
            },
          },
        });

        // Generate invite URL
        const inviteUrl = `${FRONTEND_URL}/guest/${token}`;

        results.push({
          success: true,
          guestSession: {
            id: guestSession.id,
            token,
            pinCode: pin,
            inviteUrl,
            guestName: guestSession.guestName,
            guestEmail: guestSession.guestEmail,
          },
          index: i,
        });

        successCount++;

        console.log('[BatchCreateGuestSessions] Created session:', {
          index: i,
          id: guestSession.id,
          guestEmail: guestSession.guestEmail,
        });
      } catch (error) {
        console.error(`[BatchCreateGuestSessions] Error creating session ${i}:`, error);

        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          index: i,
        });
        failCount++;
      }
    }

    console.log('[BatchCreateGuestSessions] Batch complete:', {
      total: body.sessions.length,
      successful: successCount,
      failed: failCount,
    });

    // 4. Return response
    const response: BatchCreateGuestSessionsResponse = {
      results,
      summary: {
        total: body.sessions.length,
        successful: successCount,
        failed: failCount,
      },
    };

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('[BatchCreateGuestSessions] Error:', error);

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
