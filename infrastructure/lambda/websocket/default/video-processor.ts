/**
 * Video Processor
 * Handles video chunk storage, concatenation, and CloudFront URL generation
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { getFFmpegPath } from '../../shared/utils/ffmpeg-helper';
import { generateCdnUrl } from '../../shared/utils/url-generator';
import { getRequiredEnv } from '../../shared/utils/env-validator';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { sortChunksByTimestampAndIndex, logSortedChunks, generateChunkKey } from './chunk-utils';

// Environment variables (single source of truth: .env.local)
const VIDEO_FORMAT = getRequiredEnv('VIDEO_FORMAT');
const VIDEO_CONTENT_TYPE = getRequiredEnv('VIDEO_CONTENT_TYPE');

const execAsync = promisify(exec);

export interface VideoChunkMetadata {
  sessionId: string;
  timestamp: number;
  size: number;
  chunkIndex: number;
}

export interface VideoCombineResult {
  finalVideoKey: string;
  finalVideoSize: number;
  duration: number;
  cloudFrontUrl: string;
  // Phase 1.6.1 Day 33: Performance metrics
  metrics?: {
    listChunksTime: number;
    downloadTime: number;
    ffmpegTime: number;
    uploadTime: number;
    cleanupTime: number;
    totalTime: number;
    chunksCount: number;
    originalSize: number;
    finalSize: number;
  };
}

export class VideoProcessor {
  private s3Client: S3Client;
  private bucket: string;
  private cloudFrontDomain?: string;
  private cloudFrontKeyPairId?: string;
  private cloudFrontPrivateKey?: string;

  constructor(config: {
    s3Client: S3Client;
    bucket: string;
    cloudFrontDomain?: string;
    cloudFrontKeyPairId?: string;
    cloudFrontPrivateKey?: string;
  }) {
    this.s3Client = config.s3Client;
    this.bucket = config.bucket;
    this.cloudFrontDomain = config.cloudFrontDomain;
    this.cloudFrontKeyPairId = config.cloudFrontKeyPairId;
    this.cloudFrontPrivateKey = config.cloudFrontPrivateKey;
  }

  /**
   * Save video chunk to S3
   * Phase 1.6: Added sequenceNumber parameter for gap detection
   */
  async saveVideoChunk(
    sessionId: string,
    chunkData: Buffer,
    timestamp: number,
    chunkIndex: number,
    sequenceNumber?: number
  ): Promise<string> {
    const chunkKey = generateChunkKey(sessionId, 'video', timestamp, chunkIndex, VIDEO_FORMAT);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chunkKey,
        Body: chunkData,
        ContentType: VIDEO_CONTENT_TYPE,
        Metadata: {
          sessionId,
          timestamp: timestamp.toString(),
          chunkIndex: chunkIndex.toString(),
          ...(sequenceNumber !== undefined && { sequenceNumber: sequenceNumber.toString() }),
        },
      })
    );

    console.log('[VideoProcessor] Saved video chunk:', {
      sessionId,
      chunkKey,
      size: chunkData.length,
      timestamp,
      chunkIndex,
      sequenceNumber,
    });

    return chunkKey;
  }

  /**
   * Phase 1.6.1 Day 33: Download chunks in parallel
   * @param sortedChunks - Sorted S3 objects
   * @param tmpDir - Temporary directory path
   * @param maxConcurrency - Maximum concurrent downloads (default: 4)
   * @returns Array of downloaded chunk file paths and total size
   */
  private async downloadChunksInParallel(
    sortedChunks: Array<{ Key?: string; Size?: number }>,
    tmpDir: string,
    maxConcurrency: number = 4
  ): Promise<{ chunkFiles: string[]; totalSize: number }> {
    const chunkFiles: string[] = [];
    let totalSize = 0;

    // Process chunks in batches of maxConcurrency
    for (let i = 0; i < sortedChunks.length; i += maxConcurrency) {
      const batch = sortedChunks.slice(i, i + maxConcurrency);

      const batchResults = await Promise.all(
        batch.map(async (chunk, batchIndex) => {
          if (!chunk.Key) return null;

          const globalIndex = i + batchIndex;
          const chunkPath = path.join(tmpDir, `chunk-${globalIndex.toString().padStart(5, '0')}.webm`);

          const getResponse = await this.s3Client.send(
            new GetObjectCommand({
              Bucket: this.bucket,
              Key: chunk.Key,
            })
          );

          if (getResponse.Body) {
            const chunkBuffer = await getResponse.Body.transformToByteArray();
            fs.writeFileSync(chunkPath, Buffer.from(chunkBuffer));
            return {
              path: chunkPath,
              size: chunkBuffer.length,
            };
          }

          return null;
        })
      );

      // Collect results
      for (const result of batchResults) {
        if (result) {
          chunkFiles.push(result.path);
          totalSize += result.size;
        }
      }
    }

    return { chunkFiles, totalSize };
  }

  /**
   * Combine video chunks using ffmpeg
   * Phase 1.6.1 Day 33: Added performance metrics
   */
  async combineChunks(sessionId: string): Promise<VideoCombineResult> {
    const startTime = Date.now();
    const metrics = {
      listChunksTime: 0,
      downloadTime: 0,
      ffmpegTime: 0,
      uploadTime: 0,
      cleanupTime: 0,
      totalTime: 0,
    };

    try {
      // Phase 1.6.1 Day 33: Measure list chunks time
      const listStart = Date.now();

      // List all video chunks for this session
      const { getVideoChunksPrefix } = await import('../../shared/config/s3-paths');
      const chunksPrefix = getVideoChunksPrefix(sessionId);
      console.log('[VideoProcessor] Listing video chunks:', chunksPrefix);

      const listResponse = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: chunksPrefix,
        })
      );

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        throw new Error('No video chunks found for session');
      }

      metrics.listChunksTime = Date.now() - listStart;
      console.log('[VideoProcessor] Found chunks:', {
        count: listResponse.Contents.length,
        listTime: `${metrics.listChunksTime}ms`,
      });

      // Filter and sort chunks using shared utility function
      const filteredChunks = listResponse.Contents.filter(
        obj => obj.Key && obj.Key.endsWith('.webm')
      );
      const sortedChunks = sortChunksByTimestampAndIndex(filteredChunks);

      // Log sorted chunks with validation
      logSortedChunks(sortedChunks, 'VideoProcessor:combineChunks', 5);

      // Phase 1.6.1 Day 33: Download chunks in parallel
      const downloadStart = Date.now();
      const tmpDir = path.join('/tmp', `video-${sessionId}-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      const { chunkFiles, totalSize } = await this.downloadChunksInParallel(
        sortedChunks,
        tmpDir,
        4 // 4 concurrent downloads
      );

      metrics.downloadTime = Date.now() - downloadStart;
      console.log('[VideoProcessor] Downloaded chunks in parallel:', {
        count: chunkFiles.length,
        totalSize,
        downloadTime: `${metrics.downloadTime}ms`,
        avgSpeed: `${(totalSize / (metrics.downloadTime / 1000) / 1024 / 1024).toFixed(2)} MB/s`,
        tmpDir,
      });

      // Phase 1.6.1 Day 33: Measure ffmpeg time
      const ffmpegStart = Date.now();

      // Create concat list file for ffmpeg
      const concatListPath = path.join(tmpDir, 'concat-list.txt');
      const concatListContent = chunkFiles.map(file => `file '${file}'`).join('\n');
      fs.writeFileSync(concatListPath, concatListContent);

      // Combine chunks using ffmpeg
      const outputPath = path.join(tmpDir, 'output.webm');

      // Get ffmpeg path using centralized helper
      const ffmpegPath = getFFmpegPath();
      const ffmpegCommand = `${ffmpegPath} -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}"`;

      console.log('[VideoProcessor] Running ffmpeg:', ffmpegCommand);

      try {
        const { stdout, stderr } = await execAsync(ffmpegCommand);
        console.log('[VideoProcessor] ffmpeg stdout:', stdout);
        if (stderr) {
          console.log('[VideoProcessor] ffmpeg stderr:', stderr);
        }
      } catch (error) {
        console.error('[VideoProcessor] ffmpeg error:', error);
        throw new Error(
          `ffmpeg failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Verify output file exists
      if (!fs.existsSync(outputPath)) {
        throw new Error('ffmpeg did not produce output file');
      }

      const finalVideoBuffer = fs.readFileSync(outputPath);
      const finalVideoSize = finalVideoBuffer.length;

      metrics.ffmpegTime = Date.now() - ffmpegStart;
      console.log('[VideoProcessor] Combined video:', {
        size: finalVideoSize,
        chunks: chunkFiles.length,
        ffmpegTime: `${metrics.ffmpegTime}ms`,
        compressionRatio: `${((finalVideoSize / totalSize) * 100).toFixed(2)}%`,
      });

      // Phase 1.6.1 Day 33: Measure upload time
      const uploadStart = Date.now();

      // Upload final video to S3
      const { getRecordingKey } = await import('../../shared/config/s3-paths');
      const finalVideoKey = getRecordingKey(sessionId);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: finalVideoKey,
          Body: finalVideoBuffer,
          ContentType: VIDEO_CONTENT_TYPE,
          Metadata: {
            sessionId,
            chunksCount: chunkFiles.length.toString(),
            originalSize: totalSize.toString(),
            finalSize: finalVideoSize.toString(),
            // Phase 1.6.1 Day 33: Add performance metrics to metadata
            listChunksTimeMs: metrics.listChunksTime.toString(),
            downloadTimeMs: metrics.downloadTime.toString(),
            ffmpegTimeMs: metrics.ffmpegTime.toString(),
            uploadTimeMs: '0', // Will be updated below
            totalTimeMs: '0',  // Will be updated below
          },
        })
      );

      metrics.uploadTime = Date.now() - uploadStart;
      console.log('[VideoProcessor] Uploaded final video:', {
        key: finalVideoKey,
        size: finalVideoSize,
        uploadTime: `${metrics.uploadTime}ms`,
        uploadSpeed: `${(finalVideoSize / (metrics.uploadTime / 1000) / 1024 / 1024).toFixed(2)} MB/s`,
      });

      // Phase 1.6.1 Day 33: Measure cleanup time
      const cleanupStart = Date.now();

      // Clean up /tmp
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        metrics.cleanupTime = Date.now() - cleanupStart;
        console.log('[VideoProcessor] Cleaned up tmp directory:', {
          cleanupTime: `${metrics.cleanupTime}ms`,
        });
      } catch (cleanupError) {
        console.warn('[VideoProcessor] Failed to clean up tmp:', cleanupError);
      }

      // Generate CloudFront signed URL
      const cloudFrontUrl = this.generateSignedUrl(finalVideoKey);

      metrics.totalTime = Date.now() - startTime;

      // Phase 1.6.1 Day 33: Log comprehensive performance metrics
      console.log('[VideoProcessor] Performance metrics:', {
        sessionId,
        chunks: chunkFiles.length,
        originalSize: totalSize,
        finalSize: finalVideoSize,
        metrics: {
          listChunks: `${metrics.listChunksTime}ms`,
          download: `${metrics.downloadTime}ms (${(totalSize / (metrics.downloadTime / 1000) / 1024 / 1024).toFixed(2)} MB/s)`,
          ffmpeg: `${metrics.ffmpegTime}ms`,
          upload: `${metrics.uploadTime}ms (${(finalVideoSize / (metrics.uploadTime / 1000) / 1024 / 1024).toFixed(2)} MB/s)`,
          cleanup: `${metrics.cleanupTime}ms`,
          total: `${metrics.totalTime}ms`,
        },
        breakdown: {
          listChunksPercent: `${((metrics.listChunksTime / metrics.totalTime) * 100).toFixed(1)}%`,
          downloadPercent: `${((metrics.downloadTime / metrics.totalTime) * 100).toFixed(1)}%`,
          ffmpegPercent: `${((metrics.ffmpegTime / metrics.totalTime) * 100).toFixed(1)}%`,
          uploadPercent: `${((metrics.uploadTime / metrics.totalTime) * 100).toFixed(1)}%`,
          cleanupPercent: `${((metrics.cleanupTime / metrics.totalTime) * 100).toFixed(1)}%`,
        },
      });

      return {
        finalVideoKey,
        finalVideoSize,
        duration: metrics.totalTime,
        cloudFrontUrl,
        metrics: {
          listChunksTime: metrics.listChunksTime,
          downloadTime: metrics.downloadTime,
          ffmpegTime: metrics.ffmpegTime,
          uploadTime: metrics.uploadTime,
          cleanupTime: metrics.cleanupTime,
          totalTime: metrics.totalTime,
          chunksCount: chunkFiles.length,
          originalSize: totalSize,
          finalSize: finalVideoSize,
        },
      };
    } catch (error) {
      console.error('[VideoProcessor] combineChunks error:', error);
      throw error;
    }
  }

  /**
   * Generate CloudFront signed URL for video
   */
  generateSignedUrl(videoKey: string, expiresIn: number = 3600): string {
    // If CloudFront is not configured, return S3 URL
    if (!this.cloudFrontDomain || !this.cloudFrontKeyPairId || !this.cloudFrontPrivateKey) {
      console.warn('[VideoProcessor] CloudFront not configured, returning S3 URL');
      return generateCdnUrl(videoKey);
    }

    const url = `https://${this.cloudFrontDomain}/${videoKey}`;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    try {
      const signedUrl = getSignedUrl({
        url,
        keyPairId: this.cloudFrontKeyPairId,
        privateKey: this.cloudFrontPrivateKey,
        dateLessThan: expiresAt.toISOString(),
      });

      console.log('[VideoProcessor] Generated CloudFront signed URL:', {
        videoKey,
        expiresAt: expiresAt.toISOString(),
      });

      return signedUrl;
    } catch (error) {
      console.error('[VideoProcessor] Failed to generate CloudFront signed URL:', error);
      // Fallback to S3 URL
      return generateCdnUrl(videoKey);
    }
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(
    sessionId: string
  ): Promise<{ exists: boolean; size?: number; url?: string }> {
    try {
      const { getRecordingKey: getRecKey } = await import('../../shared/config/s3-paths');
      const videoKey = getRecKey(sessionId);

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: videoKey,
        })
      );

      return {
        exists: true,
        size: response.ContentLength,
        url: this.generateSignedUrl(videoKey),
      };
    } catch (error) {
      if ((error as any).name === 'NoSuchKey') {
        return { exists: false };
      }
      throw error;
    }
  }
}
