/**
 * Get Guest Session Data Lambda Function
 *
 * GET /api/guest/session-data
 *
 * Retrieves session data (recording, transcript, analysis) for an authenticated guest.
 * Guests can only access their own session data via guest JWT token.
 *
 * @module guest/session-data
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { getUserFromEvent } from '../../shared/auth/jwt';

const prisma = new PrismaClient();

interface GuestSessionData {
  session: {
    id: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    durationSec: number | null;
  } | null;
  recording: {
    id: string;
    type: string;
    s3Key: string;
    url: string | null;
    durationSec: number | null;
    status: string;
    createdAt: string;
  } | null;
  transcript: {
    id: string;
    fullText: string;
    wordCount: number;
    language: string;
    confidence: number;
    speakers: Array<{
      speaker: string;
      text: string;
      startTimeSec: number;
      endTimeSec: number;
    }>;
    createdAt: string;
  } | null;
  analysis: {
    id: string;
    overallScore: number;
    sentiment: string;
    metrics: any;
    insights: any;
    createdAt: string;
  } | null;
}

/**
 * Lambda handler for getting guest session data
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('[GetGuestSessionData] Event:', JSON.stringify(event, null, 2));

  try {
    // 1. Extract user data from Lambda Authorizer context
    const userData = getUserFromEvent(event);
    console.log('[GetGuestSessionData] Authenticated user:', {
      userId: userData.userId,
      role: userData.role,
      guestSessionId: userData.guestSessionId,
    });

    // 2. Role check: Only GUEST can access this endpoint
    if (userData.role !== 'GUEST') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Forbidden: Only guests can access this endpoint',
        }),
      };
    }

    if (!userData.guestSessionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid guest token: missing guestSessionId' }),
      };
    }

    console.log('[GetGuestSessionData] Fetching session data:', userData.guestSessionId);

    // 3. Fetch guest session with related session
    const guestSession = await prisma.guestSession.findUnique({
      where: { id: userData.guestSessionId },
      select: {
        id: true,
        sessionId: true,
        status: true,
      },
    });

    if (!guestSession) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Guest session not found' }),
      };
    }

    // 4. Check if guest session has a linked session
    if (!guestSession.sessionId) {
      // No session created yet
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          session: null,
          recording: null,
          transcript: null,
          analysis: null,
        }),
      };
    }

    // 5. Fetch session data
    const session = await prisma.session.findUnique({
      where: { id: guestSession.sessionId },
      include: {
        recordings: {
          where: {
            type: 'MERGED', // Only show merged recording to guest
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        transcript: true,
        analysis: true,
      },
    });

    if (!session) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Session not found' }),
      };
    }

    console.log('[GetGuestSessionData] Session found:', {
      sessionId: session.id,
      status: session.status,
      hasRecording: session.recordings.length > 0,
      hasTranscript: !!session.transcript,
      hasAnalysis: !!session.analysis,
    });

    // 6. Format response
    const recording = session.recordings[0];
    const response: GuestSessionData = {
      session: {
        id: session.id,
        status: session.status,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() || null,
        durationSec: session.durationSec,
      },
      recording: recording
        ? {
            id: recording.id,
            type: recording.type,
            s3Key: recording.s3Key,
            url: recording.url,
            durationSec: recording.durationSec,
            status: recording.status,
            createdAt: recording.createdAt.toISOString(),
          }
        : null,
      transcript: session.transcript
        ? {
            id: session.transcript.id,
            fullText: session.transcript.fullText,
            wordCount: session.transcript.wordCount,
            language: session.transcript.language,
            confidence: session.transcript.confidence,
            speakers: (session.transcript.speakers as any[]).map((s) => ({
              speaker: s.speaker,
              text: s.text,
              startTimeSec: s.startTimeSec,
              endTimeSec: s.endTimeSec,
            })),
            createdAt: session.transcript.createdAt.toISOString(),
          }
        : null,
      analysis: session.analysis
        ? {
            id: session.analysis.id,
            overallScore: session.analysis.overallScore,
            sentiment: session.analysis.sentiment,
            metrics: session.analysis.metrics,
            insights: session.analysis.insights,
            createdAt: session.analysis.createdAt.toISOString(),
          }
        : null,
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
    console.error('[GetGuestSessionData] Error:', error);

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
