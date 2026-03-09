import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * GET /api/v1/sessions/{id}/score
 *
 * Get session score (lightweight endpoint for quick score display)
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('[GetScore] Request:', JSON.stringify(event, null, 2));

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

    console.log('[GetScore] Fetching score for session:', sessionId);

    // Get session to verify access
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        orgId: true,
        status: true,
        metadataJson: true,
      },
    });

    if (!session) {
      return errorResponse(404, 'Session not found');
    }

    // Verify user has access to this session
    if (session.userId !== user.userId) {
      return errorResponse(403, 'Access denied to this session');
    }

    // Get session score
    const sessionScore = await prisma.sessionScore.findUnique({
      where: { sessionId },
      select: {
        id: true,
        overallScore: true,
        emotionScore: true,
        audioScore: true,
        contentScore: true,
        deliveryScore: true,
        emotionStability: true,
        emotionPositivity: true,
        confidence: true,
        engagement: true,
        clarity: true,
        fluency: true,
        pacing: true,
        volume: true,
        relevance: true,
        structure: true,
        completeness: true,
        strengths: true,
        improvements: true,
        criteria: true,
        weights: true,
        calculatedAt: true,
        version: true,
      },
    });

    if (!sessionScore) {
      // Check if analysis is in progress
      const metadata = session.metadataJson as any;
      if (metadata?.analysisInProgress) {
        return errorResponse(
          202,
          'Analysis in progress',
          'Score calculation is currently in progress. Please try again in a few moments.'
        );
      }

      return errorResponse(
        404,
        'Score not found',
        'No score available for this session. Please trigger analysis first.'
      );
    }

    // Calculate score level (excellent, good, fair, etc.)
    const scoreLevel = getScoreLevel(sessionScore.overallScore);

    console.log('[GetScore] Score retrieved successfully', {
      sessionId,
      overallScore: sessionScore.overallScore,
      scoreLevel,
    });

    return successResponse({
      sessionId,
      score: {
        ...sessionScore,
        level: scoreLevel.level,
        label: scoreLevel.label,
        description: scoreLevel.description,
        color: scoreLevel.color,
      },
    });
  } catch (error) {
    console.error('[GetScore] Error:', error);
    return errorResponse(
      500,
      'Failed to get score',
      error instanceof Error ? error.message : undefined
    );
  }
};

/**
 * Determine score level based on overall score
 */
function getScoreLevel(score: number): {
  level: string;
  label: string;
  description: string;
  color: string;
} {
  if (score >= 90) {
    return {
      level: 'excellent',
      label: 'Excellent',
      description: 'Outstanding performance',
      color: '#10b981', // green-500
    };
  } else if (score >= 80) {
    return {
      level: 'very_good',
      label: 'Very Good',
      description: 'Strong performance with minor areas for improvement',
      color: '#3b82f6', // blue-500
    };
  } else if (score >= 70) {
    return {
      level: 'good',
      label: 'Good',
      description: 'Solid performance with some areas for improvement',
      color: '#06b6d4', // cyan-500
    };
  } else if (score >= 60) {
    return {
      level: 'fair',
      label: 'Fair',
      description: 'Adequate performance but significant room for improvement',
      color: '#f59e0b', // amber-500
    };
  } else if (score >= 50) {
    return {
      level: 'needs_improvement',
      label: 'Needs Improvement',
      description: 'Performance below expectations, requires focused practice',
      color: '#f97316', // orange-500
    };
  } else {
    return {
      level: 'poor',
      label: 'Poor',
      description: 'Significant improvement needed in multiple areas',
      color: '#ef4444', // red-500
    };
  }
}
