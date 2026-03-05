import { APIGatewayProxyHandler } from 'aws-lambda';
import { getPrismaClient } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * GET /api/v1/sessions/{id}
 *
 * Get session details by ID
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Get session request:', JSON.stringify(event, null, 2));

  try {
    // Get authenticated user
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // Get session ID from path parameters
    const sessionId = event.pathParameters?.id;
    if (!sessionId) {
      return errorResponse(400, 'Session ID is required');
    }

    const prisma = getPrismaClient();

    // Get session from database
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        scenario: {
          select: {
            id: true,
            title: true,
            description: true,
            systemPrompt: true,
            evaluationCriteria: true,
          },
        },
        avatar: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            modelUrl: true,
            voiceSettings: true,
          },
        },
        recording: {
          select: {
            id: true,
            recordingUrl: true,
            thumbnailUrl: true,
            duration: true,
            fileSize: true,
            metadata: true,
          },
        },
        transcript: {
          select: {
            id: true,
            segments: true,
            summary: true,
            analysis: true,
          },
        },
      },
    });

    if (!session) {
      return errorResponse(404, 'Session not found');
    }

    // Verify user has access to this session
    if (session.userId !== user.userId) {
      return errorResponse(403, 'Access denied to this session');
    }

    console.log(`Session retrieved: ${session.id}`);

    return successResponse({
      id: session.id,
      scenarioId: session.scenarioId,
      scenario: session.scenario,
      avatarId: session.avatarId,
      avatar: session.avatar,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      recording: session.recording,
      transcript: session.transcript,
      metadata: session.metadata,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return errorResponse(500, 'Failed to get session', error instanceof Error ? error.message : undefined);
  }
};
