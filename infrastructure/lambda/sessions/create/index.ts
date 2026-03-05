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
        scenarioId,
        avatarId,
        status: 'pending',
        metadata: metadata || {},
      },
      include: {
        scenario: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        avatar: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
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
        avatar: session.avatar,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        metadata: session.metadata,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      201
    );
  } catch (error) {
    console.error('Error creating session:', error);
    return errorResponse(500, 'Failed to create session', error instanceof Error ? error.message : undefined);
  }
};
