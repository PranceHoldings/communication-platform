/**
 * Rate Limiter using Token Bucket Algorithm with DynamoDB
 * Phase 1.6: Performance Optimization
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { getRequiredEnv, getAwsRegion } from './env-validator';

const dynamoDbClient = new DynamoDBClient({ region: getAwsRegion() });
const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

interface TokenBucketConfig {
  maxTokens: number; // Maximum number of tokens in the bucket
  refillRate: number; // Tokens added per second
  key: string; // Unique identifier (e.g., userId, sessionId, or IP)
}

interface TokenBucket {
  tokens: number; // Current number of tokens
  lastRefill: number; // Unix timestamp (seconds) of last refill
}

/**
 * Check if rate limit is exceeded and consume tokens if available
 * @param config Token bucket configuration
 * @param tokensRequired Number of tokens required for this operation (default: 1)
 * @returns true if allowed, false if rate limit exceeded
 */
export async function checkRateLimit(
  config: TokenBucketConfig,
  tokensRequired: number = 1
): Promise<{ allowed: boolean; remainingTokens: number; retryAfter?: number }> {
  const tableName = getRequiredEnv('DYNAMODB_RATE_LIMIT_TABLE');
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

  try {
    // Get current bucket state
    const getResult = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { limitKey: config.key },
      })
    );

    let bucket: TokenBucket;

    if (!getResult.Item) {
      // First request - initialize bucket with max tokens
      bucket = {
        tokens: config.maxTokens,
        lastRefill: now,
      };
    } else {
      bucket = getResult.Item as TokenBucket;

      // Calculate tokens to add based on time elapsed
      const elapsedSeconds = now - bucket.lastRefill;
      const tokensToAdd = elapsedSeconds * config.refillRate;

      // Refill tokens (up to max)
      bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if enough tokens available
    if (bucket.tokens >= tokensRequired) {
      // Consume tokens
      bucket.tokens -= tokensRequired;

      // Update bucket in DynamoDB
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            limitKey: config.key,
            tokens: bucket.tokens,
            lastRefill: bucket.lastRefill,
            ttl: now + 86400, // Expire after 24 hours of inactivity
          },
        })
      );

      return {
        allowed: true,
        remainingTokens: Math.floor(bucket.tokens),
      };
    } else {
      // Rate limit exceeded - calculate retry after
      const tokensNeeded = tokensRequired - bucket.tokens;
      const retryAfterSeconds = Math.ceil(tokensNeeded / config.refillRate);

      // Update bucket state (no token consumption)
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            limitKey: config.key,
            tokens: bucket.tokens,
            lastRefill: bucket.lastRefill,
            ttl: now + 86400,
          },
        })
      );

      return {
        allowed: false,
        remainingTokens: Math.floor(bucket.tokens),
        retryAfter: retryAfterSeconds,
      };
    }
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);
    // On error, allow the request (fail open to prevent service disruption)
    return {
      allowed: true,
      remainingTokens: config.maxTokens,
    };
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitProfiles = {
  // Audio chunk sending - high frequency, generous limit
  audioChunk: (sessionId: string): TokenBucketConfig => ({
    key: `audio:${sessionId}`,
    maxTokens: 100, // 100 chunks burst capacity
    refillRate: 20, // 20 chunks per second (50ms interval)
  }),

  // Video chunk sending - medium frequency
  videoChunk: (sessionId: string): TokenBucketConfig => ({
    key: `video:${sessionId}`,
    maxTokens: 50, // 50 chunks burst capacity
    refillRate: 10, // 10 chunks per second (100ms interval)
  }),

  // Speech recognition - low frequency
  speechRecognition: (sessionId: string): TokenBucketConfig => ({
    key: `speech:${sessionId}`,
    maxTokens: 30, // 30 requests burst capacity
    refillRate: 5, // 5 requests per second
  }),

  // AI response generation - very low frequency
  aiResponse: (sessionId: string): TokenBucketConfig => ({
    key: `ai:${sessionId}`,
    maxTokens: 10, // 10 requests burst capacity
    refillRate: 1, // 1 request per second
  }),

  // TTS generation - low frequency
  tts: (sessionId: string): TokenBucketConfig => ({
    key: `tts:${sessionId}`,
    maxTokens: 20, // 20 requests burst capacity
    refillRate: 2, // 2 requests per second
  }),

  // WebSocket messages - high frequency
  websocketMessage: (connectionId: string): TokenBucketConfig => ({
    key: `ws:${connectionId}`,
    maxTokens: 200, // 200 messages burst capacity
    refillRate: 50, // 50 messages per second
  }),

  // API requests (per user) - medium frequency
  apiRequest: (userId: string): TokenBucketConfig => ({
    key: `api:${userId}`,
    maxTokens: 100, // 100 requests burst capacity
    refillRate: 10, // 10 requests per second
  }),

  // Session creation - very low frequency
  sessionCreate: (userId: string): TokenBucketConfig => ({
    key: `session:${userId}`,
    maxTokens: 5, // 5 sessions burst capacity
    refillRate: 0.1, // 1 session per 10 seconds (0.1/s)
  }),
};

/**
 * Reset rate limit for a specific key (admin function)
 */
export async function resetRateLimit(key: string): Promise<void> {
  const tableName = getRequiredEnv('DYNAMODB_RATE_LIMIT_TABLE');

  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          limitKey: key,
          tokens: 0,
          lastRefill: Math.floor(Date.now() / 1000),
          ttl: Math.floor(Date.now() / 1000) + 60, // Expire in 1 minute
        },
      })
    );
    console.log(`[RateLimiter] Reset rate limit for key: ${key}`);
  } catch (error) {
    console.error('[RateLimiter] Error resetting rate limit:', error);
    throw error;
  }
}

/**
 * Get current rate limit status without consuming tokens
 */
export async function getRateLimitStatus(
  config: TokenBucketConfig
): Promise<{ tokens: number; maxTokens: number; refillRate: number }> {
  const tableName = getRequiredEnv('DYNAMODB_RATE_LIMIT_TABLE');
  const now = Math.floor(Date.now() / 1000);

  try {
    const getResult = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { limitKey: config.key },
      })
    );

    if (!getResult.Item) {
      return {
        tokens: config.maxTokens,
        maxTokens: config.maxTokens,
        refillRate: config.refillRate,
      };
    }

    const bucket = getResult.Item as TokenBucket;

    // Calculate current tokens with refill
    const elapsedSeconds = now - bucket.lastRefill;
    const tokensToAdd = elapsedSeconds * config.refillRate;
    const currentTokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);

    return {
      tokens: Math.floor(currentTokens),
      maxTokens: config.maxTokens,
      refillRate: config.refillRate,
    };
  } catch (error) {
    console.error('[RateLimiter] Error getting rate limit status:', error);
    return {
      tokens: config.maxTokens,
      maxTokens: config.maxTokens,
      refillRate: config.refillRate,
    };
  }
}
