/**
 * Rate Limiter Utility for Guest Sessions
 *
 * DynamoDB-based rate limiting to prevent brute force attacks on guest PIN authentication.
 *
 * Features:
 * - IP-based rate limiting
 * - Configurable max attempts and lockout duration
 * - Exponential backoff support
 * - Automatic cleanup via TTL
 *
 * @module rateLimiter
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  getAwsRegion,
  getOptionalEnv,
  getOptionalEnvAsNumber,
  getEnvironmentName,
} from './env-validator';
import {
  getRateLimitMaxAttempts,
  getRateLimitLockoutDurationMs,
  getRateLimitAttemptWindowMs,
} from './runtime-config-loader';

// DynamoDB Client
const client = new DynamoDBClient({ region: getAwsRegion() });
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Configuration helpers (dynamic to support test environment variable changes)
const getTableName = () =>
  getOptionalEnv('GUEST_RATE_LIMIT_TABLE', `prance-guest-rate-limits-${getEnvironmentName()}`);

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of attempts in the current window */
  attempts: number;
  /** Locked until timestamp (if locked) */
  lockedUntil?: Date;
  /** Remaining attempts before lockout */
  remainingAttempts?: number;
}

/**
 * Rate limit attempt record
 */
export interface RateLimitAttempt {
  ipAddress: string;
  timestamp: number;
  token?: string;
  ttl: number;
}

/**
 * Check if an IP address is rate limited for a specific token
 *
 * @param ipAddress - Client IP address
 * @param token - Guest session token (optional, for token-specific limits)
 * @returns Rate limit result
 *
 * @example
 * const result = await checkRateLimit('192.168.1.1', 'abc123');
 * if (!result.allowed) {
 *   console.log(`Locked until: ${result.lockedUntil}`);
 * }
 */
export async function checkRateLimit(ipAddress: string, token?: string): Promise<RateLimitResult> {
  const now = Date.now();
  const attemptWindow = await getRateLimitAttemptWindowMs();
  const windowStart = now - attemptWindow;

  try {
    // Query attempts within the time window
    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'ipAddress = :ip AND #ts > :windowStart',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':ip': ipAddress,
          ':windowStart': windowStart,
        },
        ScanIndexForward: false, // Most recent first
      })
    );

    const attempts = result.Items?.length || 0;
    const maxAttempts = await getRateLimitMaxAttempts();

    // Check if locked
    if (attempts >= maxAttempts) {
      const oldestAttempt = result.Items?.[result.Items.length - 1];
      const lockoutDuration = await getRateLimitLockoutDurationMs();
      const lockedUntil = new Date(oldestAttempt.timestamp + lockoutDuration);

      // Check if lockout period has expired
      if (now < lockedUntil.getTime()) {
        return {
          allowed: false,
          attempts,
          lockedUntil,
          remainingAttempts: 0,
        };
      }

      // Lockout expired, reset attempts
      await resetAttempts(ipAddress);
      return {
        allowed: true,
        attempts: 0,
        remainingAttempts: maxAttempts,
      };
    }

    // Not locked
    return {
      allowed: true,
      attempts,
      remainingAttempts: maxAttempts - attempts,
    };
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);

    // Fail open (allow request) to prevent DoS via rate limiter errors
    const maxAttempts = await getRateLimitMaxAttempts();
    return {
      allowed: true,
      attempts: 0,
      remainingAttempts: maxAttempts,
    };
  }
}

/**
 * Record a failed authentication attempt
 *
 * @param ipAddress - Client IP address
 * @param token - Guest session token (optional)
 * @returns Promise<void>
 *
 * @example
 * await recordAttempt('192.168.1.1', 'abc123');
 */
export async function recordAttempt(ipAddress: string, token?: string): Promise<void> {
  const now = Date.now();
  const lockoutDuration = await getRateLimitLockoutDurationMs();
  const ttl = Math.floor((now + lockoutDuration) / 1000);

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: getTableName(),
        Item: {
          ipAddress,
          timestamp: now,
          token: token || 'unknown',
          ttl,
        },
      })
    );

    console.log('[RateLimiter] Recorded attempt:', {
      ipAddress,
      token,
      timestamp: new Date(now).toISOString(),
      ttl: new Date(ttl * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[RateLimiter] Error recording attempt:', error);
    // Don't throw - rate limiting is not critical enough to block authentication
  }
}

/**
 * Reset all attempts for an IP address (e.g., after successful authentication)
 *
 * @param ipAddress - Client IP address
 * @returns Promise<void>
 *
 * @example
 * await resetAttempts('192.168.1.1');
 */
export async function resetAttempts(ipAddress: string): Promise<void> {
  try {
    // Query all attempts for this IP
    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'ipAddress = :ip',
        ExpressionAttributeValues: {
          ':ip': ipAddress,
        },
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return;
    }

    // Batch delete all attempts
    const deleteRequests = result.Items.map(item => ({
      DeleteRequest: {
        Key: {
          ipAddress: item.ipAddress,
          timestamp: item.timestamp,
        },
      },
    }));

    // DynamoDB BatchWrite can handle max 25 items at a time
    const batches = [];
    for (let i = 0; i < deleteRequests.length; i += 25) {
      batches.push(deleteRequests.slice(i, i + 25));
    }

    for (const batch of batches) {
      await ddbDocClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [getTableName()]: batch,
          },
        })
      );
    }

    console.log(
      '[RateLimiter] Reset attempts for IP:',
      ipAddress,
      `(${result.Items.length} records deleted)`
    );
  } catch (error) {
    console.error('[RateLimiter] Error resetting attempts:', error);
    // Don't throw - rate limiting is not critical
  }
}

/**
 * Get rate limit statistics for an IP address
 *
 * @param ipAddress - Client IP address
 * @returns Rate limit statistics
 *
 * @example
 * const stats = await getRateLimitStats('192.168.1.1');
 * console.log(`Total attempts: ${stats.totalAttempts}`);
 */
export async function getRateLimitStats(ipAddress: string): Promise<{
  totalAttempts: number;
  recentAttempts: number;
  isLocked: boolean;
  lockedUntil?: Date;
}> {
  const now = Date.now();
  const attemptWindow = await getRateLimitAttemptWindowMs();
  const windowStart = now - attemptWindow;

  try {
    // Query all attempts
    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: 'ipAddress = :ip',
        ExpressionAttributeValues: {
          ':ip': ipAddress,
        },
      })
    );

    const totalAttempts = result.Items?.length || 0;
    const recentAttempts = result.Items?.filter(item => item.timestamp > windowStart).length || 0;

    const maxAttempts = await getRateLimitMaxAttempts();
    const isLocked = recentAttempts >= maxAttempts;
    let lockedUntil: Date | undefined;

    if (isLocked && result.Items && result.Items.length > 0) {
      const oldestRecentAttempt = result.Items.filter(item => item.timestamp > windowStart).sort(
        (a, b) => a.timestamp - b.timestamp
      )[0];

      if (oldestRecentAttempt) {
        const lockoutDuration = await getRateLimitLockoutDurationMs();
        lockedUntil = new Date(oldestRecentAttempt.timestamp + lockoutDuration);
      }
    }

    return {
      totalAttempts,
      recentAttempts,
      isLocked,
      lockedUntil,
    };
  } catch (error) {
    console.error('[RateLimiter] Error getting stats:', error);
    return {
      totalAttempts: 0,
      recentAttempts: 0,
      isLocked: false,
    };
  }
}

/**
 * Check if exponential backoff should be applied
 *
 * @param attempts - Number of failed attempts
 * @returns Suggested delay in milliseconds
 *
 * @example
 * const delay = getExponentialBackoff(3);
 * console.log(`Wait ${delay}ms before next attempt`);
 */
export function getExponentialBackoff(attempts: number): number {
  if (attempts <= 0) {
    return 0;
  }

  // Exponential backoff: 2^attempts seconds, capped at 60 seconds
  const seconds = Math.min(Math.pow(2, attempts), 60);
  return seconds * 1000;
}
