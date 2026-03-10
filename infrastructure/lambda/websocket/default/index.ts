/**
 * WebSocket $default Handler
 * Handles all WebSocket messages with STT/AI/TTS integration
 * Last updated: 2026-03-09
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AudioProcessor } from './audio-processor';
import { VideoProcessor } from './video-processor';
import { sortChunksByTimestampAndIndex, logSortedChunks, generateChunkKey } from './chunk-utils';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Lambda function version
const LAMBDA_VERSION = '1.1.0';
const LAMBDA_NAME = 'websocket-default-handler';

// Default values (centralized configuration)
// Note: These defaults are defined here instead of importing from shared/config
// to avoid Docker bundling path resolution issues
// These values should match those in shared/config/defaults.ts
const DEFAULT_AWS_REGION = 'us-east-1';
const DEFAULT_BEDROCK_REGION = 'us-east-1';
const DEFAULT_BEDROCK_MODEL_ID = 'us.anthropic.claude-sonnet-4-6';
const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5';
const DEFAULT_STT_LANGUAGE = 'ja-JP'; // Deprecated: 自動言語検出を使用すること
const DEFAULT_STT_AUTO_DETECT_LANGUAGES = ['ja-JP', 'en-US']; // Phase 1デフォルト
const DEFAULT_VIDEO_FORMAT = 'webm';
const DEFAULT_VIDEO_RESOLUTION = '1280x720';
const DEFAULT_AUDIO_CONTENT_TYPE = 'audio/webm';
const DEFAULT_VIDEO_CONTENT_TYPE = 'video/webm';

// Language configuration object (for compatibility with AudioProcessor and scenarios)
const LANGUAGE_DEFAULTS = {
  STT_LANGUAGE: DEFAULT_STT_LANGUAGE,
  STT_AUTO_DETECT_LANGUAGES_DEFAULT: DEFAULT_STT_AUTO_DETECT_LANGUAGES,
  SUPPORTED_LANGUAGES: DEFAULT_STT_AUTO_DETECT_LANGUAGES, // ja-JP, en-US
  SCENARIO_LANGUAGE: 'ja', // Default scenario language
};

// Environment variables (読み取り優先順位: 環境変数 → デフォルト値)
const ENDPOINT = process.env.WEBSOCKET_ENDPOINT || '';
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE_NAME || '';
const RECORDINGS_TABLE = process.env.RECORDINGS_TABLE_NAME || '';
const S3_BUCKET = process.env.S3_BUCKET || '';
const AWS_REGION = process.env.AWS_REGION || DEFAULT_AWS_REGION;

// AI/Audio services configuration
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || '';
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL_ID;
const BEDROCK_REGION = process.env.BEDROCK_REGION || DEFAULT_BEDROCK_REGION;
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID;

// CloudFront configuration
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';
const CLOUDFRONT_KEY_PAIR_ID = process.env.CLOUDFRONT_KEY_PAIR_ID || '';
const CLOUDFRONT_PRIVATE_KEY = process.env.CLOUDFRONT_PRIVATE_KEY || '';

// Language and Media configuration
const STT_LANGUAGE = process.env.STT_LANGUAGE || DEFAULT_STT_LANGUAGE;
const VIDEO_FORMAT = process.env.VIDEO_FORMAT || DEFAULT_VIDEO_FORMAT;
const VIDEO_RESOLUTION = process.env.VIDEO_RESOLUTION || DEFAULT_VIDEO_RESOLUTION;
const AUDIO_CONTENT_TYPE = process.env.AUDIO_CONTENT_TYPE || DEFAULT_AUDIO_CONTENT_TYPE;
const VIDEO_CONTENT_TYPE = process.env.VIDEO_CONTENT_TYPE || DEFAULT_VIDEO_CONTENT_TYPE;

const apiGateway = new ApiGatewayManagementApiClient({
  endpoint: ENDPOINT,
});

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const s3Client = new S3Client({});

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || DEFAULT_AWS_REGION,
});

// Audio Processor (lazy initialization to avoid errors when API keys are not set)
let audioProcessor: AudioProcessor | null = null;

function getAudioProcessor(): AudioProcessor {
  if (!audioProcessor) {
    // Check if required environment variables are set
    if (!AZURE_SPEECH_KEY || !ELEVENLABS_API_KEY) {
      throw new Error(
        'Audio processing API keys not configured. Set AZURE_SPEECH_KEY and ELEVENLABS_API_KEY environment variables.'
      );
    }

    // STT自動言語検出候補を取得
    // 優先順位:
    //   1. 環境変数 STT_AUTO_DETECT_LANGUAGES（カンマ区切り）
    //   2. LANGUAGE_DEFAULTS.STT_AUTO_DETECT_LANGUAGES_DEFAULT（フォールバック）
    //
    // Phase 2以降の拡張:
    //   - データベースから組織設定を取得
    //   - 言語リソースファイルから動的生成
    const autoDetectLanguages = process.env.STT_AUTO_DETECT_LANGUAGES
      ? process.env.STT_AUTO_DETECT_LANGUAGES.split(',').map(lang => lang.trim())
      : LANGUAGE_DEFAULTS.STT_AUTO_DETECT_LANGUAGES_DEFAULT;

    console.log('[AudioProcessor] Initializing with auto-detect languages:', autoDetectLanguages);

    audioProcessor = new AudioProcessor({
      azureSpeechKey: AZURE_SPEECH_KEY,
      azureSpeechRegion: AZURE_SPEECH_REGION,
      elevenLabsApiKey: ELEVENLABS_API_KEY,
      elevenLabsVoiceId: ELEVENLABS_VOICE_ID,
      elevenLabsModelId: ELEVENLABS_MODEL_ID,
      bedrockRegion: BEDROCK_REGION,
      bedrockModelId: BEDROCK_MODEL_ID,
      s3Bucket: S3_BUCKET,
      autoDetectLanguages: autoDetectLanguages as string[], // 自動言語検出を有効化
      // language: STT_LANGUAGE, // Deprecated: 固定言語は使用しない
    });
  }
  return audioProcessor;
}

// Video Processor (lazy initialization)
let videoProcessor: VideoProcessor | null = null;

function getVideoProcessor(): VideoProcessor {
  if (!videoProcessor) {
    videoProcessor = new VideoProcessor({
      s3Client,
      bucket: S3_BUCKET,
      cloudFrontDomain: CLOUDFRONT_DOMAIN,
      cloudFrontKeyPairId: CLOUDFRONT_KEY_PAIR_ID,
      cloudFrontPrivateKey: CLOUDFRONT_PRIVATE_KEY,
    });
  }
  return videoProcessor;
}

/**
 * Delete lock with exponential backoff retry
 * @param lockKey - DynamoDB lock key to delete
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns true if deletion succeeded, false otherwise
 */
async function deleteLockWithRetry(lockKey: string, maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connection_id: lockKey },
        })
      );
      console.log(`Successfully deleted lock ${lockKey} (attempt ${attempt}/${maxRetries})`);
      return true;
    } catch (error) {
      console.error(`Failed to delete lock ${lockKey} (attempt ${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
        console.log(`Retrying lock deletion after ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error(
    `CRITICAL: Failed to delete lock ${lockKey} after ${maxRetries} attempts. TTL will clean up in 5 minutes.`
  );
  return false;
}

interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

interface WebSocketEvent {
  requestContext: {
    connectionId: string;
    [key: string]: unknown;
  };
  body?: string;
  isBase64Encoded?: boolean;
  [key: string]: unknown;
}

interface ConnectionData {
  connectionId: string;
  sessionId?: string;
  scenarioPrompt?: string;
  scenarioLanguage?: string; // Scenario language ('ja', 'en', etc.) for STT/TTS
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  audioS3Key?: string; // S3 key for accumulated audio chunks
  audioChunksCount?: number;
  lastChunkTime?: number;
  videoChunksCount?: number; // Count of video chunks received
  lastVideoChunkTime?: number;
  audioProcessingInProgress?: boolean; // Flag set by audio_data_part when lock is acquired
  currentAudioChunkId?: string | null; // ChunkId currently being processed
  sessionEndReceived?: boolean; // Flag to indicate session_end was received while audio_data_part was processing
  // Real-time audio streaming (Phase 1.5)
  realtimeAudioSequenceNumber?: number; // Latest sequence number received
  realtimeAudioChunkCount?: number; // Total count of real-time chunks
  // Note: videoChunkParts removed - parts are stored directly in S3 to avoid DynamoDB 400KB limit
  [key: string]: unknown;
}

export const handler = async (event: WebSocketEvent): Promise<APIGatewayProxyResultV2> => {
  console.log('[Lambda Version]', LAMBDA_VERSION, '- Audio Processing: volume=10.0 + compressor');
  console.log('WebSocket Default Handler Event:', JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  const body = event.body;

  try {
    if (!body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing message body' }),
      };
    }

    const message: WebSocketMessage = JSON.parse(body);
    console.log('Received message:', message);

    // Get connection data from DynamoDB
    const connectionData = await getConnectionData(connectionId);

    // Route message based on type
    switch (message.type) {
      case 'ping':
        await sendToConnection(connectionId, {
          type: 'pong',
          timestamp: Date.now(),
        });
        break;

      case 'authenticate':
        // Store session information in connection data
        const sessionId = message.sessionId as string;

        // Fetch scenario language from database
        let scenarioLanguage = 'ja'; // Default
        try {
          const { PrismaClient } = await import('@prisma/client');
          const prisma = new PrismaClient();

          const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { scenario: true },
          });

          if (session?.scenario?.language) {
            scenarioLanguage = session.scenario.language;
            console.log('[authenticate] Scenario language:', scenarioLanguage);
          }

          await prisma.$disconnect();
        } catch (error) {
          console.error('[authenticate] Failed to fetch scenario language:', error);
          // Continue with default language
        }

        await updateConnectionData(connectionId, {
          sessionId,
          conversationHistory: [],
          scenarioLanguage, // Store language for audio processing
        });

        await sendToConnection(connectionId, {
          type: 'authenticated',
          message: 'Session initialized',
          sessionId,
        });
        break;

      case 'version':
      case 'health':
        // Return version and health information
        await sendToConnection(connectionId, {
          type: 'version',
          version: LAMBDA_VERSION,
          name: LAMBDA_NAME,
          timestamp: Date.now(),
          runtime: 'nodejs22.x',
          audioProcessing: {
            volume: '10.0',
            compressor: 'enabled',
            sttAutoDetect: true,
            languages: DEFAULT_STT_AUTO_DETECT_LANGUAGES,
          },
        });
        console.log('[Version] Sent version info:', LAMBDA_VERSION);
        break;

      case 'audio_chunk':
        // Handle streaming audio chunks (browser recording)
        // Audio data is sent as Base64 string
        const audioData = message.data as string;
        const timestamp = message.timestamp as number;
        const audioSessionId = connectionData?.sessionId || 'unknown';

        console.log('Received audio chunk:', {
          timestamp,
          dataSize: audioData ? audioData.length : 0,
          connectionId,
          sessionId: audioSessionId,
        });

        // Save audio chunk to S3 (to avoid DynamoDB 400KB limit)
        const chunkCount = (connectionData?.audioChunksCount || 0) + 1;
        const chunkKey = generateChunkKey(
          audioSessionId,
          'audio',
          timestamp,
          chunkCount,
          VIDEO_FORMAT
        );

        try {
          await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: chunkKey,
              Body: Buffer.from(audioData, 'base64'),
              ContentType: AUDIO_CONTENT_TYPE,
            })
          );

          console.log('Saved audio chunk to S3:', chunkKey);
        } catch (error) {
          console.error('Failed to save audio chunk to S3:', error);
        }

        await updateConnectionData(connectionId, {
          lastChunkTime: timestamp,
          audioChunksCount: chunkCount,
        });

        // Acknowledge receipt periodically (every 20th chunk to reduce traffic)
        if (chunkCount % 20 === 0) {
          await sendToConnection(connectionId, {
            type: 'processing_update',
            stage: 'receiving_audio',
            progress: 0.1,
            chunksReceived: chunkCount,
          });
        }
        break;

      case 'audio_chunk_realtime':
        // Handle real-time audio chunks (Phase 1.5 - streaming STT)
        const rtAudioData = message.data as string;
        const rtTimestamp = message.timestamp as number;
        const rtSequenceNumber = message.sequenceNumber as number;
        const rtContentType = message.contentType as string;
        const rtSessionId = connectionData?.sessionId || 'unknown';

        console.log('[audio_chunk_realtime] Received real-time audio chunk:', {
          sequenceNumber: rtSequenceNumber,
          timestamp: rtTimestamp,
          dataSize: rtAudioData ? rtAudioData.length : 0,
          contentType: rtContentType,
          sessionId: rtSessionId,
        });

        try {
          // Save this chunk to S3 for later processing (on speech_end)
          const rtChunkKey = `sessions/${rtSessionId}/realtime-chunks/chunk-${rtSequenceNumber.toString().padStart(6, '0')}.webm`;
          const rtAudioBuffer = Buffer.from(rtAudioData, 'base64');

          await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: rtChunkKey,
              Body: rtAudioBuffer,
              ContentType: rtContentType || AUDIO_CONTENT_TYPE,
              Metadata: {
                sequenceNumber: rtSequenceNumber.toString(),
                timestamp: rtTimestamp.toString(),
                sessionId: rtSessionId,
              },
            })
          );

          console.log('[audio_chunk_realtime] Saved chunk to S3:', {
            key: rtChunkKey,
            sequenceNumber: rtSequenceNumber,
            size: rtAudioBuffer.length,
          });

          // Update connection data with latest sequence number
          await updateConnectionData(connectionId, {
            realtimeAudioSequenceNumber: rtSequenceNumber,
            realtimeAudioChunkCount: (connectionData?.realtimeAudioChunkCount || 0) + 1,
          });
        } catch (error) {
          console.error('[audio_chunk_realtime] Failed to save chunk to S3:', error);
          await sendToConnection(connectionId, {
            type: 'error',
            code: 'REALTIME_AUDIO_CHUNK_ERROR',
            message: 'Failed to save real-time audio chunk',
            sequenceNumber: rtSequenceNumber,
          });
        }
        break;

      case 'speech_end':
        // User stopped speaking - process accumulated real-time chunks (Phase 1.5)
        const speechEndSessionId = connectionData?.sessionId || 'unknown';
        const lastSequenceNumber = connectionData?.realtimeAudioSequenceNumber || -1;
        const totalRealtimeChunks = connectionData?.realtimeAudioChunkCount || 0;

        console.log('[speech_end] Speech ended - processing accumulated chunks:', {
          sessionId: speechEndSessionId,
          lastSequenceNumber,
          totalChunks: totalRealtimeChunks,
        });

        // NOTE: Do NOT rely on lastSequenceNumber or totalRealtimeChunks
        // MediaRecorder restart resets sequence numbers, so we MUST check S3 directly
        // Early return removed - always attempt to list and process chunks from S3

        try {
          // Send processing status
          await sendToConnection(connectionId, {
            type: 'processing_update',
            stage: 'transcribing',
            progress: 0.33,
          });

          // List all chunks that actually exist in S3 (more robust than assuming 0-N sequence)
          const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
          const chunkPrefix = `sessions/${speechEndSessionId}/realtime-chunks/`;

          console.log(`[speech_end] Listing chunks from S3: ${chunkPrefix}`);
          const listResponse = await s3Client.send(
            new ListObjectsV2Command({
              Bucket: S3_BUCKET,
              Prefix: chunkPrefix,
            })
          );

          const chunkKeys = (listResponse.Contents || [])
            .map(obj => obj.Key)
            .filter((key): key is string => !!key)
            .sort(); // Sort to maintain order

          console.log(`[speech_end] Found ${chunkKeys.length} chunks in S3`);

          if (chunkKeys.length === 0) {
            console.warn('[speech_end] No chunks found in S3');
            await sendToConnection(connectionId, {
              type: 'error',
              code: 'NO_AUDIO_DATA',
              message: 'No audio data received',
            });
            break;
          }

          // Download all existing chunks
          const rtChunkBuffers: Buffer[] = [];
          for (const chunkKey of chunkKeys) {
            try {
              const getResponse = await s3Client.send(
                new GetObjectCommand({
                  Bucket: S3_BUCKET,
                  Key: chunkKey,
                })
              );

              if (getResponse.Body) {
                const chunkBuffer = await getResponse.Body.transformToByteArray();
                rtChunkBuffers.push(Buffer.from(chunkBuffer));
                console.log(`[speech_end] Downloaded ${chunkKey}: ${chunkBuffer.length} bytes`);
              }
            } catch (error) {
              console.warn(`[speech_end] Failed to download ${chunkKey}:`, error);
              // Continue with other chunks
            }
          }

          if (rtChunkBuffers.length === 0) {
            console.warn('[speech_end] No chunks downloaded, cannot process');
            await sendToConnection(connectionId, {
              type: 'error',
              code: 'NO_AUDIO_DATA',
              message: 'No audio data received',
            });
            break;
          }

          // Convert multiple WebM chunks to WAV (cannot simply concatenate WebM chunks)
          console.log('[speech_end] Converting WebM chunks to WAV...');
          const audioProc = getAudioProcessor();
          const wavBuffer = await audioProc.convertMultipleWebMChunksToWav(rtChunkBuffers);

          console.log('[speech_end] Conversion complete:', {
            totalChunks: rtChunkBuffers.length,
            wavSize: wavBuffer.length,
          });

          // Process through STT -> AI (streaming) -> TTS pipeline (Phase 1.5)
          await handleAudioProcessingStreaming(connectionId, wavBuffer, connectionData);

          // Clean up real-time chunks from S3 (delete only the chunks we actually downloaded)
          console.log(`[speech_end] Cleaning up ${chunkKeys.length} real-time chunks...`);
          for (const chunkKey of chunkKeys) {
            try {
              await s3Client.send(
                new DeleteObjectCommand({
                  Bucket: S3_BUCKET,
                  Key: chunkKey,
                })
              );
            } catch (error) {
              console.warn(`[speech_end] Failed to delete ${chunkKey}:`, error);
            }
          }

          // Reset real-time chunk tracking
          await updateConnectionData(connectionId, {
            realtimeAudioSequenceNumber: -1,
            realtimeAudioChunkCount: 0,
          });

          console.log('[speech_end] Real-time audio processing complete');
        } catch (error) {
          console.error('[speech_end] Failed to process real-time audio:', error);
          await sendToConnection(connectionId, {
            type: 'error',
            code: 'SPEECH_END_PROCESSING_ERROR',
            message: 'Failed to process speech',
            details: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        break;

      case 'video_chunk_part':
        // Handle split video chunk parts (to overcome 32KB WebSocket limit)
        const chunkId = message.chunkId as string;
        const partIndex = message.partIndex as number;
        const totalParts = message.totalParts as number;
        const partData = message.data as string;
        const partTimestamp = message.timestamp as number;
        const partSessionId = connectionData?.sessionId || 'unknown';

        console.log('Received video chunk part:', {
          chunkId,
          partIndex,
          totalParts,
          dataSize: partData ? partData.length : 0,
          timestamp: partTimestamp,
          sessionId: partSessionId,
        });

        try {
          // Save this part directly to S3 (avoid DynamoDB 400KB limit)
          const partKey = `sessions/${partSessionId}/chunks/temp/${chunkId}/part-${partIndex}.bin`;
          const partBuffer = Buffer.from(partData, 'base64');

          await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: partKey,
              Body: partBuffer,
              ContentType: 'application/octet-stream',
              Metadata: {
                chunkId,
                partIndex: partIndex.toString(),
                totalParts: totalParts.toString(),
                timestamp: partTimestamp.toString(),
              },
            })
          );

          console.log(`Saved part ${partIndex + 1}/${totalParts} to S3:`, partKey);

          // Check if all parts received by listing S3 objects
          const listResponse = await s3Client.send(
            new ListObjectsV2Command({
              Bucket: S3_BUCKET,
              Prefix: `sessions/${partSessionId}/chunks/temp/${chunkId}/`,
            })
          );

          const receivedParts = listResponse.Contents?.length || 0;
          console.log(`Received ${receivedParts}/${totalParts} parts for chunk ${chunkId}`);

          if (receivedParts === totalParts) {
            // All parts received, try to acquire processing lock
            console.log(`All parts received for chunk ${chunkId}, acquiring lock...`);

            // Use DynamoDB conditional write to ensure only ONE Lambda processes this chunk
            const lockKey = `video-lock-${chunkId}`;
            try {
              await ddb.send(
                new PutCommand({
                  TableName: CONNECTIONS_TABLE,
                  Item: {
                    connection_id: lockKey,
                    sessionId: partSessionId,
                    chunkId: chunkId,
                    lockedAt: Date.now(),
                    ttl: Math.floor(Date.now() / 1000) + 300, // 5 minute TTL
                  },
                  ConditionExpression: 'attribute_not_exists(connection_id)',
                })
              );
              console.log(`Lock acquired for chunk ${chunkId}, proceeding with processing`);
            } catch (error: any) {
              if (error.name === 'ConditionalCheckFailedException') {
                console.log(
                  `Lock already held for chunk ${chunkId}, skipping duplicate processing`
                );
                // Another Lambda is already processing this chunk - return success
                return {
                  statusCode: 200,
                  body: JSON.stringify({ message: 'Chunk already being processed' }),
                };
              }
              throw error; // Re-throw unexpected errors
            }

            // Lock acquired, now reassemble and save to S3
            let processingSuccess = false;
            let videoChunkCount = 0;
            try {
              console.log(`Reassembling video chunk ${chunkId}...`);

              // Download all parts in order
              const partBuffers: Buffer[] = [];
              for (let i = 0; i < totalParts; i++) {
                const partKey = `sessions/${partSessionId}/chunks/temp/${chunkId}/part-${i}.bin`;
                const getResponse = await s3Client.send(
                  new GetObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: partKey,
                  })
                );

                if (getResponse.Body) {
                  const chunkBuffer = await getResponse.Body.transformToByteArray();
                  partBuffers.push(Buffer.from(chunkBuffer));
                } else {
                  throw new Error(`Missing part ${i} for chunk ${chunkId}`);
                }
              }

              // Concatenate all parts
              const videoBuffer = Buffer.concat(partBuffers);

              console.log(`Reassembled video chunk:`, {
                chunkId,
                totalParts,
                combinedSize: videoBuffer.length,
              });

              // Save final video chunk to S3
              videoChunkCount = (connectionData?.videoChunksCount || 0) + 1;
              const videoProc = getVideoProcessor();

              await videoProc.saveVideoChunk(
                partSessionId,
                videoBuffer,
                partTimestamp,
                videoChunkCount
              );

              console.log('Saved reassembled video chunk to S3:', {
                sessionId: partSessionId,
                chunkCount: videoChunkCount,
                chunkId,
              });

              // Clean up temporary parts from S3
              for (let i = 0; i < totalParts; i++) {
                const partKey = `sessions/${partSessionId}/chunks/temp/${chunkId}/part-${i}.bin`;
                try {
                  await s3Client.send(
                    new DeleteObjectCommand({
                      Bucket: S3_BUCKET,
                      Key: partKey,
                    })
                  );
                } catch (cleanupError) {
                  console.warn(`Failed to clean up part ${i}:`, cleanupError);
                }
              }

              processingSuccess = true;
            } catch (processingError) {
              console.error(
                `[video_chunk_part] Processing failed for chunk ${chunkId}:`,
                processingError
              );

              // Notify client of error
              try {
                await sendToConnection(connectionId, {
                  type: 'error',
                  code: 'VIDEO_PROCESSING_ERROR',
                  message: 'Failed to process video chunk',
                  details:
                    processingError instanceof Error ? processingError.message : 'Unknown error',
                  chunkId,
                });
              } catch (sendError) {
                console.error('[video_chunk_part] Failed to send error notification:', sendError);
              }
            } finally {
              // Always clean up lock (success or failure)
              const lockDeleted = await deleteLockWithRetry(lockKey);
              if (lockDeleted) {
                console.log(
                  `Lock cleanup completed for chunk ${chunkId} (success=${processingSuccess})`
                );
              }
            }

            // Only update connection data and send acknowledgment if processing succeeded
            if (processingSuccess) {
              await updateConnectionData(connectionId, {
                lastVideoChunkTime: partTimestamp,
                videoChunksCount: videoChunkCount,
              });

              // Send acknowledgment
              await sendToConnection(connectionId, {
                type: 'video_chunk_ack',
                chunkId,
                chunksReceived: videoChunkCount,
                timestamp: partTimestamp,
              });
            }
          }
          // If not all parts received yet, do nothing (no DynamoDB update needed)
        } catch (error) {
          console.error('Failed to process video chunk part:', error);
          await sendToConnection(connectionId, {
            type: 'error',
            code: 'VIDEO_CHUNK_PART_ERROR',
            message: 'Failed to process video chunk part',
            chunkId,
            partIndex,
          });
        }
        break;

      case 'video_chunk':
        // Handle video recording chunks (legacy - for backward compatibility)
        const videoData = message.data as string;
        const videoTimestamp = message.timestamp as number;
        const videoSessionId = connectionData?.sessionId || 'unknown';

        console.log('Received video chunk:', {
          timestamp: videoTimestamp,
          dataSize: videoData ? videoData.length : 0,
          connectionId,
          sessionId: videoSessionId,
        });

        // Save video chunk to S3
        const videoChunkCount = (connectionData?.videoChunksCount || 0) + 1;

        try {
          const videoBuffer = Buffer.from(videoData, 'base64');
          const videoProc = getVideoProcessor();

          await videoProc.saveVideoChunk(
            videoSessionId,
            videoBuffer,
            videoTimestamp,
            videoChunkCount
          );

          console.log('Saved video chunk to S3:', {
            sessionId: videoSessionId,
            chunkCount: videoChunkCount,
          });
        } catch (error) {
          console.error('Failed to save video chunk to S3:', error);
          await sendToConnection(connectionId, {
            type: 'error',
            code: 'VIDEO_CHUNK_ERROR',
            message: 'Failed to save video chunk',
          });
        }

        await updateConnectionData(connectionId, {
          lastVideoChunkTime: videoTimestamp,
          videoChunksCount: videoChunkCount,
        });

        // Acknowledge receipt periodically (every 10th chunk to reduce traffic)
        if (videoChunkCount % 10 === 0) {
          await sendToConnection(connectionId, {
            type: 'video_chunk_ack',
            chunksReceived: videoChunkCount,
            timestamp: videoTimestamp,
          });
        }
        break;

      case 'audio_data_part':
        // Handle split audio data parts (to overcome 32KB WebSocket limit)
        const audioChunkId = message.chunkId as string;
        const audioPartIndex = message.partIndex as number;
        const audioTotalParts = message.totalParts as number;
        const audioPartData = message.data as string;
        const audioPartTimestamp = message.timestamp as number;
        const audioDataSessionId = connectionData?.sessionId || 'unknown';
        const audioContentType = message.contentType as string;

        console.log('Received audio data part:', {
          chunkId: audioChunkId,
          partIndex: audioPartIndex,
          totalParts: audioTotalParts,
          dataSize: audioPartData ? audioPartData.length : 0,
          timestamp: audioPartTimestamp,
          sessionId: audioDataSessionId,
        });

        try {
          // Save this part directly to S3 (avoid DynamoDB 400KB limit)
          const audioPartKey = `sessions/${audioDataSessionId}/chunks/temp/audio/${audioChunkId}/part-${audioPartIndex}.bin`;
          const audioPartBuffer = Buffer.from(audioPartData, 'base64');

          await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: audioPartKey,
              Body: audioPartBuffer,
              ContentType: 'application/octet-stream',
              Metadata: {
                chunkId: audioChunkId,
                partIndex: audioPartIndex.toString(),
                totalParts: audioTotalParts.toString(),
                timestamp: audioPartTimestamp.toString(),
                contentType: audioContentType,
              },
            })
          );

          console.log(
            `Saved audio part ${audioPartIndex + 1}/${audioTotalParts} to S3:`,
            audioPartKey
          );

          // Check if all parts received by listing S3 objects
          const audioListResponse = await s3Client.send(
            new ListObjectsV2Command({
              Bucket: S3_BUCKET,
              Prefix: `sessions/${audioDataSessionId}/chunks/temp/audio/${audioChunkId}/`,
            })
          );

          const audioReceivedParts = audioListResponse.Contents?.length || 0;
          console.log(
            `Received ${audioReceivedParts}/${audioTotalParts} audio parts for chunk ${audioChunkId}`
          );

          if (audioReceivedParts === audioTotalParts) {
            // All parts received, try to acquire processing lock
            console.log(`All audio parts received for chunk ${audioChunkId}, acquiring lock...`);

            // Use DynamoDB conditional write to ensure only ONE Lambda processes this chunk
            const lockKey = `audio-lock-${audioChunkId}`;
            try {
              await ddb.send(
                new PutCommand({
                  TableName: CONNECTIONS_TABLE,
                  Item: {
                    connection_id: lockKey,
                    sessionId: audioDataSessionId,
                    chunkId: audioChunkId,
                    lockedAt: Date.now(),
                    ttl: Math.floor(Date.now() / 1000) + 300, // 5 minute TTL
                  },
                  ConditionExpression: 'attribute_not_exists(connection_id)',
                })
              );
              console.log(`Lock acquired for chunk ${audioChunkId}, proceeding with processing`);

              // Mark that audio processing is in progress
              await updateConnectionData(connectionId, {
                audioProcessingInProgress: true,
                currentAudioChunkId: audioChunkId,
              });
            } catch (error: any) {
              if (error.name === 'ConditionalCheckFailedException') {
                console.log(
                  `Lock already held for chunk ${audioChunkId}, skipping duplicate processing`
                );
                // Another Lambda is already processing this chunk - return success
                return {
                  statusCode: 200,
                  body: JSON.stringify({ message: 'Audio chunk already being processed' }),
                };
              }
              throw error; // Re-throw unexpected errors
            }

            // Lock acquired, now reassemble and process
            let audioProcessingSuccess = false;
            try {
              console.log(`Reassembling audio chunk ${audioChunkId}...`);

              // Download all parts in order
              const audioPartBuffers: Buffer[] = [];
              for (let i = 0; i < audioTotalParts; i++) {
                const partKey = `sessions/${audioDataSessionId}/chunks/temp/audio/${audioChunkId}/part-${i}.bin`;
                const getResponse = await s3Client.send(
                  new GetObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: partKey,
                  })
                );

                if (getResponse.Body) {
                  const partBuffer = await getResponse.Body.transformToByteArray();
                  audioPartBuffers.push(Buffer.from(partBuffer));
                } else {
                  throw new Error(`Missing audio part ${i} for chunk ${audioChunkId}`);
                }
              }

              // Concatenate all parts
              const completeAudioBuffer = Buffer.concat(audioPartBuffers);

              console.log(`Reassembled complete audio:`, {
                chunkId: audioChunkId,
                totalParts: audioTotalParts,
                combinedSize: completeAudioBuffer.length,
              });

              // Send processing status
              await sendToConnection(connectionId, {
                type: 'processing_update',
                stage: 'transcribing',
                progress: 0.33,
              });

              // Process through STT -> AI -> TTS pipeline
              await handleAudioProcessing(connectionId, completeAudioBuffer, connectionData);

              // Clean up temporary parts from S3
              console.log('Cleaning up temporary audio parts...');
              for (let i = 0; i < audioTotalParts; i++) {
                const partKey = `sessions/${audioDataSessionId}/chunks/temp/audio/${audioChunkId}/part-${i}.bin`;
                try {
                  await s3Client.send(
                    new DeleteObjectCommand({
                      Bucket: S3_BUCKET,
                      Key: partKey,
                    })
                  );
                } catch (error) {
                  console.error(`Failed to delete audio part ${i}:`, error);
                }
              }

              audioProcessingSuccess = true;
            } catch (processingError) {
              console.error(
                `[audio_data_part] Processing failed for chunk ${audioChunkId}:`,
                processingError
              );

              // Notify client of error
              try {
                await sendToConnection(connectionId, {
                  type: 'error',
                  code: 'AUDIO_PROCESSING_ERROR',
                  message: 'Failed to process audio',
                  details:
                    processingError instanceof Error ? processingError.message : 'Unknown error',
                  chunkId: audioChunkId,
                });
              } catch (sendError) {
                console.error('[audio_data_part] Failed to send error notification:', sendError);
              }
            } finally {
              // Always clean up lock (success or failure)
              const lockDeleted = await deleteLockWithRetry(lockKey);
              if (lockDeleted) {
                console.log(
                  `Lock cleanup completed for chunk ${audioChunkId} (success=${audioProcessingSuccess})`
                );
              }
            }

            // Only perform cleanup if processing succeeded
            if (audioProcessingSuccess) {
              // Clear audio processing flags
              await updateConnectionData(connectionId, {
                audioChunksCount: 0,
                audioProcessingInProgress: false,
                currentAudioChunkId: null,
              });
              console.log('[audio_data_part] Audio processing complete, cleared flags');

              // Check if session_end was received while we were processing
              const updatedConnectionData = await getConnectionData(connectionId);
              if (updatedConnectionData?.sessionEndReceived) {
                console.log('[audio_data_part] session_end was received, sending session_complete now');
                // Audio processing is complete and session_end was waiting for us
                await sendToConnection(connectionId, {
                  type: 'session_complete',
                  sessionId: audioDataSessionId,
                  message: 'Session ended successfully',
                });
              }

              // Delete audio-chunks from S3 to prevent session_end from re-processing
              try {
                const chunksPrefix = `sessions/${audioDataSessionId}/audio-chunks/`;
                const listResponse = await s3Client.send(
                  new ListObjectsV2Command({
                    Bucket: S3_BUCKET,
                    Prefix: chunksPrefix,
                  })
                );

                if (listResponse.Contents && listResponse.Contents.length > 0) {
                  console.log(
                    `Deleting ${listResponse.Contents.length} audio-chunks from S3 to prevent duplicate processing`
                  );
                  for (const obj of listResponse.Contents) {
                    if (obj.Key) {
                      await s3Client.send(
                        new DeleteObjectCommand({
                          Bucket: S3_BUCKET,
                          Key: obj.Key,
                        })
                      );
                    }
                  }
                  console.log('[audio_data_part] Deleted audio-chunks from S3');
                }
              } catch (error) {
                console.error('[audio_data_part] Failed to delete audio-chunks:', error);
                // Non-critical error, continue
              }
            }
          } else {
            // Send acknowledgment that part was received
            await sendToConnection(connectionId, {
              type: 'audio_part_ack',
              chunkId: audioChunkId,
              partsReceived: audioReceivedParts,
              totalParts: audioTotalParts,
            });
          }
        } catch (error) {
          console.error('Failed to process audio data part:', error);
          await sendToConnection(connectionId, {
            type: 'error',
            code: 'AUDIO_PART_ERROR',
            message: error instanceof Error ? error.message : 'Failed to process audio part',
          });
        }
        break;

      case 'audio_data':
        // Process complete audio data (base64 encoded) - legacy support
        await handleAudioData(connectionId, message, connectionData);
        break;

      case 'user_speech':
        // Process text directly (STT already done on client or for testing)
        await handleUserSpeech(connectionId, message, connectionData);
        break;

      case 'speech_end':
        // Currently not used - client sends complete audio_data instead
        console.log('Speech end:', message);
        break;

      case 'session_end':
        // Finalize session and process accumulated audio
        console.log('Session end:', message);

        // Process accumulated audio chunks if any
        if (connectionData?.audioChunksCount && connectionData.audioChunksCount > 0) {
          console.log(
            `Processing ${connectionData.audioChunksCount} accumulated audio chunks from S3`
          );

          try {
            await sendToConnection(connectionId, {
              type: 'processing_update',
              stage: 'processing_audio',
              progress: 0.3,
            });

            // Load and combine audio chunks from S3
            const sessionId = connectionData.sessionId || 'unknown';
            const chunksPrefix = `sessions/${sessionId}/audio-chunks/`;

            console.log('Listing audio chunks in S3:', chunksPrefix);

            const listResponse = await s3Client.send(
              new ListObjectsV2Command({
                Bucket: S3_BUCKET,
                Prefix: chunksPrefix,
              })
            );

            if (!listResponse.Contents || listResponse.Contents.length === 0) {
              console.log(
                '[session_end] No audio chunks found in S3 - already processed by audio_data_part, skipping audio re-processing'
              );
              // Reset counter and skip audio processing (audio was already processed by audio_data_part)
              await updateConnectionData(connectionId, {
                audioChunksCount: 0,
              });
            } else {
              console.log(`Found ${listResponse.Contents.length} chunks in S3`);

              // Sort chunks using shared utility function
              const sortedChunks = sortChunksByTimestampAndIndex(listResponse.Contents);

              // Log sorted chunks with validation
              logSortedChunks(sortedChunks, 'session_end:audio', 5);

              // Download and combine all chunks
              const audioBuffers: Buffer[] = [];
              for (const chunk of sortedChunks) {
                if (!chunk.Key) continue;

                const getResponse = await s3Client.send(
                  new GetObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: chunk.Key,
                  })
                );

                if (getResponse.Body) {
                  const chunkBuffer = await getResponse.Body.transformToByteArray();
                  audioBuffers.push(Buffer.from(chunkBuffer));
                }
              }

              const combinedAudioBuffer = Buffer.concat(audioBuffers);
              console.log('Combined audio size:', combinedAudioBuffer.length, 'bytes');

              await sendToConnection(connectionId, {
                type: 'processing_update',
                stage: 'transcribing',
                progress: 0.5,
              });

              // Process through STT -> AI -> TTS pipeline
              await handleAudioProcessing(connectionId, combinedAudioBuffer, connectionData);

              // Clear audio chunks count after processing
              await updateConnectionData(connectionId, {
                audioChunksCount: 0,
              });
            } // End of else block (audio chunks found)
          } catch (error) {
            console.error('Failed to process accumulated audio:', error);
            await sendToConnection(connectionId, {
              type: 'error',
              code: 'AUDIO_PROCESSING_ERROR',
              message: 'Failed to process recorded audio',
            });
          }
        }

        // Process video chunks if any
        if (connectionData?.videoChunksCount && connectionData.videoChunksCount > 0) {
          console.log(`Processing ${connectionData.videoChunksCount} video chunks from S3`);

          try {
            await sendToConnection(connectionId, {
              type: 'processing_update',
              stage: 'processing_video',
              progress: 0.6,
            });

            const videoProc = getVideoProcessor();
            const sessionId = connectionData.sessionId || 'unknown';

            // Combine video chunks using ffmpeg
            const result = await videoProc.combineChunks(sessionId);

            console.log('Video processing complete:', result);

            await sendToConnection(connectionId, {
              type: 'processing_update',
              stage: 'video_ready',
              progress: 1.0,
            });

            // Save recording metadata to DynamoDB
            try {
              const recordingId = `rec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
              await ddb.send(
                new PutCommand({
                  TableName: RECORDINGS_TABLE,
                  Item: {
                    recording_id: recordingId,
                    sessionId: sessionId,
                    type: 'COMBINED',
                    s3_key: result.finalVideoKey,
                    s3_url: `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || DEFAULT_AWS_REGION}.amazonaws.com/${result.finalVideoKey}`,
                    cdn_url: result.cloudFrontUrl,
                    file_size_bytes: result.finalVideoSize,
                    duration_sec: Math.floor(result.duration / 1000), // Convert ms to seconds
                    format: VIDEO_FORMAT,
                    resolution: VIDEO_RESOLUTION,
                    video_chunks_count: connectionData.videoChunksCount,
                    processing_status: 'COMPLETED',
                    processed_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                  },
                })
              );
              console.log('Recording metadata saved to DynamoDB:', { recordingId, sessionId });
            } catch (dbError) {
              console.error('Failed to save recording metadata to DynamoDB:', dbError);
              // Continue even if DynamoDB save fails - video is already in S3
            }

            // Send video URL to client
            await sendToConnection(connectionId, {
              type: 'video_ready',
              videoUrl: result.cloudFrontUrl,
              videoKey: result.finalVideoKey,
              videoSize: result.finalVideoSize,
              processingDuration: result.duration,
            });
          } catch (error) {
            console.error('Failed to process video:', error);

            // Save error status to DynamoDB
            try {
              const sessionId = connectionData.sessionId || 'unknown';
              const recordingId = `rec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
              await ddb.send(
                new PutCommand({
                  TableName: RECORDINGS_TABLE,
                  Item: {
                    recording_id: recordingId,
                    sessionId: sessionId,
                    type: 'COMBINED',
                    s3_key: `sessions/${sessionId}/recording.${VIDEO_FORMAT}`,
                    s3_url: '',
                    file_size_bytes: 0,
                    video_chunks_count: connectionData.videoChunksCount || 0,
                    processing_status: 'ERROR',
                    error_message: error instanceof Error ? error.message : 'Unknown error',
                    created_at: new Date().toISOString(),
                  },
                })
              );
              console.log('Recording error metadata saved to DynamoDB:', {
                recordingId,
                sessionId,
              });
            } catch (dbError) {
              console.error('Failed to save recording error metadata to DynamoDB:', dbError);
            }

            await sendToConnection(connectionId, {
              type: 'error',
              code: 'VIDEO_PROCESSING_ERROR',
              message: 'Failed to process video recording',
              details: error instanceof Error ? error.message : 'Unknown error',
            });
          }

          // Clear video chunks count after processing
          await updateConnectionData(connectionId, {
            videoChunksCount: 0,
          });
        }

        // Check if audio processing is still in progress
        // audio_data_part sets audioProcessingInProgress flag when lock is acquired
        const currentConnectionData = await getConnectionData(connectionId);

        // Check if audio data exists or processing is in progress
        const hasAudioData = (currentConnectionData?.audioChunksCount || 0) > 0;
        const isProcessing = currentConnectionData?.audioProcessingInProgress;

        if (isProcessing || hasAudioData) {
          console.log('[session_end] Audio data exists or processing in progress, marking session_end_received flag');
          console.log('[session_end] Current state:', {
            audioChunksCount: currentConnectionData?.audioChunksCount,
            audioProcessingInProgress: isProcessing,
            currentAudioChunkId: currentConnectionData?.currentAudioChunkId,
          });
          // Mark that session_end was received, audio_data_part will send session_complete when done
          await updateConnectionData(connectionId, {
            sessionEndReceived: true,
          });
        } else {
          // Audio processing is complete (or was never started), send session_complete now
          console.log('[session_end] Audio processing complete or not started, sending session_complete');
          
          // 🆕 Trigger automatic analysis (if enabled)
          if (process.env.ENABLE_AUTO_ANALYSIS === 'true' && connectionData?.sessionId) {
            console.log('[session_end] Triggering automatic analysis', {
              sessionId: connectionData.sessionId,
            });
            
            try {
              // Invoke analysis Lambda function asynchronously
              await lambdaClient.send(
                new InvokeCommand({
                  FunctionName: process.env.ANALYSIS_LAMBDA_FUNCTION_NAME || 'prance-session-analysis-dev',
                  InvocationType: 'Event', // Asynchronous invocation
                  Payload: JSON.stringify({ sessionId: connectionData.sessionId }),
                })
              );
              
              console.log('[session_end] Analysis triggered successfully');
            } catch (analysisError) {
              console.error('[session_end] Failed to trigger analysis:', analysisError);
              // Non-critical error - continue to send session_complete
            }
          }
          
          await sendToConnection(connectionId, {
            type: 'session_complete',
            sessionId: connectionData?.sessionId,
            message: 'Session ended successfully',
          });
        }
        break;

      default:
        console.warn('Unknown message type:', message.type);
        await sendToConnection(connectionId, {
          type: 'error',
          code: 'UNKNOWN_MESSAGE_TYPE',
          message: `Unknown message type: ${message.type}`,
        });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message processed' }),
    };
  } catch (error) {
    console.error('Default handler error:', error);

    try {
      await sendToConnection(connectionId, {
        type: 'error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Handle accumulated audio chunks processing
 * Process: STT -> AI -> TTS -> Send back to client
 */
async function handleAudioProcessing(
  connectionId: string,
  audioBuffer: Buffer,
  connectionData?: ConnectionData
): Promise<void> {
  try {
    const sessionId = connectionData?.sessionId || 'unknown';

    console.log('[handleAudioProcessing] Starting:', {
      sessionId,
      audioSize: audioBuffer.length,
      hasScenarioPrompt: !!connectionData?.scenarioPrompt,
      scenarioLanguage: connectionData?.scenarioLanguage,
    });

    // Send processing status
    await sendToConnection(connectionId, {
      type: 'processing_update',
      stage: 'transcribing',
      progress: 0.33,
    });

    // Process through STT -> AI -> TTS pipeline
    const processor = getAudioProcessor();
    const result = await processor.processAudio({
      audioData: audioBuffer,
      sessionId,
      scenarioPrompt: connectionData?.scenarioPrompt,
      scenarioLanguage: connectionData?.scenarioLanguage, // Pass scenario language for STT priority
      conversationHistory: connectionData?.conversationHistory || [],
    });

    // Send transcript (partial result)
    await sendToConnection(connectionId, {
      type: 'transcript_final',
      speaker: 'USER',
      text: result.transcript,
      timestamp_start: Date.now(),
      confidence: 0.95,
    });

    // Update conversation history
    const updatedHistory = [
      ...(connectionData?.conversationHistory || []),
      { role: 'user' as const, content: result.transcript },
      { role: 'assistant' as const, content: result.aiResponse },
    ];

    await updateConnectionData(connectionId, {
      conversationHistory: updatedHistory,
    });

    // Send AI response text
    await sendToConnection(connectionId, {
      type: 'avatar_response',
      speaker: 'AI',
      text: result.aiResponse,
      timestamp: Date.now(),
    });

    // Upload AI response audio to S3 (to avoid WebSocket 32KB limit)
    const audioTimestamp = Date.now();
    const audioKey = `sessions/${sessionId}/audio/ai-response-${audioTimestamp}.${result.audioContentType.includes('mpeg') || result.audioContentType.includes('mp3') ? 'mp3' : 'webm'}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: audioKey,
        Body: result.audioResponse,
        ContentType: result.audioContentType,
      })
    );

    console.log('[handleAudioProcessing] Uploaded audio to S3:', audioKey);

    // Generate presigned URL for audio (valid for 1 hour)
    const audioUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: audioKey,
      }),
      { expiresIn: 3600 }
    );

    // Send AI response audio URL (instead of base64 data)
    await sendToConnection(connectionId, {
      type: 'audio_response',
      audioUrl,
      audioKey,
      contentType: result.audioContentType,
      timestamp: audioTimestamp,
    });

    console.log('[handleAudioProcessing] Complete:', {
      sessionId,
      transcriptLength: result.transcript.length,
      responseLength: result.aiResponse.length,
      audioSize: result.audioResponse.length,
    });
  } catch (error) {
    console.error('[handleAudioProcessing] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to process audio';
    const errorDetails = error instanceof Error ? error.stack : String(error);

    console.log('[handleAudioProcessing] Sending error to client:', {
      code: 'AUDIO_PROCESSING_ERROR',
      message: errorMessage,
      detailsPreview: errorDetails?.substring(0, 200),
    });

    await sendToConnection(connectionId, {
      type: 'error',
      code: 'AUDIO_PROCESSING_ERROR',
      message: errorMessage,
      details: errorDetails,
      timestamp: Date.now(),
    });
  }
}

/**
 * Handle audio processing with real-time streaming (Phase 1.5)
 * Streams AI response chunks to client via WebSocket
 */
async function handleAudioProcessingStreaming(
  connectionId: string,
  audioBuffer: Buffer,
  connectionData?: ConnectionData
): Promise<void> {
  try {
    const sessionId = connectionData?.sessionId || 'unknown';

    console.log('[handleAudioProcessingStreaming] Starting:', {
      sessionId,
      audioSize: audioBuffer.length,
      hasScenarioPrompt: !!connectionData?.scenarioPrompt,
      scenarioLanguage: connectionData?.scenarioLanguage,
    });

    // Track full AI response for conversation history
    let fullAIResponse = '';

    // Process audio with streaming callbacks
    const processor = getAudioProcessor();
    const result = await processor.processAudioStreaming({
      audioData: audioBuffer,
      sessionId,
      scenarioPrompt: connectionData?.scenarioPrompt,
      scenarioLanguage: connectionData?.scenarioLanguage,
      conversationHistory: connectionData?.conversationHistory || [],
      callbacks: {
        // Callback: Transcript complete
        onTranscriptComplete: async (transcript: string) => {
          console.log('[Streaming] Transcript complete:', transcript);
          await sendToConnection(connectionId, {
            type: 'transcript_final',
            speaker: 'USER',
            text: transcript,
            timestamp_start: Date.now(),
            confidence: 0.95,
          });
        },

        // Callback: AI chunk received (stream to client immediately)
        onAIChunk: async (chunk: string) => {
          fullAIResponse += chunk;
          console.log('[Streaming] AI chunk:', chunk.substring(0, 50));
          await sendToConnection(connectionId, {
            type: 'avatar_response_partial',
            speaker: 'AI',
            text: chunk,
            timestamp: Date.now(),
          });
        },

        // Callback: AI complete
        onAIComplete: async (fullText: string) => {
          console.log('[Streaming] AI complete:', fullText.length, 'chars');
          await sendToConnection(connectionId, {
            type: 'avatar_response_final',
            speaker: 'AI',
            text: fullText,
            timestamp: Date.now(),
          });
        },

        // Callback: TTS complete
        onTTSComplete: async (audio: Buffer, contentType: string) => {
          console.log('[Streaming] TTS complete:', audio.length, 'bytes');

          // Upload audio to S3
          const audioTimestamp = Date.now();
          const audioKey = `sessions/${sessionId}/audio/ai-response-${audioTimestamp}.${contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'webm'}`;

          await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: audioKey,
              Body: audio,
              ContentType: contentType,
            })
          );

          // Generate presigned URL
          const audioUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: S3_BUCKET,
              Key: audioKey,
            }),
            { expiresIn: 3600 }
          );

          // Send audio URL to client
          await sendToConnection(connectionId, {
            type: 'audio_response',
            audioUrl,
            audioKey,
            contentType,
            timestamp: audioTimestamp,
          });
        },
      },
    });

    // Update conversation history with full response
    const updatedHistory = [
      ...(connectionData?.conversationHistory || []),
      { role: 'user' as const, content: result.transcript },
      { role: 'assistant' as const, content: result.aiResponse },
    ];

    await updateConnectionData(connectionId, {
      conversationHistory: updatedHistory,
    });

    console.log('[handleAudioProcessingStreaming] Complete:', {
      sessionId,
      transcriptLength: result.transcript.length,
      responseLength: result.aiResponse.length,
      audioSize: result.audioResponse.length,
    });
  } catch (error) {
    console.error('[handleAudioProcessingStreaming] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to process audio';
    const errorDetails = error instanceof Error ? error.stack : String(error);

    await sendToConnection(connectionId, {
      type: 'error',
      code: 'AUDIO_PROCESSING_ERROR',
      message: errorMessage,
      details: errorDetails,
      timestamp: Date.now(),
    });
  }
}

/**
 * Handle audio data message
 * Process: STT -> AI -> TTS -> Send back to client
 */
async function handleAudioData(
  connectionId: string,
  message: WebSocketMessage,
  connectionData?: ConnectionData
): Promise<void> {
  try {
    const audioBase64 = message.audio as string;
    const sessionId = connectionData?.sessionId || 'unknown';

    if (!audioBase64) {
      throw new Error('No audio data provided');
    }

    // Send processing status
    await sendToConnection(connectionId, {
      type: 'processing_update',
      stage: 'transcribing',
      progress: 0.33,
    });

    // Decode base64 audio
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Process through STT -> AI -> TTS pipeline
    const processor = getAudioProcessor();
    const result = await processor.processAudio({
      audioData: audioBuffer,
      sessionId,
      scenarioPrompt: connectionData?.scenarioPrompt,
      conversationHistory: connectionData?.conversationHistory || [],
    });

    // Send transcript (partial result)
    await sendToConnection(connectionId, {
      type: 'transcript_final',
      speaker: 'USER',
      text: result.transcript,
      timestamp_start: Date.now(),
      confidence: 0.95,
    });

    // Update conversation history
    const updatedHistory = [
      ...(connectionData?.conversationHistory || []),
      { role: 'user' as const, content: result.transcript },
      { role: 'assistant' as const, content: result.aiResponse },
    ];

    await updateConnectionData(connectionId, {
      conversationHistory: updatedHistory,
    });

    // Send AI response text
    await sendToConnection(connectionId, {
      type: 'avatar_response',
      speaker: 'AI',
      text: result.aiResponse,
      timestamp: Date.now(),
    });

    // Upload AI response audio to S3 (to avoid WebSocket 32KB limit)
    const audioTimestamp = Date.now();
    const audioKey = `sessions/${sessionId}/audio/ai-response-${audioTimestamp}.${result.audioContentType.includes('mpeg') || result.audioContentType.includes('mp3') ? 'mp3' : 'webm'}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: audioKey,
        Body: result.audioResponse,
        ContentType: result.audioContentType,
      })
    );

    console.log('[handleAudioProcessing] Uploaded audio to S3:', audioKey);

    // Generate presigned URL for audio (valid for 1 hour)
    const audioUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: audioKey,
      }),
      { expiresIn: 3600 }
    );

    // Send AI response audio URL (instead of base64 data)
    await sendToConnection(connectionId, {
      type: 'audio_response',
      audioUrl,
      audioKey,
      contentType: result.audioContentType,
      timestamp: audioTimestamp,
    });

    console.log('[handleAudioData] Complete:', {
      sessionId,
      transcriptLength: result.transcript.length,
      responseLength: result.aiResponse.length,
      audioSize: result.audioResponse.length,
    });
  } catch (error) {
    console.error('[handleAudioData] Error:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      code: 'AUDIO_PROCESSING_ERROR',
      message: error instanceof Error ? error.message : 'Failed to process audio',
    });
  }
}

/**
 * Handle user speech message (text only, no STT)
 * Process: AI -> TTS -> Send back to client
 */
async function handleUserSpeech(
  connectionId: string,
  message: WebSocketMessage,
  connectionData?: ConnectionData
): Promise<void> {
  try {
    const text = message.text as string;
    const sessionId = connectionData?.sessionId || 'unknown';

    if (!text) {
      throw new Error('No text provided');
    }

    // Send processing status
    await sendToConnection(connectionId, {
      type: 'processing_update',
      stage: 'generating_response',
      progress: 0.5,
    });

    // Process through AI -> TTS pipeline (skip STT)
    const processor = getAudioProcessor();
    const result = await processor.processTextMessage(
      text,
      sessionId,
      connectionData?.scenarioPrompt,
      connectionData?.conversationHistory || []
    );

    // Update conversation history
    const updatedHistory = [
      ...(connectionData?.conversationHistory || []),
      { role: 'user' as const, content: text },
      { role: 'assistant' as const, content: result.aiResponse },
    ];

    await updateConnectionData(connectionId, {
      conversationHistory: updatedHistory,
    });

    // Send AI response
    await sendToConnection(connectionId, {
      type: 'avatar_response',
      speaker: 'AI',
      text: result.aiResponse,
      timestamp: Date.now(),
    });

    // Send audio response
    await sendToConnection(connectionId, {
      type: 'audio_response',
      audio: result.audioResponse.toString('base64'),
      contentType: result.audioContentType,
      timestamp: Date.now(),
    });

    console.log('[handleUserSpeech] Complete:', {
      sessionId,
      textLength: text.length,
      responseLength: result.aiResponse.length,
    });
  } catch (error) {
    console.error('[handleUserSpeech] Error:', error);
    await sendToConnection(connectionId, {
      type: 'error',
      code: 'TEXT_PROCESSING_ERROR',
      message: error instanceof Error ? error.message : 'Failed to process text',
    });
  }
}

/**
 * Get connection data from DynamoDB
 */
async function getConnectionData(connectionId: string): Promise<ConnectionData | undefined> {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connection_id: connectionId },
      })
    );

    return result.Item as ConnectionData | undefined;
  } catch (error) {
    console.error('Failed to get connection data:', error);
    return undefined;
  }
}

/**
 * Update connection data in DynamoDB
 */
async function updateConnectionData(
  connectionId: string,
  data: Partial<ConnectionData>
): Promise<void> {
  try {
    // Filter out undefined values
    const filteredData = Object.entries(data).filter(([_, value]) => value !== undefined);

    // If no valid data to update, skip
    if (filteredData.length === 0) {
      console.log('No valid data to update, skipping:', { connectionId });
      return;
    }

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    filteredData.forEach(([key, value], index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpression.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    });

    await ddb.send(
      new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connection_id: connectionId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );

    console.log('Updated connection data:', { connectionId, keys: Object.keys(data) });
  } catch (error) {
    console.error('Failed to update connection data:', error);
    throw error;
  }
}

/**
 * Send message to WebSocket client
 */
async function sendToConnection(connectionId: string, data: unknown): Promise<void> {
  try {
    const jsonData = JSON.stringify(data);

    // 🔍 診断用: エラーメッセージの全内容をログ出力
    if ((data as any).type === 'error') {
      console.log(`Sending error message to connection ${connectionId}:`, JSON.parse(jsonData));
    }

    await apiGateway.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(jsonData),
      })
    );
    console.log(`Sent message to connection ${connectionId}:`, { type: (data as any).type });
  } catch (error) {
    console.error(`Failed to send message to connection ${connectionId}:`, error);
    throw error;
  }
}
