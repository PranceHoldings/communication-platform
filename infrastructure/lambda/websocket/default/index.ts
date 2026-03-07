/**
 * WebSocket $default Handler
 * Handles all WebSocket messages with STT/AI/TTS integration
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
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AudioProcessor } from './audio-processor';
import { VideoProcessor } from './video-processor';

// Default values (centralized configuration)
// Note: These defaults are defined here instead of importing from shared/config
// to avoid Docker bundling path resolution issues
// These values should match those in shared/config/defaults.ts
const DEFAULT_AWS_REGION = 'us-east-1';
const DEFAULT_BEDROCK_REGION = 'us-east-1';
const DEFAULT_BEDROCK_MODEL_ID = 'us.anthropic.claude-sonnet-4-6';
const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5';
const DEFAULT_STT_LANGUAGE = 'en-US';
const DEFAULT_VIDEO_FORMAT = 'webm';
const DEFAULT_VIDEO_RESOLUTION = '1280x720';
const DEFAULT_AUDIO_CONTENT_TYPE = 'audio/webm';
const DEFAULT_VIDEO_CONTENT_TYPE = 'video/webm';

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

// Audio Processor (lazy initialization to avoid errors when API keys are not set)
let audioProcessor: AudioProcessor | null = null;

function getAudioProcessor(): AudioProcessor {
  if (!audioProcessor) {
    // Check if required environment variables are set
    if (!AZURE_SPEECH_KEY || !ELEVENLABS_API_KEY) {
      throw new Error('Audio processing API keys not configured. Set AZURE_SPEECH_KEY and ELEVENLABS_API_KEY environment variables.');
    }

    audioProcessor = new AudioProcessor({
      azureSpeechKey: AZURE_SPEECH_KEY,
      azureSpeechRegion: AZURE_SPEECH_REGION,
      elevenLabsApiKey: ELEVENLABS_API_KEY,
      elevenLabsVoiceId: ELEVENLABS_VOICE_ID,
      elevenLabsModelId: ELEVENLABS_MODEL_ID,
      bedrockRegion: BEDROCK_REGION,
      bedrockModelId: BEDROCK_MODEL_ID,
      s3Bucket: S3_BUCKET,
      language: STT_LANGUAGE,
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
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  audioS3Key?: string; // S3 key for accumulated audio chunks
  audioChunksCount?: number;
  lastChunkTime?: number;
  videoChunksCount?: number; // Count of video chunks received
  lastVideoChunkTime?: number;
  // Note: videoChunkParts removed - parts are stored directly in S3 to avoid DynamoDB 400KB limit
  [key: string]: unknown;
}

export const handler = async (
  event: WebSocketEvent
): Promise<APIGatewayProxyResultV2> => {
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
        await updateConnectionData(connectionId, {
          sessionId,
          conversationHistory: [],
        });

        await sendToConnection(connectionId, {
          type: 'authenticated',
          message: 'Session initialized',
          sessionId,
        });
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
        const chunkKey = `sessions/${audioSessionId}/audio-chunks/${timestamp}-${chunkCount}.${VIDEO_FORMAT}`;

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
            // All parts received, reassemble and save to S3
            console.log(`All parts received for chunk ${chunkId}, reassembling...`);

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
            const videoChunkCount = (connectionData?.videoChunksCount || 0) + 1;
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

            // Update connection data (only counters, no large data)
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

          console.log('Saved video chunk to S3:', { sessionId: videoSessionId, chunkCount: videoChunkCount });
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

      case 'audio_data':
        // Process complete audio data (base64 encoded)
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
          console.log(`Processing ${connectionData.audioChunksCount} accumulated audio chunks from S3`);

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
              throw new Error('No audio chunks found in S3');
            }

            console.log(`Found ${listResponse.Contents.length} chunks in S3`);

            // Sort chunks by timestamp (filename contains timestamp)
            const sortedChunks = listResponse.Contents.sort((a, b) => {
              const aKey = a.Key || '';
              const bKey = b.Key || '';
              return aKey.localeCompare(bKey);
            });

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
          } catch (error) {
            console.error('Failed to process accumulated audio:', error);
            await sendToConnection(connectionId, {
              type: 'error',
              code: 'AUDIO_PROCESSING_ERROR',
              message: 'Failed to process recorded audio',
            });
          }

          // Clear audio chunks count after processing
          await updateConnectionData(connectionId, {
            audioChunksCount: 0,
          });
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
              console.log('Recording error metadata saved to DynamoDB:', { recordingId, sessionId });
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

        await sendToConnection(connectionId, {
          type: 'session_complete',
          sessionId: connectionData?.sessionId,
          message: 'Session ended successfully',
        });
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

    // Send AI response audio URL (instead of base64 data)
    await sendToConnection(connectionId, {
      type: 'audio_response',
      audioUrl: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${audioKey}`,
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
    await sendToConnection(connectionId, {
      type: 'error',
      code: 'AUDIO_PROCESSING_ERROR',
      message: error instanceof Error ? error.message : 'Failed to process audio',
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

    // Send AI response audio URL (instead of base64 data)
    await sendToConnection(connectionId, {
      type: 'audio_response',
      audioUrl: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${audioKey}`,
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
async function getConnectionData(
  connectionId: string
): Promise<ConnectionData | undefined> {
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
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    Object.entries(data).forEach(([key, value], index) => {
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
    await apiGateway.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      })
    );
    console.log(`Sent message to connection ${connectionId}:`, { type: (data as any).type });
  } catch (error) {
    console.error(`Failed to send message to connection ${connectionId}:`, error);
    throw error;
  }
}
