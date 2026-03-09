/**
 * Analysis Orchestrator
 * Orchestrates the full analysis pipeline: emotion, audio, and score calculation
 */

import { S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { FrameAnalyzer } from './frame-analyzer';
import { AudioAnalyzer } from '../../shared/analysis/audio-analyzer';
import { ScoreCalculator } from '../../shared/analysis/score-calculator';
import type {
  EmotionAnalysis,
  AudioAnalysis,
  SessionScore,
  ScoringCriteria,
} from '@prance/shared';

export interface AnalysisOrchestratorConfig {
  s3Client: S3Client;
  bucket: string;
  region: string;
}

export interface AnalysisResult {
  sessionId: string;
  emotionAnalysesCount: number;
  audioAnalysesCount: number;
  sessionScore: SessionScore;
  processingTimeMs: number;
}

export class AnalysisOrchestrator {
  private frameAnalyzer: FrameAnalyzer;
  private audioAnalyzer: AudioAnalyzer;
  private scoreCalculator: ScoreCalculator;
  private prisma: PrismaClient;
  private bucket: string;

  constructor(config: AnalysisOrchestratorConfig) {
    this.frameAnalyzer = new FrameAnalyzer({
      s3Client: config.s3Client,
      bucket: config.bucket,
      region: config.region,
    });
    this.audioAnalyzer = new AudioAnalyzer();
    this.scoreCalculator = new ScoreCalculator();
    this.prisma = new PrismaClient();
    this.bucket = config.bucket;

    console.log('[AnalysisOrchestrator] Initialized', {
      bucket: config.bucket,
      region: config.region,
    });
  }

  /**
   * Orchestrate full analysis pipeline for a session
   */
  async analyzeSession(
    sessionId: string,
    criteria?: ScoringCriteria
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    console.log('[AnalysisOrchestrator] Starting full analysis', {
      sessionId,
      criteria,
    });

    try {
      // Step 1: Get session data
      const session = await this.getSessionData(sessionId);
      console.log('[AnalysisOrchestrator] Session data retrieved', {
        recordingsCount: session.recordings.length,
        transcriptsCount: session.transcripts.length,
      });

      // Step 2: Find combined recording
      const combinedRecording = session.recordings.find(
        (r) => r.type === 'COMBINED' && r.processingStatus === 'COMPLETED'
      );

      if (!combinedRecording) {
        throw new Error('No completed combined recording found');
      }

      console.log('[AnalysisOrchestrator] Combined recording found', {
        recordingId: combinedRecording.id,
        s3Key: combinedRecording.s3Key,
      });

      // Step 3: Emotion analysis (video frames)
      console.log('[AnalysisOrchestrator] Step 3: Emotion analysis');
      const emotionAnalyses = await this.performEmotionAnalysis(
        sessionId,
        combinedRecording.id,
        combinedRecording.s3Key
      );
      console.log('[AnalysisOrchestrator] Emotion analyses saved', {
        count: emotionAnalyses.length,
      });

      // Step 4: Audio analysis (transcripts)
      console.log('[AnalysisOrchestrator] Step 4: Audio analysis');
      const audioAnalyses = await this.performAudioAnalysis(
        sessionId,
        session.transcripts,
        combinedRecording.s3Key
      );
      console.log('[AnalysisOrchestrator] Audio analyses saved', {
        count: audioAnalyses.length,
      });

      // Step 5: Score calculation
      console.log('[AnalysisOrchestrator] Step 5: Score calculation');
      const sessionScore = await this.performScoreCalculation(
        sessionId,
        emotionAnalyses,
        audioAnalyses,
        criteria
      );
      console.log('[AnalysisOrchestrator] Session score saved', {
        overallScore: sessionScore.overallScore,
      });

      // Step 6: Update session status
      await this.updateSessionStatus(sessionId, 'COMPLETED', {
        analysisCompleted: true,
        analysisCompletedAt: new Date().toISOString(),
      });

      const processingTime = Date.now() - startTime;
      console.log('[AnalysisOrchestrator] Analysis completed successfully', {
        sessionId,
        processingTimeMs: processingTime,
      });

      return {
        sessionId,
        emotionAnalysesCount: emotionAnalyses.length,
        audioAnalysesCount: audioAnalyses.length,
        sessionScore,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      console.error('[AnalysisOrchestrator] Analysis failed:', error);

      // Update session with error status
      await this.updateSessionStatus(sessionId, 'ERROR', {
        analysisError:
          error instanceof Error ? error.message : 'Unknown error',
        analysisErrorAt: new Date().toISOString(),
      });

      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Get session data with recordings and transcripts
   */
  private async getSessionData(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        recordings: true,
        transcripts: {
          where: { speaker: 'USER' }, // Only analyze user transcripts
          orderBy: { timestampStart: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session;
  }

  /**
   * Perform emotion analysis on video frames
   */
  private async performEmotionAnalysis(
    sessionId: string,
    recordingId: string,
    videoKey: string
  ): Promise<EmotionAnalysis[]> {
    try {
      // Extract frames and analyze emotions
      const videoAnalysisResult = await this.frameAnalyzer.analyzeVideo(
        sessionId,
        videoKey,
        {
          interval: 1, // Extract 1 frame per second
          maxFrames: 60, // Max 60 frames (1 minute)
        }
      );

      // Convert to EmotionAnalysis format and save to DB
      const emotionAnalyses: EmotionAnalysis[] = [];

      for (const frame of videoAnalysisResult.frames) {
        const analysis = await this.prisma.emotionAnalysis.create({
          data: {
            sessionId,
            recordingId,
            timestamp: frame.timestamp,
            frameUrl: frame.frameUrl,
            emotions: frame.analysis.emotions as any,
            dominantEmotion: frame.analysis.dominantEmotion,
            ageRange: frame.analysis.ageRange as any,
            gender: frame.analysis.gender,
            genderConfidence: frame.analysis.genderConfidence,
            eyesOpen: frame.analysis.eyesOpen,
            eyesOpenConfidence: frame.analysis.eyesOpenConfidence,
            mouthOpen: frame.analysis.mouthOpen,
            mouthOpenConfidence: frame.analysis.mouthOpenConfidence,
            pose: frame.analysis.pose as any,
            confidence: frame.analysis.confidence,
            brightness: frame.analysis.quality?.brightness,
            sharpness: frame.analysis.quality?.sharpness,
            processingTimeMs: frame.processingTimeMs,
          },
        });

        emotionAnalyses.push(analysis as EmotionAnalysis);
      }

      return emotionAnalyses;
    } catch (error) {
      console.error('[AnalysisOrchestrator] Emotion analysis failed:', error);
      // Return empty array if emotion analysis fails (non-critical)
      return [];
    }
  }

  /**
   * Perform audio analysis on transcripts
   */
  private async performAudioAnalysis(
    sessionId: string,
    transcripts: any[],
    audioKey: string
  ): Promise<AudioAnalysis[]> {
    try {
      // Analyze each transcript segment
      const audioAnalyses: AudioAnalysis[] = [];

      // Combine all USER transcripts into one text
      const fullTranscript = transcripts
        .map((t) => t.text)
        .join(' ');

      console.log('[AnalysisOrchestrator] Analyzing audio', {
        transcriptsCount: transcripts.length,
        fullTranscriptLength: fullTranscript.length,
      });

      // Analyze audio file from S3
      const audioAnalysisResult = await this.audioAnalyzer.analyzeAudioFromS3(
        (await import('@aws-sdk/client-s3')).S3Client,
        this.bucket,
        audioKey,
        fullTranscript,
        {
          minPauseDuration: 0.5,
          silenceThreshold: -30,
          detectFillerWords: true,
        }
      );

      console.log('[AnalysisOrchestrator] Audio analysis result', {
        volume: audioAnalysisResult.volume,
        speakingRate: audioAnalysisResult.speakingRate,
        pauseCount: audioAnalysisResult.pauseCount,
        fillerWordsCount: audioAnalysisResult.fillerWords?.count || 0,
      });

      // Create one audio analysis record for the full session
      const analysis = await this.prisma.audioAnalysis.create({
        data: {
          sessionId,
          timestamp: 0, // Session start
          pitch: undefined, // Not available from ffmpeg
          pitchVariance: undefined,
          volume: audioAnalysisResult.volume,
          volumeVariance: audioAnalysisResult.volumeVariance,
          speakingRate: audioAnalysisResult.speakingRate,
          pauseCount: audioAnalysisResult.pauseCount,
          pauseDuration: audioAnalysisResult.pauseDuration,
          clarity: undefined, // Will be calculated from transcripts
          confidence: transcripts[0]?.confidence,
          snr: undefined,
          fillerWords: audioAnalysisResult.fillerWords?.words || [],
          fillerCount: audioAnalysisResult.fillerWords?.count || 0,
          audioUrl: `s3://${this.bucket}/${audioKey}`,
          duration: audioAnalysisResult.duration,
          processingTimeMs: audioAnalysisResult.processingTimeMs,
        },
      });

      audioAnalyses.push(analysis as AudioAnalysis);

      // Optionally: Create per-transcript audio analyses
      for (const transcript of transcripts) {
        const transcriptAnalysis = await this.prisma.audioAnalysis.create({
          data: {
            sessionId,
            transcriptId: transcript.id,
            timestamp: transcript.timestampStart,
            speakingRate: this.calculateSegmentSpeakingRate(
              transcript.text,
              transcript.timestampEnd - transcript.timestampStart
            ),
            confidence: transcript.confidence,
            duration: transcript.timestampEnd - transcript.timestampStart,
          },
        });

        audioAnalyses.push(transcriptAnalysis as AudioAnalysis);
      }

      return audioAnalyses;
    } catch (error) {
      console.error('[AnalysisOrchestrator] Audio analysis failed:', error);
      // Return empty array if audio analysis fails (non-critical)
      return [];
    }
  }

  /**
   * Calculate speaking rate for a transcript segment
   */
  private calculateSegmentSpeakingRate(text: string, duration: number): number {
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    const durationMinutes = duration / 60;

    if (durationMinutes === 0) {
      return 0;
    }

    return Math.round(wordCount / durationMinutes);
  }

  /**
   * Perform score calculation
   */
  private async performScoreCalculation(
    sessionId: string,
    emotionAnalyses: EmotionAnalysis[],
    audioAnalyses: AudioAnalysis[],
    criteria?: ScoringCriteria
  ): Promise<SessionScore> {
    // Calculate score
    const scoreResult = this.scoreCalculator.calculateScore(
      emotionAnalyses,
      audioAnalyses,
      criteria || { preset: 'default' }
    );

    console.log('[AnalysisOrchestrator] Score calculated', {
      overallScore: scoreResult.overallScore,
      emotionScore: scoreResult.emotionScore,
      audioScore: scoreResult.audioScore,
    });

    // Save to database
    const sessionScore = await this.prisma.sessionScore.create({
      data: {
        sessionId,
        overallScore: scoreResult.overallScore,
        emotionScore: scoreResult.emotionScore,
        audioScore: scoreResult.audioScore,
        contentScore: scoreResult.contentScore,
        deliveryScore: scoreResult.deliveryScore,
        emotionStability: scoreResult.emotionDetails.stability,
        emotionPositivity: scoreResult.emotionDetails.positivity,
        confidence: scoreResult.emotionDetails.confidence,
        engagement: scoreResult.emotionDetails.engagement,
        clarity: scoreResult.audioDetails.clarity,
        fluency: scoreResult.audioDetails.fluency,
        pacing: scoreResult.audioDetails.pacing,
        volume: scoreResult.audioDetails.volume,
        relevance: scoreResult.contentDetails.relevance,
        structure: scoreResult.contentDetails.structure,
        completeness: scoreResult.contentDetails.completeness,
        strengths: scoreResult.strengths,
        improvements: scoreResult.improvements,
        criteria: criteria as any,
        weights: criteria?.customWeights as any,
        version: '1.0',
      },
    });

    return sessionScore as SessionScore;
  }

  /**
   * Update session status
   */
  private async updateSessionStatus(
    sessionId: string,
    status: 'COMPLETED' | 'ERROR',
    metadata: Record<string, any>
  ): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status,
        metadataJson: {
          ...(session.metadataJson as object),
          ...metadata,
        },
      },
    });

    console.log('[AnalysisOrchestrator] Session status updated', {
      sessionId,
      status,
    });
  }
}
