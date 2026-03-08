/**
 * Video Processor
 * Handles video chunk storage, concatenation, and CloudFront URL generation
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { sortChunksByTimestampAndIndex, logSortedChunks, generateChunkKey } from './chunk-utils';

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
   */
  async saveVideoChunk(
    sessionId: string,
    chunkData: Buffer,
    timestamp: number,
    chunkIndex: number
  ): Promise<string> {
    const chunkKey = generateChunkKey(sessionId, 'video', timestamp, chunkIndex, 'webm');

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chunkKey,
        Body: chunkData,
        ContentType: 'video/webm',
        Metadata: {
          sessionId,
          timestamp: timestamp.toString(),
          chunkIndex: chunkIndex.toString(),
        },
      })
    );

    console.log('[VideoProcessor] Saved video chunk:', {
      sessionId,
      chunkKey,
      size: chunkData.length,
      timestamp,
      chunkIndex,
    });

    return chunkKey;
  }

  /**
   * Combine video chunks using ffmpeg
   */
  async combineChunks(sessionId: string): Promise<VideoCombineResult> {
    const startTime = Date.now();

    try {
      // List all video chunks for this session
      const chunksPrefix = `sessions/${sessionId}/video-chunks/`;
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

      console.log('[VideoProcessor] Found chunks:', listResponse.Contents.length);

      // Filter and sort chunks using shared utility function
      const filteredChunks = listResponse.Contents.filter(obj => obj.Key && obj.Key.endsWith('.webm'));
      const sortedChunks = sortChunksByTimestampAndIndex(filteredChunks);

      // Log sorted chunks with validation
      logSortedChunks(sortedChunks, 'VideoProcessor:combineChunks', 5);

      // Download chunks to /tmp
      const tmpDir = path.join('/tmp', `video-${sessionId}-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      const chunkFiles: string[] = [];
      let totalSize = 0;

      for (let i = 0; i < sortedChunks.length; i++) {
        const chunk = sortedChunks[i];
        if (!chunk.Key) continue;

        const chunkPath = path.join(tmpDir, `chunk-${i.toString().padStart(5, '0')}.webm`);

        const getResponse = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucket,
            Key: chunk.Key,
          })
        );

        if (getResponse.Body) {
          const chunkBuffer = await getResponse.Body.transformToByteArray();
          fs.writeFileSync(chunkPath, Buffer.from(chunkBuffer));
          chunkFiles.push(chunkPath);
          totalSize += chunkBuffer.length;
        }
      }

      console.log('[VideoProcessor] Downloaded chunks:', {
        count: chunkFiles.length,
        totalSize,
        tmpDir,
      });

      // Create concat list file for ffmpeg
      const concatListPath = path.join(tmpDir, 'concat-list.txt');
      const concatListContent = chunkFiles
        .map(file => `file '${file}'`)
        .join('\n');
      fs.writeFileSync(concatListPath, concatListContent);

      // Combine chunks using ffmpeg
      const outputPath = path.join(tmpDir, 'output.webm');

      // Get ffmpeg path with multiple fallback options
      let ffmpegPath = process.env.FFMPEG_PATH;
      if (!ffmpegPath) {
        // Try Lambda Layer path first
        if (fs.existsSync('/opt/bin/ffmpeg')) {
          ffmpegPath = '/opt/bin/ffmpeg';
        } else {
          // Fallback to npm package (ffmpeg-static)
          try {
            ffmpegPath = require('ffmpeg-static');
          } catch (error) {
            throw new Error('ffmpeg not found. Check Lambda Layer or ffmpeg-static package.');
          }
        }
      }
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
        throw new Error(`ffmpeg failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Verify output file exists
      if (!fs.existsSync(outputPath)) {
        throw new Error('ffmpeg did not produce output file');
      }

      const finalVideoBuffer = fs.readFileSync(outputPath);
      const finalVideoSize = finalVideoBuffer.length;

      console.log('[VideoProcessor] Combined video:', {
        size: finalVideoSize,
        chunks: chunkFiles.length,
      });

      // Upload final video to S3
      const finalVideoKey = `sessions/${sessionId}/recording.webm`;
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: finalVideoKey,
          Body: finalVideoBuffer,
          ContentType: 'video/webm',
          Metadata: {
            sessionId,
            chunksCount: chunkFiles.length.toString(),
            originalSize: totalSize.toString(),
            finalSize: finalVideoSize.toString(),
          },
        })
      );

      console.log('[VideoProcessor] Uploaded final video:', finalVideoKey);

      // Clean up /tmp
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log('[VideoProcessor] Cleaned up tmp directory');
      } catch (cleanupError) {
        console.warn('[VideoProcessor] Failed to clean up tmp:', cleanupError);
      }

      // Generate CloudFront signed URL
      const cloudFrontUrl = this.generateSignedUrl(finalVideoKey);

      const duration = Date.now() - startTime;

      return {
        finalVideoKey,
        finalVideoSize,
        duration,
        cloudFrontUrl,
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
      return `https://${this.bucket}.s3.amazonaws.com/${videoKey}`;
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
      return `https://${this.bucket}.s3.amazonaws.com/${videoKey}`;
    }
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(sessionId: string): Promise<{ exists: boolean; size?: number; url?: string }> {
    try {
      const videoKey = `sessions/${sessionId}/recording.webm`;

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
