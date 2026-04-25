/**
 * Report Generation Lambda Function
 *
 * POST /api/v1/sessions/{sessionId}/report
 *
 * Generate PDF report for a completed session
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { generateAndUploadReport } from '../report/generator';
import { ReportData } from '../report/types';
import { verifyToken } from '../shared/auth/jwt';
import { generateAISuggestions } from '../report/ai-suggestions';
import { getAllowOriginHeader, setRequestOrigin } from '../shared/utils/response';

const prisma = new PrismaClient();

/**
 * Fetch session data from database
 */
async function fetchSessionData(sessionId: string): Promise<ReportData> {
  console.log('[ReportGenerate] Fetching session data:', sessionId);

  // Fetch session with related data
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      scenario: {
        select: {
          id: true,
          title: true,
          category: true,
        },
      },
      avatar: {
        select: {
          name: true,
          type: true,
        },
      },
      transcripts: {
        orderBy: {
          timestampStart: 'asc',
        },
        select: {
          id: true,
          speaker: true,
          text: true,
          timestampStart: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.status !== 'COMPLETED') {
    throw new Error(`Session is not completed: ${session.status}`);
  }

  // Fetch session score
  const score = await prisma.sessionScore.findUnique({
    where: { sessionId },
  });

  if (!score) {
    throw new Error(`Session score not found for session: ${sessionId}`);
  }

  // Fetch emotion analysis
  const emotionAnalysis = await prisma.emotionAnalysis.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'asc' },
    select: {
      timestamp: true,
      dominantEmotion: true,
      confidence: true,
    },
  });

  // Fetch audio analysis
  const audioAnalysis = await prisma.audioAnalysis.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'asc' },
    select: {
      timestamp: true,
      pitch: true,
      volume: true,
      speakingRate: true,
      fillerCount: true,
      clarity: true,
    },
  });

  // Prepare report data
  const reportData: ReportData = {
    session: {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      duration: session.durationSec || 0,
      user: {
        name: session.user.name,
        email: session.user.email,
      },
      scenario: {
        id: session.scenario.id,
        title: session.scenario.title,
        description: session.scenario.category,
      },
      avatar: session.avatar
        ? {
            name: session.avatar.name,
            type: session.avatar.type,
          }
        : null,
    },
    score: {
      overall: score.overallScore,
      emotion: score.emotionScore,
      audio: score.audioScore,
      content: score.contentScore,
      delivery: score.deliveryScore,
      // Detailed scores
      emotionStability: score.emotionStability,
      emotionPositivity: score.emotionPositivity,
      confidence: score.confidence,
      engagement: score.engagement,
      clarity: score.clarity,
      fluency: score.fluency,
      pacing: score.pacing,
      volume: score.volume,
      relevance: score.relevance,
      structure: score.structure,
      completeness: score.completeness,
      // Insights
      strengths: score.strengths as string[],
      improvements: score.improvements as string[],
    },
    emotionAnalysis: emotionAnalysis.map(e => ({
      timestamp: e.timestamp,
      dominantEmotion: e.dominantEmotion,
      confidence: e.confidence,
    })),
    audioAnalysis: audioAnalysis.map(a => ({
      timestamp: a.timestamp,
      pitch: a.pitch,
      volume: a.volume,
      speakingRate: a.speakingRate,
      fillerCount: a.fillerCount,
      clarity: a.clarity,
    })),
    transcript: session.transcripts.map(t => ({
      timestamp: t.timestampStart,
      speaker: t.speaker as 'USER' | 'ASSISTANT',
      text: t.text,
    })),
    aiSuggestions: [], // Will be populated by AI suggestion generator (Task 2.3.3)
    chartUrls: {
      radarChart: '',
      timelineChart: '',
    },
  };

  console.log('[ReportGenerate] Session data fetched successfully');
  return reportData;
}

/**
 * Save report metadata to database
 */
async function saveReportMetadata(
  sessionId: string,
  pdfUrl: string,
  pdfKey: string
): Promise<void> {
  console.log('[ReportGenerate] Saving report metadata to database');

  // Note: We'll need to add a Report table to Prisma schema in the future
  // For now, we can store the URL in session metadata or create a simple table

  // TODO: Add Report model to Prisma schema
  // await prisma.report.create({
  //   data: {
  //     sessionId,
  //     pdfUrl,
  //     pdfKey,
  //     generatedAt: new Date(),
  //     version: '1.0',
  //   },
  // });

  // Temporary: Update session metadata with report URL
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      metadataJson: {
        reportUrl: pdfUrl,
        reportKey: pdfKey,
        reportGeneratedAt: new Date().toISOString(),
      },
    },
  });

  console.log('[ReportGenerate] Report metadata saved');
}

/**
 * Lambda handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('[ReportGenerate] Request received:', {
    path: event.path,
    method: event.httpMethod,
    pathParameters: event.pathParameters,
  });
  setRequestOrigin(event?.headers?.Origin || event?.headers?.origin);

  try {
    // Verify authentication
    const token = event.headers.Authorization?.replace('Bearer ', '');
    if (!token) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    // Get session ID from path parameters
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Session ID is required' }),
      };
    }

    // Verify user has access to this session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, orgId: true },
    });

    if (!session) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Session not found' }),
      };
    }

    // Check authorization
    const isOwner = session.userId === payload.userId;
    const isSameOrg = session.orgId === payload.orgId;
    const isAdmin = payload.role === 'SUPER_ADMIN' || payload.role === 'CLIENT_ADMIN';

    if (!isOwner && !isSameOrg && !isAdmin) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
        },
        body: JSON.stringify({ error: 'Forbidden' }),
      };
    }

    // Fetch session data
    const reportData = await fetchSessionData(sessionId);

    // Generate AI suggestions using AWS Bedrock
    console.log('[ReportGenerate] Generating AI improvement suggestions...');
    try {
      reportData.aiSuggestions = await generateAISuggestions(reportData);
      console.log('[ReportGenerate] AI suggestions generated successfully');
    } catch (error) {
      console.error('[ReportGenerate] Failed to generate AI suggestions:', error);
      // Fallback to score-based suggestions
      reportData.aiSuggestions = reportData.score.improvements;
      console.log('[ReportGenerate] Using fallback suggestions from score table');
    }

    // Generate PDF and upload to S3
    console.log('[ReportGenerate] Generating PDF report...');
    const { pdfUrl, pdfKey } = await generateAndUploadReport(reportData);

    // Save report metadata
    await saveReportMetadata(sessionId, pdfUrl, pdfKey);

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
      },
      body: JSON.stringify({
        success: true,
        report: {
          sessionId,
          pdfUrl,
          pdfKey,
          generatedAt: new Date().toISOString(),
        },
      }),
    };
  } catch (error) {
    console.error('[ReportGenerate] Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getAllowOriginHeader(event?.headers?.Origin || event?.headers?.origin),
      },
      body: JSON.stringify({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}
