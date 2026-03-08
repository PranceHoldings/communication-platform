import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * GET /api/v1/sessions/{id}
 *
 * Get session details by ID
 */
export const handler: APIGatewayProxyHandler = async event => {
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

    // Get session from database
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        scenario: {
          select: {
            id: true,
            title: true,
            category: true,
            language: true,
            configJson: true,
          },
        },
        avatar: {
          select: {
            id: true,
            name: true,
            type: true,
            thumbnailUrl: true,
            modelUrl: true,
          },
        },
        recordings: {
          select: {
            id: true,
            type: true,
            s3Key: true,
            s3Url: true,
            cdnUrl: true,
            thumbnailUrl: true,
            fileSizeBytes: true,
            durationSec: true,
            format: true,
            resolution: true,
            videoChunksCount: true,
            processingStatus: true,
            processedAt: true,
            errorMessage: true,
            createdAt: true,
          },
        },
        transcripts: {
          select: {
            id: true,
            speaker: true,
            text: true,
            timestampStart: true,
            timestampEnd: true,
            confidence: true,
            highlight: true,
          },
          orderBy: {
            timestampStart: 'asc',
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
      avatar: session.avatar
        ? {
            ...session.avatar,
            imageUrl: session.avatar.thumbnailUrl, // Map thumbnailUrl to imageUrl for frontend compatibility
          }
        : null,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      duration: session.durationSec,
      recordings: session.recordings,
      transcripts: session.transcripts,
      metadata: session.metadataJson,
      createdAt: session.startedAt, // Use startedAt as createdAt for frontend compatibility
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return errorResponse(
      500,
      'Failed to get session',
      error instanceof Error ? error.message : undefined
    );
  }
};
