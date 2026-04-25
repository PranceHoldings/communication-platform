import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse, setRequestOrigin } from '../../shared/utils/response';

/**
 * PUT /api/v1/sessions/{id}/end
 *
 * Forcefully ends an ACTIVE session via REST API.
 * Used as a fallback when the WebSocket connection is unavailable
 * (e.g. browser tab close, network failure, page reload).
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('End session request:', JSON.stringify(event, null, 2));

  try {
    setRequestOrigin(event.headers?.Origin || event.headers?.origin);
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    const sessionId = event.pathParameters?.id;
    if (!sessionId) {
      return errorResponse(400, 'Session ID is required');
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true, startedAt: true },
    });

    if (!session) {
      return errorResponse(404, 'Session not found');
    }

    if (session.userId !== user.userId) {
      return errorResponse(403, 'Access denied to this session');
    }

    if (session.status !== 'ACTIVE') {
      // Already ended — return current state without error
      return successResponse({ id: sessionId, status: session.status });
    }

    const endedAt = new Date();
    const durationSec = Math.floor(
      (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000
    );

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', endedAt, durationSec },
    });

    console.log(`Session ${sessionId} ended via REST API (duration: ${durationSec}s)`);

    return successResponse({ id: sessionId, status: 'COMPLETED', durationSec });
  } catch (error) {
    console.error('Error ending session:', error);
    return errorResponse(
      500,
      'Failed to end session',
      error instanceof Error ? error.message : undefined
    );
  } finally {
    await prisma.$disconnect();
  }
};
