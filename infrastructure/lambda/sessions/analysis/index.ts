/**
 * Session Analysis Lambda Function
 * Orchestrates full session analysis: emotion, audio, and score calculation
 */

import { S3Client } from '@aws-sdk/client-s3';
import { AnalysisOrchestrator } from '../../shared/analysis/analysis-orchestrator';
import { AWS_DEFAULTS } from '../../shared/config/defaults';
import { getS3Bucket } from '../../shared/utils/env-validator';

// Environment variables
const S3_BUCKET = getS3Bucket();
const AWS_REGION = process.env.AWS_REGION || AWS_DEFAULTS.REGION;

// Initialize S3 client
const s3Client = new S3Client({ region: AWS_REGION });

/**
 * Lambda handler
 */
export const handler = async (event: any) => {
  console.log('[SessionAnalysis] Received event:', JSON.stringify(event));

  const sessionId = event.sessionId;

  if (!sessionId) {
    console.error('[SessionAnalysis] No sessionId provided');
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing sessionId',
      }),
    };
  }

  console.log('[SessionAnalysis] Starting analysis', { sessionId });

  try {
    // Initialize orchestrator
    const orchestrator = new AnalysisOrchestrator({
      s3Client,
      bucket: S3_BUCKET,
      region: AWS_REGION,
    });

    // Perform full analysis
    const result = await orchestrator.analyzeSession(sessionId);

    console.log('[SessionAnalysis] Analysis completed successfully', {
      sessionId,
      emotionAnalysesCount: result.emotionAnalysesCount,
      audioAnalysesCount: result.audioAnalysesCount,
      overallScore: result.sessionScore.overallScore,
      processingTimeMs: result.processingTimeMs,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Analysis completed successfully',
        sessionId,
        result: {
          emotionAnalysesCount: result.emotionAnalysesCount,
          audioAnalysesCount: result.audioAnalysesCount,
          overallScore: result.sessionScore.overallScore,
          processingTimeMs: result.processingTimeMs,
        },
      }),
    };
  } catch (error) {
    console.error('[SessionAnalysis] Analysis failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      }),
    };
  }
};
