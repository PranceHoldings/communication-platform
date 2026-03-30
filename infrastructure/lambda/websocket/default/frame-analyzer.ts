/**
 * Frame Analyzer
 * Extracts frames from video and analyzes emotions using AWS Rekognition
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { RekognitionAnalyzer, EmotionAnalysisResult } from '../../shared/analysis/rekognition';

import { getFFmpegPath, getFFprobePath } from '../../shared/utils/ffmpeg-helper';
import { generateCdnUrl } from '../../shared/utils/url-generator';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface FrameExtractionOptions {
  interval: number; // Extract 1 frame every N seconds (default: 1)
  maxFrames?: number; // Maximum number of frames to extract (default: unlimited)
  format?: 'jpg' | 'png'; // Frame image format (default: jpg)
  quality?: number; // JPEG quality 1-100 (default: 85)
}

export interface AnalyzedFrame {
  timestamp: number; // Seconds from start
  frameIndex: number;
  frameUrl: string; // S3 URL
  analysis: EmotionAnalysisResult;
  processingTimeMs: number;
}

export interface VideoAnalysisResult {
  sessionId: string;
  frames: AnalyzedFrame[];
  totalFrames: number;
  successfulFrames: number;
  failedFrames: number;
  totalProcessingTimeMs: number;
  averageConfidence: number;
}

export class FrameAnalyzer {
  private s3Client: S3Client;
  private rekognitionAnalyzer: RekognitionAnalyzer;
  private bucket: string;

  constructor(config: { s3Client: S3Client; bucket: string; region?: string }) {
    this.s3Client = config.s3Client;
    this.bucket = config.bucket;
    this.rekognitionAnalyzer = new RekognitionAnalyzer({ region: config.region });

    console.log('[FrameAnalyzer] Initialized', {
      bucket: this.bucket,
      region: config.region || 'us-east-1',
    });
  }

  /**
   * Analyze video by extracting frames and analyzing emotions
   */
  async analyzeVideo(
    sessionId: string,
    videoKey: string,
    options: FrameExtractionOptions = { interval: 1 }
  ): Promise<VideoAnalysisResult> {
    const startTime = Date.now();

    console.log('[FrameAnalyzer] Starting video analysis', {
      sessionId,
      videoKey,
      options,
    });

    try {
      // Step 1: Download video from S3
      const tmpDir = path.join('/tmp', `analysis-${sessionId}-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      const videoPath = path.join(tmpDir, 'video.webm');

      console.log('[FrameAnalyzer] Downloading video from S3');
      const getResponse = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: videoKey,
        })
      );

      if (!getResponse.Body) {
        throw new Error('Failed to download video from S3');
      }

      const videoBuffer = await getResponse.Body.transformToByteArray();
      fs.writeFileSync(videoPath, Buffer.from(videoBuffer));

      console.log('[FrameAnalyzer] Video downloaded', {
        size: videoBuffer.length,
        path: videoPath,
      });

      // Step 2: Extract frames using ffmpeg
      const frames = await this.extractFrames(videoPath, tmpDir, options);

      console.log('[FrameAnalyzer] Frames extracted', {
        count: frames.length,
      });

      // Step 3: Analyze each frame with Rekognition
      const analyzedFrames: AnalyzedFrame[] = [];
      let successfulFrames = 0;
      let failedFrames = 0;
      let totalConfidence = 0;

      for (const frame of frames) {
        try {
          const frameStartTime = Date.now();

          // Read frame image
          const frameBuffer = fs.readFileSync(frame.path);

          // Analyze with Rekognition
          const analysis = await this.rekognitionAnalyzer.analyzeFrame(frameBuffer, {
            attributes: ['ALL'],
            minConfidence: 70,
          });

          const processingTime = Date.now() - frameStartTime;

          // Upload frame to S3
          const { getFrameKey } = await import('../../shared/config/s3-paths');
          const frameKey = getFrameKey(sessionId, frame.index);
          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: frameKey,
              Body: frameBuffer,
              ContentType: 'image/jpeg',
              Metadata: {
                sessionId,
                timestamp: frame.timestamp.toString(),
                frameIndex: frame.index.toString(),
              },
            })
          );

          const frameUrl = generateCdnUrl(frameKey);

          analyzedFrames.push({
            timestamp: frame.timestamp,
            frameIndex: frame.index,
            frameUrl,
            analysis,
            processingTimeMs: processingTime,
          });

          if (analysis.confidence > 0) {
            successfulFrames++;
            totalConfidence += analysis.confidence;
          }

          console.log('[FrameAnalyzer] Frame analyzed', {
            index: frame.index,
            timestamp: frame.timestamp,
            dominantEmotion: analysis.dominantEmotion,
            confidence: analysis.confidence,
            processingTimeMs: processingTime,
          });
        } catch (error) {
          failedFrames++;
          console.error('[FrameAnalyzer] Failed to analyze frame', {
            index: frame.index,
            timestamp: frame.timestamp,
            error,
          });
        }
      }

      // Step 4: Clean up /tmp
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log('[FrameAnalyzer] Cleaned up tmp directory');
      } catch (cleanupError) {
        console.warn('[FrameAnalyzer] Failed to clean up tmp:', cleanupError);
      }

      const totalProcessingTime = Date.now() - startTime;
      const averageConfidence = successfulFrames > 0 ? totalConfidence / successfulFrames : 0;

      const result: VideoAnalysisResult = {
        sessionId,
        frames: analyzedFrames,
        totalFrames: frames.length,
        successfulFrames,
        failedFrames,
        totalProcessingTimeMs: totalProcessingTime,
        averageConfidence,
      };

      console.log('[FrameAnalyzer] Video analysis completed', {
        sessionId,
        totalFrames: result.totalFrames,
        successfulFrames: result.successfulFrames,
        failedFrames: result.failedFrames,
        totalProcessingTimeMs: result.totalProcessingTimeMs,
        averageConfidence: result.averageConfidence,
      });

      return result;
    } catch (error) {
      console.error('[FrameAnalyzer] Video analysis error:', error);
      throw new Error(
        `Failed to analyze video: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract frames from video using ffmpeg
   */
  private async extractFrames(
    videoPath: string,
    outputDir: string,
    options: FrameExtractionOptions
  ): Promise<Array<{ index: number; timestamp: number; path: string }>> {
    const { interval = 1, maxFrames, format = 'jpg', quality = 85 } = options;

    // Get video duration first
    const duration = await this.getVideoDuration(videoPath);

    console.log('[FrameAnalyzer] Video duration', {
      duration,
      interval,
      maxFrames,
    });

    // Calculate number of frames to extract
    const totalPossibleFrames = Math.floor(duration / interval);
    const framesToExtract = maxFrames
      ? Math.min(maxFrames, totalPossibleFrames)
      : totalPossibleFrames;

    // Get ffmpeg path using centralized helper
    const ffmpegPath = getFFmpegPath();

    // Extract frames using ffmpeg
    // -vf "fps=1/N" extracts 1 frame every N seconds
    const framesDir = path.join(outputDir, 'frames');
    fs.mkdirSync(framesDir, { recursive: true });

    const framePattern = path.join(framesDir, `frame-%05d.${format}`);
    const ffmpegCommand = `${ffmpegPath} -i "${videoPath}" -vf "fps=1/${interval}" -q:v ${quality} "${framePattern}"`;

    console.log('[FrameAnalyzer] Extracting frames', {
      command: ffmpegCommand,
    });

    try {
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      if (stderr) {
        console.log('[FrameAnalyzer] ffmpeg stderr:', stderr);
      }
    } catch (error) {
      console.error('[FrameAnalyzer] ffmpeg error:', error);
      throw new Error(`ffmpeg failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // List extracted frames
    const extractedFiles = fs.readdirSync(framesDir).filter(file => file.startsWith('frame-'));
    extractedFiles.sort(); // Sort alphabetically

    console.log('[FrameAnalyzer] Frames extracted', {
      count: extractedFiles.length,
      expected: framesToExtract,
    });

    // Create frame metadata
    const frames = extractedFiles.map((file, index) => ({
      index,
      timestamp: index * interval,
      path: path.join(framesDir, file),
    }));

    // Limit to maxFrames if specified
    return maxFrames ? frames.slice(0, maxFrames) : frames;
  }

  /**
   * Get video duration in seconds using ffprobe
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    // Get ffprobe path using centralized helper
    const ffprobePath = getFFprobePath();

    const command = `${ffprobePath} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;

    try {
      const { stdout } = await execAsync(command);
      const duration = parseFloat(stdout.trim());

      if (isNaN(duration) || duration <= 0) {
        throw new Error('Invalid video duration');
      }

      return duration;
    } catch (error) {
      console.error('[FrameAnalyzer] Failed to get video duration:', error);
      // Fallback: assume 60 seconds
      console.warn('[FrameAnalyzer] Using fallback duration: 60 seconds');
      return 60;
    }
  }
}
