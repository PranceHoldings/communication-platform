import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../shared/types';

/**
 * POST /api/v1/sessions
 *
 * Create a new session
 *
 * Request Body:
 * {
 *   "scenarioId": "uuid",
 *   "avatarId": "uuid",
 *   "metadata": {}  // optional
 * }
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Create session request:', JSON.stringify(event, null, 2));

  try {
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(new AuthenticationError());
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { scenarioId, avatarId, metadata } = body;

    // Validate required fields
    if (!scenarioId) {
      return errorResponse(new ValidationError('scenarioId is required'));
    }

    if (!avatarId) {
      return errorResponse(new ValidationError('avatarId is required'));
    }

    // Verify scenario exists and user has access to it
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { id: true, orgId: true, visibility: true },
    });

    if (!scenario) {
      return errorResponse(new NotFoundError('Scenario'));
    }

    // Check access: must be same org OR scenario is PUBLIC
    if (scenario.orgId !== user.orgId && scenario.visibility !== 'PUBLIC') {
      return errorResponse(new AuthorizationError('Access denied to this scenario'));
    }

    // Verify avatar exists and user has access to it
    const avatar = await prisma.avatar.findUnique({
      where: { id: avatarId },
      select: { id: true, orgId: true, visibility: true, source: true },
    });

    if (!avatar) {
      return errorResponse(new NotFoundError('Avatar'));
    }

    // Check access: must be same org OR avatar is PUBLIC OR avatar is PRESET
    if (
      avatar.orgId !== user.orgId &&
      avatar.visibility !== 'PUBLIC' &&
      avatar.source !== 'PRESET'
    ) {
      return errorResponse(new AuthorizationError('Access denied to this avatar'));
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        userId: user.userId,
        orgId: user.orgId,
        scenarioId,
        avatarId,
        status: 'ACTIVE',
        metadataJson: metadata || {},
      },
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
      },
    });

    console.log(`Session created: ${session.id} for user ${user.userId}`);

    return successResponse(
      {
        id: session.id,
        scenarioId: session.scenarioId,
        scenario: session.scenario,
        avatarId: session.avatarId,
        avatar: {
          ...session.avatar,
          imageUrl: session.avatar.thumbnailUrl, // Map thumbnailUrl to imageUrl for frontend compatibility
        },
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        duration: session.durationSec,
        metadata: session.metadataJson,
        createdAt: session.startedAt, // Use startedAt as createdAt for frontend compatibility
      },
      201
    );
  } catch (error) {
    console.error('Error creating session:', error);
    if (error instanceof Error) {
      return errorResponse(error);
    }
    return errorResponse(new Error('Failed to create session'));
  }
};
