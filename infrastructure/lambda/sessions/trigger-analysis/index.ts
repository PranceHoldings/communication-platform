import { APIGatewayProxyHandler } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';
import { AWS_DEFAULTS } from '../../shared/config/defaults';
import { getAnalysisLambdaFunctionName } from '../../shared/utils/env-validator';

// Environment variables
const AWS_REGION = process.env.AWS_REGION || AWS_DEFAULTS.REGION;
const ANALYSIS_LAMBDA_FUNCTION_NAME = getAnalysisLambdaFunctionName();

// Initialize Lambda client
const lambdaClient = new LambdaClient({ region: AWS_REGION });

/**
 * POST /api/v1/sessions/{id}/analyze
 *
 * Manually trigger analysis for a session
 */
export const handler: APIGatewayProxyHandler = async event => {
  console.log('[TriggerAnalysis] Request:', JSON.stringify(event, null, 2));

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

    console.log('[TriggerAnalysis] Triggering analysis for session:', sessionId);

    // Get session to verify access and status
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

    // Check if session is in valid state for analysis
    if (session.status === 'ACTIVE') {
      return errorResponse(
        400,
        'Cannot analyze active session',
        'Please end the session before triggering analysis'
      );
    }

    // Check if analysis is already in progress
    const metadata = session.metadataJson as any;
    if (metadata?.analysisInProgress) {
      return errorResponse(
        409,
        'Analysis already in progress',
        'Please wait for the current analysis to complete'
      );
    }

    // Check if recordings exist
    const recordingsCount = await prisma.recording.count({
      where: {
        sessionId,
        processingStatus: 'COMPLETED',
        type: 'COMBINED',
      },
    });

    if (recordingsCount === 0) {
      return errorResponse(
        400,
        'No recordings available',
        'Session must have a completed recording to perform analysis'
      );
    }

    // Update session metadata to indicate analysis is in progress
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'PROCESSING',
        metadataJson: {
          ...metadata,
          analysisInProgress: true,
          analysisTriggeredAt: new Date().toISOString(),
          analysisTriggeredBy: user.userId,
        },
      },
    });

    console.log('[TriggerAnalysis] Invoking analysis Lambda');

    // Invoke analysis Lambda function asynchronously
    const invokeResponse = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: ANALYSIS_LAMBDA_FUNCTION_NAME,
        InvocationType: 'Event', // Asynchronous invocation
        Payload: JSON.stringify({ sessionId }),
      })
    );

    console.log('[TriggerAnalysis] Analysis triggered successfully', {
      sessionId,
      statusCode: invokeResponse.StatusCode,
    });

    return successResponse(
      {
        message: 'Analysis triggered successfully',
        sessionId,
        status: 'PROCESSING',
      },
      202 // Accepted
    );
  } catch (error) {
    console.error('[TriggerAnalysis] Error:', error);

    // Try to update session status to indicate error
    try {
      const sessionId = event.pathParameters?.id;
      if (sessionId) {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { metadataJson: true },
        });

        await prisma.session.update({
          where: { id: sessionId },
          data: {
            status: 'ERROR',
            metadataJson: {
              ...(session?.metadataJson as any),
              analysisInProgress: false,
              analysisError: error instanceof Error ? error.message : 'Unknown error',
              analysisErrorAt: new Date().toISOString(),
            },
          },
        });
      }
    } catch (updateError) {
      console.error('[TriggerAnalysis] Failed to update session status:', updateError);
    }

    return errorResponse(
      500,
      'Failed to trigger analysis',
      error instanceof Error ? error.message : undefined
    );
  }
};
