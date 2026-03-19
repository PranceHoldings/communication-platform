/**
 * Lambda Function: Seed Test Recording Data
 *
 * Creates test recording, transcript, and analysis data for E2E testing.
 * Invoked manually via AWS CLI or Console.
 */

import { Handler } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { generateCdnUrl } from '../../shared/utils/url-generator';
import { getCloudFrontDomain } from '../../shared/utils/env-validator';

const prisma = new PrismaClient();

const CLOUDFRONT_DOMAIN = getCloudFrontDomain();

interface SeedEvent {
  sessionId?: string; // Optional: specific session to seed
}

interface SeedResponse {
  success: boolean;
  sessionId: string;
  message: string;
  data?: {
    recordingsCreated: number;
    transcriptsCreated: number;
    scoreCreated: boolean;
    emotionAnalysesCreated: number;
    audioAnalysesCreated: number;
  };
  error?: string;
}

export const handler: Handler<SeedEvent, SeedResponse> = async event => {
  console.log('Seed test recording data', JSON.stringify(event));

  try {
    // 1. Find or use specific session
    const targetSessionId = event.sessionId;

    let session;
    if (targetSessionId) {
      console.log(`Looking for session: ${targetSessionId}`);
      session = await prisma.session.findUnique({
        where: { id: targetSessionId },
        include: {
          recordings: true,
          transcripts: true,
          sessionScore: true,
        },
      });

      if (!session) {
        return {
          success: false,
          sessionId: targetSessionId,
          message: `Session not found: ${targetSessionId}`,
          error: 'SESSION_NOT_FOUND',
        };
      }
    } else {
      console.log('Finding a COMPLETED session without recordings...');
      session = await prisma.session.findFirst({
        where: {
          status: 'COMPLETED',
          recordings: {
            none: {},
          },
        },
        include: {
          recordings: true,
          transcripts: true,
          sessionScore: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!session) {
        return {
          success: false,
          sessionId: '',
          message: 'No COMPLETED session without recordings found',
          error: 'NO_SESSION_FOUND',
        };
      }
    }

    console.log(`Using session: ${session.id}`);
    console.log(`Status: ${session.status}`);
    console.log(`Existing recordings: ${session.recordings.length}`);
    console.log(`Existing transcripts: ${session.transcripts.length}`);

    const stats = {
      recordingsCreated: 0,
      transcriptsCreated: 0,
      scoreCreated: false,
      emotionAnalysesCreated: 0,
      audioAnalysesCreated: 0,
    };

    // 2. Create recording if not exists
    if (session.recordings.length === 0) {
      console.log('Creating recording...');

      const mockS3Key = `recordings/${session.id}/combined-${Date.now()}.webm`;
      const mockS3Url = generateCdnUrl(mockS3Key);
      const mockCdnUrl = generateCdnUrl(mockS3Key);

      await prisma.recording.create({
        data: {
          sessionId: session.id,
          type: 'COMBINED',
          s3Key: mockS3Key,
          s3Url: mockS3Url,
          cdnUrl: mockCdnUrl,
          fileSizeBytes: BigInt(5242880), // 5MB
          durationSec: 120, // 2 minutes
          durationMs: 120000,
          format: 'webm',
          resolution: '1280x720',
          videoChunksCount: 24,
          processingStatus: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      stats.recordingsCreated = 1;
      console.log('Recording created');
    }

    // 3. Create transcripts if not exists
    if (session.transcripts.length === 0) {
      console.log('Creating transcripts...');

      const transcriptData = [
        {
          speaker: 'AI',
          text: 'こんにちは。今日は面接にお越しいただき、ありがとうございます。まず自己紹介をお願いします。',
          timestampStart: 0.5,
          timestampEnd: 6.2,
          confidence: 0.95,
        },
        {
          speaker: 'USER',
          text: 'はい、よろしくお願いします。私は5年間ソフトウェアエンジニアとして働いており、特にWebアプリケーション開発が得意です。',
          timestampStart: 7.0,
          timestampEnd: 15.5,
          confidence: 0.92,
        },
        {
          speaker: 'AI',
          text: 'ありがとうございます。それでは、あなたの強みについて教えてください。',
          timestampStart: 16.0,
          timestampEnd: 20.8,
          confidence: 0.96,
        },
        {
          speaker: 'USER',
          text: '私の強みは、新しい技術を素早く学習し、チームと協力して問題を解決できることです。',
          timestampStart: 21.5,
          timestampEnd: 29.2,
          confidence: 0.89,
        },
        {
          speaker: 'AI',
          text: '素晴らしいですね。では、過去のプロジェクトで最も困難だったことは何ですか？',
          timestampStart: 30.0,
          timestampEnd: 36.5,
          confidence: 0.94,
        },
        {
          speaker: 'USER',
          text: 'レガシーシステムの大規模なリファクタリングプロジェクトです。多くの依存関係があり、段階的なアプローチが必要でした。',
          timestampStart: 37.2,
          timestampEnd: 47.8,
          confidence: 0.91,
        },
        {
          speaker: 'AI',
          text: 'どのようにその課題を克服しましたか？',
          timestampStart: 48.5,
          timestampEnd: 52.0,
          confidence: 0.97,
        },
        {
          speaker: 'USER',
          text: 'チームで詳細な計画を立て、自動テストを整備し、小さな変更を積み重ねていきました。結果として、安全にシステムを刷新できました。',
          timestampStart: 52.8,
          timestampEnd: 65.5,
          confidence: 0.93,
        },
      ];

      for (const data of transcriptData) {
        await prisma.transcript.create({
          data: {
            sessionId: session.id,
            speaker: data.speaker as 'AI' | 'USER',
            text: data.text,
            timestampStart: data.timestampStart,
            timestampEnd: data.timestampEnd,
            confidence: data.confidence,
          },
        });
      }

      stats.transcriptsCreated = transcriptData.length;
      console.log(`${transcriptData.length} transcripts created`);
    }

    // 4. Create session score if not exists
    if (!session.sessionScore) {
      console.log('Creating session score...');

      await prisma.sessionScore.create({
        data: {
          sessionId: session.id,
          overallScore: 78.5,
          emotionScore: 82.0,
          audioScore: 75.5,
          contentScore: 80.0,
          deliveryScore: 77.0,
          emotionStability: 85.0,
          emotionPositivity: 79.0,
          confidence: 76.0,
          engagement: 83.0,
          clarity: 72.0,
          fluency: 78.0,
          pacing: 75.0,
          volume: 76.5,
          relevance: 82.0,
          structure: 79.5,
          completeness: 78.5,
          strengths: ['良好な感情コントロール', '適切な話速', '明確な論理構造'],
          improvements: ['フィラー語を減らす', '音量を少し上げる', 'より具体的な例を挙げる'],
          criteria: {
            emotion: 'AWS Rekognition による感情解析',
            audio: 'Azure Speech Services による音声解析',
            content: 'Claude Sonnet による内容解析',
          },
          weights: {
            emotion: 0.25,
            audio: 0.25,
            content: 0.3,
            delivery: 0.2,
          },
          version: '1.0',
        },
      });

      stats.scoreCreated = true;
      console.log('Session score created');
    }

    // 5. Get recording for emotion analyses
    const recording = await prisma.recording.findFirst({
      where: { sessionId: session.id },
    });

    // 6. Create emotion analyses
    if (recording) {
      console.log('Creating emotion analyses...');

      const emotionData = [
        {
          timestamp: 5.0,
          dominantEmotion: 'CALM',
          emotions: [
            { Type: 'CALM', Confidence: 85.5 },
            { Type: 'HAPPY', Confidence: 12.3 },
          ],
          confidence: 85.5,
        },
        {
          timestamp: 15.0,
          dominantEmotion: 'HAPPY',
          emotions: [
            { Type: 'HAPPY', Confidence: 78.2 },
            { Type: 'CALM', Confidence: 19.5 },
          ],
          confidence: 78.2,
        },
        {
          timestamp: 30.0,
          dominantEmotion: 'CONFUSED',
          emotions: [
            { Type: 'CONFUSED', Confidence: 42.1 },
            { Type: 'CALM', Confidence: 38.9 },
          ],
          confidence: 42.1,
        },
        {
          timestamp: 50.0,
          dominantEmotion: 'CALM',
          emotions: [
            { Type: 'CALM', Confidence: 88.7 },
            { Type: 'HAPPY', Confidence: 9.2 },
          ],
          confidence: 88.7,
        },
      ];

      for (const data of emotionData) {
        await prisma.emotionAnalysis.create({
          data: {
            sessionId: session.id,
            recordingId: recording.id,
            timestamp: data.timestamp,
            emotions: data.emotions,
            dominantEmotion: data.dominantEmotion,
            confidence: data.confidence,
            eyesOpen: true,
            eyesOpenConfidence: 95.0,
            mouthOpen: false,
            mouthOpenConfidence: 90.0,
            pose: { Pitch: 0.5, Roll: -1.2, Yaw: 2.1 },
            brightness: 75.5,
            sharpness: 82.3,
          },
        });
      }

      stats.emotionAnalysesCreated = emotionData.length;
      console.log(`${emotionData.length} emotion analyses created`);
    }

    // 7. Create audio analyses
    console.log('Creating audio analyses...');

    const audioData = [
      {
        timestamp: 10.0,
        pitch: 185.5,
        volume: -18.2,
        speakingRate: 145.0,
        pauseCount: 2,
        clarity: 0.85,
        fillerCount: 1,
      },
      {
        timestamp: 25.0,
        pitch: 192.3,
        volume: -16.8,
        speakingRate: 152.0,
        pauseCount: 3,
        clarity: 0.82,
        fillerCount: 2,
      },
      {
        timestamp: 40.0,
        pitch: 178.1,
        volume: -19.5,
        speakingRate: 138.0,
        pauseCount: 4,
        clarity: 0.79,
        fillerCount: 3,
      },
      {
        timestamp: 60.0,
        pitch: 188.7,
        volume: -17.3,
        speakingRate: 148.0,
        pauseCount: 2,
        clarity: 0.87,
        fillerCount: 1,
      },
    ];

    for (const data of audioData) {
      await prisma.audioAnalysis.create({
        data: {
          sessionId: session.id,
          timestamp: data.timestamp,
          pitch: data.pitch,
          pitchVariance: 15.2,
          volume: data.volume,
          volumeVariance: 3.5,
          speakingRate: data.speakingRate,
          pauseCount: data.pauseCount,
          pauseDuration: 0.8,
          clarity: data.clarity,
          confidence: 0.92,
          snr: 25.5,
          fillerWords: ['ええと', 'あの'],
          fillerCount: data.fillerCount,
          duration: 5.0,
        },
      });
    }

    stats.audioAnalysesCreated = audioData.length;
    console.log(`${audioData.length} audio analyses created`);

    return {
      success: true,
      sessionId: session.id,
      message: 'Test data seeding completed successfully',
      data: stats,
    };
  } catch (error) {
    console.error('Error seeding test data:', error);
    return {
      success: false,
      sessionId: '',
      message: 'Failed to seed test data',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await prisma.$disconnect();
  }
};
