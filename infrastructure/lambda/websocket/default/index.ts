/**
 * WebSocket $default Handler
 * Handles all WebSocket messages with STT/AI/TTS integration
 * Last updated: 2026-03-15 07:50:43 UTC (added no_speech_detected feature)
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
import { PrismaClient } from '@prisma/client';
import { AudioProcessor } from './audio-processor';
import { VideoProcessor } from './video-processor';
import { sortChunksByTimestampAndIndex, logSortedChunks, generateChunkKey } from './chunk-utils';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import {
  AWS_DEFAULTS,
  BEDROCK_DEFAULTS,
  ELEVENLABS_DEFAULTS,
  LANGUAGE_DEFAULTS,
  MEDIA_DEFAULTS,
  DYNAMODB_DEFAULTS,
} from '../../shared/config/defaults';

// Lambda function version
const LAMBDA_VERSION = '1.1.0';
const LAMBDA_NAME = 'websocket-default-handler';

// Supported languages (ISO 639-1 format: 'ja', 'en', 'zh-CN', 'zh-TW', etc.)
// Source of truth: packages/shared/src/language/index.ts
const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it'];

// Default values (imported from centralized configuration)
// Using values from shared/config/defaults.ts to eliminate hardcoding
const DEFAULT_AWS_REGION = AWS_DEFAULTS.REGION;
const DEFAULT_BEDROCK_REGION = BEDROCK_DEFAULTS.REGION;
const DEFAULT_BEDROCK_MODEL_ID = BEDROCK_DEFAULTS.MODEL_ID;
const DEFAULT_ELEVENLABS_MODEL_ID = ELEVENLABS_DEFAULTS.MODEL_ID;
const DEFAULT_STT_LANGUAGE = LANGUAGE_DEFAULTS.STT_LANGUAGE;
const DEFAULT_STT_AUTO_DETECT_LANGUAGES = Array.from(LANGUAGE_DEFAULTS.STT_AUTO_DETECT_LANGUAGES_DEFAULT);
const DEFAULT_SCENARIO_LANGUAGE = SUPPORTED_LANGUAGES[0]; // First supported language ('ja')
const DEFAULT_VIDEO_FORMAT = MEDIA_DEFAULTS.VIDEO_FORMAT;
const DEFAULT_VIDEO_RESOLUTION = MEDIA_DEFAULTS.VIDEO_RESOLUTION;
const DEFAULT_AUDIO_CONTENT_TYPE = MEDIA_DEFAULTS.AUDIO_CONTENT_TYPE;
const DEFAULT_VIDEO_CONTENT_TYPE = MEDIA_DEFAULTS.VIDEO_CONTENT_TYPE;

// Environment variables (読み取り優先順位: 環境変数 → デフォルト値)
const ENDPOINT = process.env.WEBSOCKET_ENDPOINT || '';
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE_NAME || '';
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

const prisma = new PrismaClient();

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
    `CRITICAL: Failed to delete lock ${lockKey} after ${maxRetries} attempts. TTL will clean up in ${DYNAMODB_DEFAULTS.VIDEO_LOCK_TTL_SECONDS / 60} minutes.`
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

  // Session Settings (from organization settings)
  silenceTimeout?: number; // Silence timeout in seconds (user speech end detection - Azure STT)
  silencePromptTimeout?: number; // AI silence prompt timeout in seconds (frontend timer)
  enableSilencePrompt?: boolean; // Enable AI silence prompt
  initialSilenceTimeout?: number; // Azure STT initial silence timeout in milliseconds

  // Video processing (Phase 2)
  videoChunksCount?: number; // Count of video chunks received
  lastVideoChunkTime?: number;

  // Real-time audio processing (Phase 1.5)
  realtimeAudioSequenceNumber?: number; // Latest sequence number received
  realtimeAudioChunkCount?: number; // Total count of real-time chunks
  realtimeAudioProcessing?: boolean; // Flag to prevent duplicate speech_end processing
  lastAudioProcessingStartTime?: number; // Timestamp when audio processing started
  sessionEndReceived?: boolean; // Flag to indicate session_end was received while speech_end was processing

  // Phase B: Removed legacy fields (batch audio processing)
  // - audioS3Key (unused)
  // - audioChunksCount (replaced by realtimeAudioChunkCount)
  // - lastChunkTime (unused)
  // - audioProcessingInProgress (replaced by realtimeAudioProcessing)
  // - currentAudioChunkId (unused)

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

        // Get scenario data directly from authenticate message (sent from frontend)
        const scenarioLanguage = (message as any).scenarioLanguage || DEFAULT_SCENARIO_LANGUAGE;
        const scenarioPrompt = (message as any).scenarioPrompt as string | undefined;
        const initialGreeting = (message as any).initialGreeting as string | undefined;
        const silenceTimeout = (message as any).silenceTimeout as number | undefined;
        const silencePromptTimeout = (message as any).silencePromptTimeout as number | undefined;
        const enableSilencePrompt = (message as any).enableSilencePrompt as boolean | undefined;
        const initialSilenceTimeout = (message as any).initialSilenceTimeout as number | undefined;

        console.log('[authenticate] Received scenario data:', {
          hasPrompt: !!scenarioPrompt,
          promptPreview: scenarioPrompt ? scenarioPrompt.substring(0, 100) + '...' : 'none',
          language: scenarioLanguage,
          hasInitialGreeting: !!initialGreeting,
          initialGreetingPreview: initialGreeting ? initialGreeting.substring(0, 50) + '...' : 'none',
          silenceTimeout,
          silencePromptTimeout,
          enableSilencePrompt,
          initialSilenceTimeout,
        });

        // Initialize conversation history
        const initialConversationHistory: any[] = [];

        // If initial greeting is provided, add to conversation history
        if (initialGreeting) {
          initialConversationHistory.push({
            role: 'assistant',
            content: initialGreeting,
          });
        }

        await updateConnectionData(connectionId, {
          sessionId,
          conversationHistory: initialConversationHistory,
          scenarioLanguage, // Store language for audio processing
          scenarioPrompt, // Store system prompt for AI context
          initialGreeting, // Store initial AI greeting
          silenceTimeout, // Store silence timeout (Azure STT)
          silencePromptTimeout, // Store AI silence prompt timeout (frontend timer)
          enableSilencePrompt, // Store silence prompt flag
          initialSilenceTimeout, // Store Azure STT initial silence timeout
        });

        // Send authenticated response
        await sendToConnection(connectionId, {
          type: 'authenticated',
          message: 'Session initialized',
          sessionId,
          initialGreeting, // Send initial greeting back to client
          silenceTimeout,
          silencePromptTimeout,
          enableSilencePrompt,
          initialSilenceTimeout,
        });

        // If initial greeting is provided, generate TTS and send audio
        if (initialGreeting) {
          console.log('[authenticate] Generating TTS for initial greeting:', {
            textLength: initialGreeting.length,
            language: scenarioLanguage,
          });

          try {
            // Generate TTS for initial greeting
            const audioProc = getAudioProcessor();
            const ttsResult = await audioProc.generateSimpleSpeech(initialGreeting);

            console.log('[authenticate] Initial greeting TTS generated:', {
              audioSize: ttsResult.audio.length,
              contentType: ttsResult.contentType,
            });

            // Save audio to S3
            const { getInitialGreetingKey } = await import('../../shared/config/s3-paths');
            const audioKey = getInitialGreetingKey(sessionId);
            await s3Client.send(
              new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: audioKey,
                Body: ttsResult.audio,
                ContentType: ttsResult.contentType,
              })
            );

            // Generate audio URL (CloudFront)
            const audioUrl = `https://${CLOUDFRONT_DOMAIN}/${audioKey}`;

            console.log('[authenticate] Initial greeting audio saved to S3:', audioKey);

            // Send avatar_response_final for transcript display
            await sendToConnection(connectionId, {
              type: 'avatar_response_final',
              text: initialGreeting,
              timestamp: Date.now(),
            });

            // Send audio_response with S3 URL
            await sendToConnection(connectionId, {
              type: 'audio_response',
              audioUrl: audioUrl,
              contentType: ttsResult.contentType,
              timestamp: Date.now(),
            });

            console.log('[authenticate] Initial greeting sent successfully');
          } catch (error) {
            console.error('[authenticate] Failed to generate initial greeting TTS:', error);
            // Don't break authentication - just log the error
            // The text will still be displayed in the transcript
          }
        }
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

      // Phase B: Legacy audio_chunk handler removed - use audio_chunk_realtime instead
      case 'audio_chunk':
        console.log('[DEPRECATED] audio_chunk handler removed - use audio_chunk_realtime instead');
        await sendToConnection(connectionId, {
          type: 'error',
          code: 'DEPRECATED_MESSAGE_TYPE',
          message: 'audio_chunk is deprecated, use audio_chunk_realtime instead',
        });
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
          const { getRealtimeChunkKey } = await import('../../shared/config/s3-paths');
          const rtChunkKey = getRealtimeChunkKey(rtSessionId, rtSequenceNumber);
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

        // Check if audio processing is already in progress (prevent duplicate processing)
        if (connectionData?.realtimeAudioProcessing) {
          const processingDuration = Date.now() - (connectionData.lastAudioProcessingStartTime || 0);
          console.warn('[speech_end] Audio processing already in progress, skipping duplicate request:', {
            sessionId: speechEndSessionId,
            processingDuration: `${processingDuration}ms`,
            startTime: connectionData.lastAudioProcessingStartTime,
          });

          // Send acknowledgment but don't process again
          await sendToConnection(connectionId, {
            type: 'processing_update',
            stage: 'already_processing',
            progress: 0.5,
            message: 'Audio processing already in progress',
          });
          break;
        }

        // Set processing flag to prevent duplicate processing
        await updateConnectionData(connectionId, {
          realtimeAudioProcessing: true,
          lastAudioProcessingStartTime: Date.now(),
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

          // Download and combine chunks using shared utility (Phase A: Code Deduplication)
          const { downloadAndCombineChunks, cleanupChunks } = await import('./chunk-utils');
          const { getRealtimeChunksPrefix } = await import('../../shared/config/s3-paths');
          const chunkPrefix = getRealtimeChunksPrefix(speechEndSessionId);

          console.log(`[speech_end] Downloading chunks from S3: ${chunkPrefix}`);
          const result = await downloadAndCombineChunks(
            s3Client,
            S3_BUCKET,
            chunkPrefix
            // Uses sortChunksByTimestampAndIndex by default
          );

          if (result.chunkCount === 0) {
            console.warn('[speech_end] No chunks found in S3');

            // Clear processing flag
            await updateConnectionData(connectionId, {
              realtimeAudioProcessing: false,
              lastAudioProcessingStartTime: undefined,
            });

            await sendToConnection(connectionId, {
              type: 'error',
              code: 'NO_AUDIO_DATA',
              message: 'No audio data received',
            });
            break;
          }

          console.log('[speech_end] Downloaded chunks:', {
            chunkCount: result.chunkCount,
            totalSize: result.totalSize,
          });

          // Convert multiple WebM chunks to WAV (cannot simply concatenate WebM chunks)
          console.log('[speech_end] Converting WebM chunks to WAV...');
          const audioProc = getAudioProcessor();
          const wavBuffer = await audioProc.convertMultipleWebMChunksToWav(result.buffers);

          console.log('[speech_end] Conversion complete:', {
            totalChunks: result.buffers.length,
            wavSize: wavBuffer.length,
          });

          // Process through STT -> AI (streaming) -> TTS pipeline (Phase 1.5)
          await handleAudioProcessingStreaming(connectionId, wavBuffer, connectionData);

          // Clean up real-time chunks from S3 using shared utility
          await cleanupChunks(s3Client, S3_BUCKET, result.chunkKeys);

          // Reset real-time chunk tracking and clear processing flag
          await updateConnectionData(connectionId, {
            realtimeAudioSequenceNumber: -1,
            realtimeAudioChunkCount: 0,
            realtimeAudioProcessing: false,
            lastAudioProcessingStartTime: undefined,
          });

          console.log('[speech_end] Real-time audio processing complete');
        } catch (error) {
          console.error('[speech_end] Failed to process real-time audio:', error);

          // Clear processing flag on error
          await updateConnectionData(connectionId, {
            realtimeAudioProcessing: false,
            lastAudioProcessingStartTime: undefined,
          });

          await sendToConnection(connectionId, {
            type: 'error',
            code: 'SPEECH_END_PROCESSING_ERROR',
            message: 'Failed to process speech',
            details: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        break;

      case 'silence_prompt_request':
        // User has been silent for too long - generate and send an encouraging prompt
        console.log('[silence_prompt_request] Received silence prompt request');

        try {
          // Check rate limiting - prevent spam (max 1 prompt per 30 seconds)
          const lastPromptTime = (connectionData?.lastSilencePromptTime as number | undefined) || 0;
          const timeSinceLastPrompt = Date.now() - lastPromptTime;
          if (timeSinceLastPrompt < 30000) {
            console.log('[silence_prompt_request] Too soon after last prompt, skipping:', {
              timeSinceLastPrompt: `${timeSinceLastPrompt}ms`,
            });
            break;
          }

          // Update timestamp immediately to prevent concurrent requests
          await updateConnectionData(connectionId, {
            lastSilencePromptTime: Date.now(),
          });

          // Import generateSilencePrompt utility
          const { generateSilencePrompt } = await import('../../shared/utils/generateSilencePrompt');

          // Extract conversation history and convert to the expected format
          const rawHistory = connectionData?.conversationHistory || [];
          const conversationHistory = rawHistory.map((msg: any) => ({
            speaker: msg.role === 'user' ? 'USER' as const : 'AI' as const,
            text: msg.content || msg.text || '',
          }));

          const scenarioPrompt = connectionData?.scenarioPrompt;
          const scenarioLanguage = connectionData?.scenarioLanguage || 'en';
          const silencePromptStyle = (connectionData as any)?.silencePromptStyle || 'neutral';

          // Get last user message for context
          const lastUserMessage = conversationHistory
            .slice()
            .reverse()
            .find((msg: any) => msg.speaker === 'USER')?.text;

          console.log('[silence_prompt_request] Generating silence prompt:', {
            conversationLength: conversationHistory.length,
            language: scenarioLanguage,
            style: silencePromptStyle,
            hasLastUserMessage: !!lastUserMessage,
          });

          // Generate contextual prompt
          const promptText = await generateSilencePrompt({
            conversationHistory,
            scenarioPrompt,
            scenarioLanguage,
            style: silencePromptStyle,
            lastUserMessage,
          });

          console.log('[silence_prompt_request] Generated prompt:', promptText);

          // Add to conversation history in the same format
          const promptMessage = {
            role: 'assistant' as const,
            content: promptText,
          };

          await updateConnectionData(connectionId, {
            conversationHistory: [...rawHistory, promptMessage],
          });

          // Send as avatar_response_final
          await sendToConnection(connectionId, {
            type: 'avatar_response_final',
            text: promptText,
            timestamp: Date.now(),
          });

          // Generate TTS for the prompt using ElevenLabs
          const silenceSessionId = connectionData?.sessionId || 'unknown';
          const audioProc = getAudioProcessor();

          console.log('[silence_prompt_request] Generating TTS for silence prompt...');

          // Use the simple TTS method
          const ttsResult = await audioProc.generateSimpleSpeech(promptText);

          console.log('[silence_prompt_request] TTS generation complete:', {
            audioSize: ttsResult.audio.length,
            contentType: ttsResult.contentType,
          });

          // Save audio to S3
          const { getSilencePromptKey } = await import('../../shared/config/s3-paths');
          const audioKey = getSilencePromptKey(silenceSessionId);
          await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: audioKey,
              Body: ttsResult.audio,
              ContentType: ttsResult.contentType,
            })
          );

          // Generate signed URL
          const audioUrl = `https://${CLOUDFRONT_DOMAIN}/${audioKey}`;

          console.log('[silence_prompt_request] Audio saved to S3:', audioKey);

          // Send final audio_response with S3 URL
          await sendToConnection(connectionId, {
            type: 'audio_response',
            audioUrl: audioUrl,
            contentType: ttsResult.contentType,
            timestamp: Date.now(),
          });

          console.log('[silence_prompt_request] Silence prompt sent successfully');
        } catch (error) {
          console.error('[silence_prompt_request] Failed to generate silence prompt:', error);

          // Send error but don't break the session
          await sendToConnection(connectionId, {
            type: 'error',
            code: 'SILENCE_PROMPT_ERROR',
            message: 'Failed to generate silence prompt',
            details: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        break;

      case 'video_chunk_part':
        // Handle split video chunk parts (to overcome 32KB WebSocket limit)
        // Phase 1.6: Added sequence number tracking and hash validation
        const chunkId = message.chunkId as string;
        const sequenceNumber = message.sequenceNumber as number;
        const partIndex = message.partIndex as number;
        const totalParts = message.totalParts as number;
        const partData = message.data as string;
        const chunkHash = message.hash as string;
        const partTimestamp = message.timestamp as number;
        const partSessionId = connectionData?.sessionId || 'unknown';

        console.log('Received video chunk part:', {
          chunkId,
          sequenceNumber,
          partIndex,
          totalParts,
          dataSize: partData ? partData.length : 0,
          hash: chunkHash ? chunkHash.substring(0, 16) + '...' : 'missing',
          timestamp: partTimestamp,
          sessionId: partSessionId,
        });

        try {
          // Phase 1.6: Validate hash for integrity
          const { getTempChunkPartKey } = await import('../../shared/config/s3-paths');
          const partKey = getTempChunkPartKey(partSessionId, chunkId, partIndex);
          const partBuffer = Buffer.from(partData, 'base64');

          // Only validate hash on first part (hash is for complete chunk, not individual parts)
          if (partIndex === 0 && chunkHash) {
            const crypto = require('crypto');
            // We'll validate the complete chunk hash after reassembly
            console.log(`Will validate hash after reassembly: ${chunkHash.substring(0, 16)}...`);
          }

          await s3Client.send(
            new PutObjectCommand({
              Bucket: S3_BUCKET,
              Key: partKey,
              Body: partBuffer,
              ContentType: 'application/octet-stream',
              Metadata: {
                chunkId,
                sequenceNumber: sequenceNumber.toString(),
                partIndex: partIndex.toString(),
                totalParts: totalParts.toString(),
                hash: chunkHash || '',
                timestamp: partTimestamp.toString(),
              },
            })
          );

          console.log(`Saved part ${partIndex + 1}/${totalParts} to S3:`, partKey);

          // Check if all parts received by listing S3 objects
          const { getTempChunkPartPrefix } = await import('../../shared/config/s3-paths');
          const listResponse = await s3Client.send(
            new ListObjectsV2Command({
              Bucket: S3_BUCKET,
              Prefix: getTempChunkPartPrefix(partSessionId, chunkId),
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
                    ttl: Math.floor(Date.now() / 1000) + DYNAMODB_DEFAULTS.VIDEO_LOCK_TTL_SECONDS,
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
              const { getTempChunkPartKey: getTempPartKey } = await import('../../shared/config/s3-paths');
              const partBuffers: Buffer[] = [];
              for (let i = 0; i < totalParts; i++) {
                const partKey = getTempPartKey(partSessionId, chunkId, i);
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

              // Phase 1.6: Validate hash after reassembly
              if (chunkHash) {
                const crypto = require('crypto');
                const calculatedHash = crypto.createHash('sha256').update(videoBuffer).digest('hex');

                if (calculatedHash !== chunkHash) {
                  console.error(`[video_chunk_part] Hash mismatch for chunk ${chunkId}`);
                  console.error(`  Expected: ${chunkHash}`);
                  console.error(`  Calculated: ${calculatedHash}`);

                  // Send error response
                  await sendToConnection(connectionId, {
                    type: 'video_chunk_error',
                    chunkId,
                    error: 'HASH_MISMATCH',
                    message: 'Video chunk data corrupted during transmission',
                  });

                  throw new Error('Hash mismatch');
                }

                console.log(`Hash validated successfully: ${calculatedHash.substring(0, 16)}...`);
              }

              // Save final video chunk to S3
              videoChunkCount = (connectionData?.videoChunksCount || 0) + 1;
              const videoProc = getVideoProcessor();

              await videoProc.saveVideoChunk(
                partSessionId,
                videoBuffer,
                partTimestamp,
                videoChunkCount,
                sequenceNumber
              );

              console.log('Saved reassembled video chunk to S3:', {
                sessionId: partSessionId,
                chunkCount: videoChunkCount,
                chunkId,
                sequenceNumber,
              });

              // Clean up temporary parts from S3
              const { getTempChunkPartKey: getTempPartKeyCleanup } = await import('../../shared/config/s3-paths');
              for (let i = 0; i < totalParts; i++) {
                const partKey = getTempPartKeyCleanup(partSessionId, chunkId, i);
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

              // Send acknowledgment (Phase 1.6: Added sequence number)
              await sendToConnection(connectionId, {
                type: 'video_chunk_ack',
                chunkId,
                sequenceNumber,
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

      // REMOVED: case 'audio_data_part' - Dual audio flow unification (2026-03-12)
      // リアルタイムチャンク方式 (audio_chunk_realtime + speech_end) に統一
      // 完全音声データ方式 (audio_data_part) は廃止
      // 詳細: 無駄な処理の複数箇所実行を排除するため削除
      case 'audio_data_part':
        console.log('[DEPRECATED] audio_data_part handler removed - use realtime chunks instead');
        await sendToConnection(connectionId, {
          type: 'error',
          code: 'DEPRECATED_MESSAGE_TYPE',
          message: 'audio_data_part is deprecated, use audio_chunk_realtime + speech_end instead',
        });
        break;

      case 'audio_data':
        // Process complete audio data (base64 encoded) - legacy support
        await handleAudioData(connectionId, message, connectionData);
        break;

      case 'user_speech':
        // Process text directly (STT already done on client or for testing)
        await handleUserSpeech(connectionId, message, connectionData);
        break;

      case 'session_end':
        // Finalize session and process accumulated audio
        console.log('Session end:', message);

        // Phase B: Audio processing removed - handled by speech_end in real-time
        // Phase 1.5 uses realtime-chunks/ path processed by speech_end handler
        // Legacy audio-chunks/ path is no longer used
        console.log('[session_end] Audio processing already completed by speech_end handler (Phase 1.5)');

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

            // Save recording metadata to PostgreSQL
            try {
              const recording = await prisma.recording.create({
                data: {
                  sessionId: sessionId,
                  type: 'COMBINED',
                  s3Key: result.finalVideoKey,
                  s3Url: `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || DEFAULT_AWS_REGION}.amazonaws.com/${result.finalVideoKey}`,
                  cdnUrl: result.cloudFrontUrl,
                  fileSizeBytes: BigInt(result.finalVideoSize),
                  durationSec: Math.floor(result.duration / 1000), // Convert ms to seconds
                  format: VIDEO_FORMAT,
                  resolution: VIDEO_RESOLUTION,
                  videoChunksCount: connectionData.videoChunksCount,
                  processingStatus: 'COMPLETED',
                  processedAt: new Date(),
                },
              });
              console.log('Recording metadata saved to PostgreSQL:', { recordingId: recording.id, sessionId });
            } catch (dbError) {
              console.error('Failed to save recording metadata to PostgreSQL:', dbError);
              // Continue even if DB save fails - video is already in S3
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

            // Save error status to PostgreSQL
            try {
              const sessionId = connectionData.sessionId || 'unknown';
              const { getRecordingKey } = await import('../../shared/config/s3-paths');
              const recording = await prisma.recording.create({
                data: {
                  sessionId: sessionId,
                  type: 'COMBINED',
                  s3Key: getRecordingKey(sessionId, VIDEO_FORMAT),
                  s3Url: '',
                  fileSizeBytes: BigInt(0),
                  videoChunksCount: connectionData.videoChunksCount || 0,
                  processingStatus: 'ERROR',
                  errorMessage: error instanceof Error ? error.message : 'Unknown error',
                },
              });
              console.log('Recording error metadata saved to PostgreSQL:', {
                recordingId: recording.id,
                sessionId,
              });
            } catch (dbError) {
              console.error('Failed to save recording error metadata to PostgreSQL:', dbError);
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

        // Check if audio processing is still in progress (Phase B: simplified check)
        // speech_end sets realtimeAudioProcessing flag when processing real-time chunks
        const currentConnectionData = await getConnectionData(connectionId);
        const isProcessing = currentConnectionData?.realtimeAudioProcessing;

        if (isProcessing) {
          console.log('[session_end] Audio processing in progress, marking session_end_received flag');
          console.log('[session_end] Current state:', {
            realtimeAudioProcessing: isProcessing,
            lastAudioProcessingStartTime: currentConnectionData?.lastAudioProcessingStartTime,
          });
          // Mark that session_end was received, speech_end will send session_complete when done
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
 * Handle audio processing with real-time streaming (Phase 1.5)
 * Streams AI response chunks to client via WebSocket
 *
 * Phase B: Batch version (handleAudioProcessing) removed - only streaming version used
 */
/**
 * Generate and send AI silence prompt when user is silent or speech not detected
 * Reuses silence_prompt_request logic
 */
async function handleSilencePromptGeneration(
  connectionId: string,
  connectionData?: ConnectionData
): Promise<void> {
  try {
    // Check rate limiting - prevent spam (max 1 prompt per 30 seconds)
    const lastPromptTime = (connectionData?.lastSilencePromptTime as number | undefined) || 0;
    const timeSinceLastPrompt = Date.now() - lastPromptTime;
    if (timeSinceLastPrompt < 30000) {
      console.log('[handleSilencePromptGeneration] Too soon after last prompt, skipping:', {
        timeSinceLastPrompt: `${timeSinceLastPrompt}ms`,
      });
      return;
    }

    // Update timestamp immediately to prevent concurrent requests
    await updateConnectionData(connectionId, {
      lastSilencePromptTime: Date.now(),
    });

    // Import generateSilencePrompt utility
    const { generateSilencePrompt } = await import('../../shared/utils/generateSilencePrompt');

    // Extract conversation history and convert to the expected format
    const rawHistory = connectionData?.conversationHistory || [];
    const conversationHistory = rawHistory.map((msg: any) => ({
      speaker: msg.role === 'user' ? 'USER' as const : 'AI' as const,
      text: msg.content || msg.text || '',
    }));

    const scenarioPrompt = connectionData?.scenarioPrompt;
    const scenarioLanguage = connectionData?.scenarioLanguage || 'en';
    const silencePromptStyle = (connectionData as any)?.silencePromptStyle || 'neutral';

    // Get last user message for context (may be empty if no speech detected)
    const lastUserMessage = conversationHistory
      .slice()
      .reverse()
      .find((msg: any) => msg.speaker === 'USER')?.text;

    console.log('[handleSilencePromptGeneration] Generating silence prompt:', {
      conversationLength: conversationHistory.length,
      language: scenarioLanguage,
      style: silencePromptStyle,
      hasLastUserMessage: !!lastUserMessage,
    });

    // Generate contextual prompt
    const promptText = await generateSilencePrompt({
      conversationHistory,
      scenarioPrompt,
      scenarioLanguage,
      style: silencePromptStyle,
      lastUserMessage,
    });

    console.log('[handleSilencePromptGeneration] Generated prompt:', promptText);

    // Add to conversation history
    const promptMessage = {
      role: 'assistant' as const,
      content: promptText,
    };

    await updateConnectionData(connectionId, {
      conversationHistory: [...rawHistory, promptMessage],
    });

    // Send as avatar_response_final
    await sendToConnection(connectionId, {
      type: 'avatar_response_final',
      text: promptText,
      timestamp: Date.now(),
    });

    // Generate TTS for the prompt using ElevenLabs
    const sessionId = connectionData?.sessionId || 'unknown';
    const audioProc = getAudioProcessor();

    console.log('[handleSilencePromptGeneration] Generating TTS for silence prompt...');

    // Use simple TTS method (synchronous, returns complete audio)
    const ttsResult = await audioProc.generateSimpleSpeech(promptText);

    console.log('[handleSilencePromptGeneration] TTS generation complete:', {
      audioSize: ttsResult.audio.length,
      contentType: ttsResult.contentType,
    });

    // Save audio to S3
    const { getSilencePromptKey } = await import('../../shared/config/s3-paths');
    const audioKey = getSilencePromptKey(sessionId);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: audioKey,
        Body: ttsResult.audio,
        ContentType: ttsResult.contentType,
      })
    );

    // Generate CloudFront URL
    const audioUrl = `https://${CLOUDFRONT_DOMAIN}/${audioKey}`;

    console.log('[handleSilencePromptGeneration] Audio saved to S3:', audioKey);

    // Send final audio_response with S3 URL
    await sendToConnection(connectionId, {
      type: 'audio_response',
      audioUrl: audioUrl,
      contentType: ttsResult.contentType,
      timestamp: Date.now(),
    });

    console.log('[handleSilencePromptGeneration] Silence prompt sent successfully');
  } catch (error) {
    console.error('[handleSilencePromptGeneration] Error:', error);
    // Don't throw - this is optional functionality
  }
}

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
      initialSilenceTimeout: connectionData?.initialSilenceTimeout, // 組織設定から取得
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

        // Callback: TTS chunk received (stream to client immediately) - Phase 1.5 Day 6-7
        onTTSChunk: async (audioChunk: string, isFinal: boolean) => {
          console.log('[Streaming] TTS chunk:', {
            chunkSize: audioChunk.length,
            isFinal,
          });

          // Send audio chunk to client for immediate playback
          await sendToConnection(connectionId, {
            type: 'audio_chunk',
            audio: audioChunk, // base64-encoded MP3 chunk
            isFinal,
            timestamp: Date.now(),
          });
        },

        // Callback: TTS complete
        onTTSComplete: async (audio: Buffer, contentType: string) => {
          console.log('[Streaming] TTS complete:', audio.length, 'bytes');

          // Upload audio to S3
          const audioTimestamp = Date.now();
          const { getAudioKey } = await import('../../shared/config/s3-paths');
          const { AudioFileType } = await import('../../shared/config/s3-paths');
          const extension = contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'webm';
          const audioKey = getAudioKey(sessionId, AudioFileType.AI_RESPONSE, audioTimestamp, extension);

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

    // Check if this is a "no speech detected" error (not a real error, just no speech)
    const isNoSpeechError =
      errorMessage.includes('InitialSilenceTimeout') ||
      errorMessage.includes('NotRecognized') ||
      errorMessage.includes('No speech detected') ||
      errorMessage.includes('No speech recognized');

    if (isNoSpeechError) {
      // This is not an error - just means the user didn't speak or audio is too quiet
      console.log('[handleAudioProcessingStreaming] No speech detected - providing user guidance');

      // Send guidance message to user (not an error)
      await sendToConnection(connectionId, {
        type: 'no_speech_detected',
        message: 'No speech detected. Please speak louder or move closer to your microphone.',
        timestamp: Date.now(),
      });

      // If silence prompts are enabled, generate an AI prompt
      const enableSilencePrompt = connectionData?.enableSilencePrompt;
      if (enableSilencePrompt) {
        console.log('[handleAudioProcessingStreaming] Generating AI silence prompt...');
        await handleSilencePromptGeneration(connectionId, connectionData);
      }
    } else {
      // This is a real error - send error message
      await sendToConnection(connectionId, {
        type: 'error',
        code: 'AUDIO_PROCESSING_ERROR',
        message: errorMessage,
        details: errorDetails,
        timestamp: Date.now(),
      });
    }
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

    // Process through STT -> AI -> TTS pipeline (streaming mode)
    const processor = getAudioProcessor();

    // Use streaming version - collect result callbacks
    let transcript = '';
    let aiResponse = '';
    let audioResponse: Buffer = Buffer.alloc(0);
    let audioContentType = 'audio/mpeg';

    const result = await processor.processAudioStreaming({
      audioData: audioBuffer,
      sessionId,
      scenarioPrompt: connectionData?.scenarioPrompt,
      scenarioLanguage: connectionData?.scenarioLanguage,
      conversationHistory: connectionData?.conversationHistory || [],
      callbacks: {
        onTranscriptComplete: async (text: string) => {
          transcript = text;
        },
        onAIComplete: async (text: string) => {
          aiResponse = text;
        },
        onTTSComplete: async (audio: Buffer, contentType: string) => {
          audioResponse = audio;
          audioContentType = contentType;
        },
      },
    });

    // Send transcript (partial result)
    await sendToConnection(connectionId, {
      type: 'transcript_final',
      speaker: 'USER',
      text: transcript,
      timestamp_start: Date.now(),
      confidence: 0.95,
    });

    // Update conversation history
    const updatedHistory = [
      ...(connectionData?.conversationHistory || []),
      { role: 'user' as const, content: transcript },
      { role: 'assistant' as const, content: aiResponse },
    ];

    await updateConnectionData(connectionId, {
      conversationHistory: updatedHistory,
    });

    // Send AI response text
    await sendToConnection(connectionId, {
      type: 'avatar_response',
      speaker: 'AI',
      text: aiResponse,
      timestamp: Date.now(),
    });

    // Upload AI response audio to S3 (to avoid WebSocket 32KB limit)
    const audioTimestamp = Date.now();
    const { getAudioKey: getAudioKeyLegacy } = await import('../../shared/config/s3-paths');
    const { AudioFileType: AudioFileTypeLegacy } = await import('../../shared/config/s3-paths');
    const extensionLegacy = audioContentType.includes('mpeg') || audioContentType.includes('mp3') ? 'mp3' : 'webm';
    const audioKey = getAudioKeyLegacy(sessionId, AudioFileTypeLegacy.AI_RESPONSE, audioTimestamp, extensionLegacy);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: audioKey,
        Body: audioResponse,
        ContentType: audioContentType,
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
