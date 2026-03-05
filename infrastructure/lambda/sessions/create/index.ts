import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

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
      return errorResponse(401, 'Unauthorized');
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { scenarioId, avatarId, metadata } = body;

    // Validate required fields
    if (!scenarioId) {
      return errorResponse(400, 'Validation Error', 'scenarioId is required');
    }

    if (!avatarId) {
      return errorResponse(400, 'Validation Error', 'avatarId is required');
    }

    // Verify scenario exists and belongs to the user's organization
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId },
      select: { id: true, orgId: true },
    });

    if (!scenario) {
      return errorResponse(404, 'Scenario not found');
    }

    if (scenario.orgId !== user.organizationId) {
      return errorResponse(403, 'Access denied to this scenario');
    }

    // Verify avatar exists and belongs to the user's organization
    const avatar = await prisma.avatar.findUnique({
      where: { id: avatarId },
      select: { id: true, orgId: true },
    });

    if (!avatar) {
      return errorResponse(404, 'Avatar not found');
    }

    if (avatar.orgId !== user.organizationId) {
      return errorResponse(403, 'Access denied to this avatar');
    }

    // Create session
    const session = await prisma.session.create({
      data: {
        userId: user.userId,
        orgId: user.organizationId,
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
    return errorResponse(500, 'Failed to create session', error instanceof Error ? error.message : undefined);
  }
};
