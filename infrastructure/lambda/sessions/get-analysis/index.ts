import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

/**
 * GET /api/v1/sessions/{id}/analysis
 *
 * Get full analysis results for a session (emotion, audio, score)
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('[GetAnalysis] Request:', JSON.stringify(event, null, 2));

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

    console.log('[GetAnalysis] Fetching analysis for session:', sessionId);

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

    // Check if analysis has been completed
    const metadata = session.metadataJson as any;
    if (!metadata?.analysisCompleted) {
      return errorResponse(
        400,
        'Analysis not yet completed for this session',
        'The analysis is either in progress or has not been triggered. Please try again later or trigger analysis manually.'
      );
    }

    // Get all analysis data
    const [emotionAnalyses, audioAnalyses, sessionScore] = await Promise.all([
      prisma.emotionAnalysis.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          timestamp: true,
          frameUrl: true,
          emotions: true,
          dominantEmotion: true,
          ageRange: true,
          gender: true,
          genderConfidence: true,
          eyesOpen: true,
          eyesOpenConfidence: true,
          mouthOpen: true,
          mouthOpenConfidence: true,
          pose: true,
          confidence: true,
          brightness: true,
          sharpness: true,
          processingTimeMs: true,
          createdAt: true,
        },
      }),
      prisma.audioAnalysis.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
        select: {
          id: true,
          timestamp: true,
          pitch: true,
          pitchVariance: true,
          volume: true,
          volumeVariance: true,
          speakingRate: true,
          pauseCount: true,
          pauseDuration: true,
          clarity: true,
          confidence: true,
          snr: true,
          fillerWords: true,
          fillerCount: true,
          duration: true,
          processingTimeMs: true,
          createdAt: true,
        },
      }),
      prisma.sessionScore.findUnique({
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
      }),
    ]);

    // Calculate summary statistics
    const emotionSummary = calculateEmotionSummary(emotionAnalyses);
    const audioSummary = calculateAudioSummary(audioAnalyses);

    console.log('[GetAnalysis] Analysis retrieved successfully', {
      sessionId,
      emotionAnalysesCount: emotionAnalyses.length,
      audioAnalysesCount: audioAnalyses.length,
      hasScore: !!sessionScore,
    });

    return successResponse({
      sessionId,
      emotionAnalyses,
      emotionSummary,
      audioAnalyses,
      audioSummary,
      sessionScore,
      metadata: {
        analysisCompleted: metadata.analysisCompleted,
        analysisCompletedAt: metadata.analysisCompletedAt,
      },
    });
  } catch (error) {
    console.error('[GetAnalysis] Error:', error);
    return errorResponse(
      500,
      'Failed to get analysis',
      error instanceof Error ? error.message : undefined
    );
  }
};

/**
 * Calculate emotion analysis summary
 */
function calculateEmotionSummary(analyses: any[]) {
  if (analyses.length === 0) {
    return null;
  }

  const emotionCounts: { [emotion: string]: number } = {};
  let totalConfidence = 0;

  for (const analysis of analyses) {
    if (analysis.dominantEmotion) {
      emotionCounts[analysis.dominantEmotion] =
        (emotionCounts[analysis.dominantEmotion] || 0) + 1;
    }
    totalConfidence += analysis.confidence || 0;
  }

  return {
    totalFrames: analyses.length,
    averageConfidence: totalConfidence / analyses.length,
    dominantEmotionFrequency: emotionCounts,
    mostFrequentEmotion: Object.keys(emotionCounts).reduce((a, b) =>
      emotionCounts[a] > emotionCounts[b] ? a : b
    ),
  };
}

/**
 * Calculate audio analysis summary
 */
function calculateAudioSummary(analyses: any[]) {
  if (analyses.length === 0) {
    return null;
  }

  let totalSpeakingRate = 0;
  let totalVolume = 0;
  let totalPauses = 0;
  let totalFillerWords = 0;
  let count = 0;

  for (const analysis of analyses) {
    if (analysis.speakingRate) {
      totalSpeakingRate += analysis.speakingRate;
      count++;
    }
    if (analysis.volume !== null && analysis.volume !== undefined) {
      totalVolume += analysis.volume;
    }
    if (analysis.pauseCount) {
      totalPauses += analysis.pauseCount;
    }
    if (analysis.fillerCount) {
      totalFillerWords += analysis.fillerCount;
    }
  }

  return {
    totalSegments: analyses.length,
    averageSpeakingRate: count > 0 ? Math.round(totalSpeakingRate / count) : 0,
    averageVolume: analyses.length > 0 ? totalVolume / analyses.length : 0,
    totalPauses,
    totalFillerWords,
  };
}
