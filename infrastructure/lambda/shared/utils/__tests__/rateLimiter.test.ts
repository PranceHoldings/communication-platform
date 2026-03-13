/**
 * Rate Limiter Utility Tests
 *
 * @jest-environment node
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import {
  checkRateLimit,
  recordAttempt,
  resetAttempts,
  getRateLimitStats,
  getExponentialBackoff,
} from '../rateLimiter';

// Mock DynamoDB Document Client
const ddbMock = mockClient(DynamoDBDocumentClient);

describe('rateLimiter', () => {
  beforeEach(() => {
    ddbMock.reset();
    // Set environment variable before importing the module
    process.env.AWS_REGION = 'us-east-1';
    process.env.ENVIRONMENT = 'test';
    process.env.GUEST_RATE_LIMIT_TABLE = 'prance-guest-rate-limits-test';
    process.env.RATE_LIMIT_MAX_ATTEMPTS = '5';
    process.env.RATE_LIMIT_LOCKOUT_DURATION = '600000'; // 10 minutes
    process.env.RATE_LIMIT_ATTEMPT_WINDOW = '600000'; // 10 minutes
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow request when no previous attempts', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0,
      });

      const result = await checkRateLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(0);
      expect(result.remainingAttempts).toBe(5);
      expect(result.lockedUntil).toBeUndefined();
    });

    it('should track number of attempts', async () => {
      const now = Date.now();
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { ipAddress: '192.168.1.1', timestamp: now - 60000, token: 'abc123' },
          { ipAddress: '192.168.1.1', timestamp: now - 120000, token: 'abc123' },
        ],
        Count: 2,
      });

      const result = await checkRateLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.remainingAttempts).toBe(3);
    });

    it('should block request when max attempts exceeded', async () => {
      const now = Date.now();
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { ipAddress: '192.168.1.1', timestamp: now - 60000 },
          { ipAddress: '192.168.1.1', timestamp: now - 120000 },
          { ipAddress: '192.168.1.1', timestamp: now - 180000 },
          { ipAddress: '192.168.1.1', timestamp: now - 240000 },
          { ipAddress: '192.168.1.1', timestamp: now - 300000 },
        ],
        Count: 5,
      });

      const result = await checkRateLimit('192.168.1.1');

      expect(result.allowed).toBe(false);
      expect(result.attempts).toBe(5);
      expect(result.remainingAttempts).toBe(0);
      expect(result.lockedUntil).toBeDefined();
      expect(result.lockedUntil!.getTime()).toBeGreaterThan(now);
    });

    it('should reset after lockout period expires', async () => {
      const now = Date.now();
      const expiredAttempt = now - 700000; // 11.67 minutes ago (expired)

      ddbMock.on(QueryCommand).resolves({
        Items: [
          { ipAddress: '192.168.1.1', timestamp: expiredAttempt },
          { ipAddress: '192.168.1.1', timestamp: expiredAttempt - 60000 },
          { ipAddress: '192.168.1.1', timestamp: expiredAttempt - 120000 },
          { ipAddress: '192.168.1.1', timestamp: expiredAttempt - 180000 },
          { ipAddress: '192.168.1.1', timestamp: expiredAttempt - 240000 },
        ],
        Count: 5,
      });

      // Mock resetAttempts calls
      ddbMock.on(BatchWriteCommand).resolves({});

      const result = await checkRateLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(0);
      expect(result.remainingAttempts).toBe(5);
    });

    it('should fail open on DynamoDB error', async () => {
      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const result = await checkRateLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(0);
      expect(result.remainingAttempts).toBe(5);
    });

    it('should support token-specific rate limiting', async () => {
      const now = Date.now();
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { ipAddress: '192.168.1.1', timestamp: now - 60000, token: 'abc123' },
        ],
        Count: 1,
      });

      const result = await checkRateLimit('192.168.1.1', 'abc123');

      expect(result.allowed).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.remainingAttempts).toBe(4);
    });
  });

  describe('recordAttempt', () => {
    it('should record failed attempt with IP and token', async () => {
      ddbMock.on(PutCommand).resolves({});

      await recordAttempt('192.168.1.1', 'abc123');

      expect(ddbMock.calls()).toHaveLength(1);
      const call = ddbMock.call(0);
      expect(call.args[0].input).toMatchObject({
        TableName: 'prance-guest-rate-limits-test',
        Item: {
          ipAddress: '192.168.1.1',
          token: 'abc123',
        },
      });
      expect(call.args[0].input.Item.timestamp).toBeDefined();
      expect(call.args[0].input.Item.ttl).toBeDefined();
    });

    it('should record attempt without token', async () => {
      ddbMock.on(PutCommand).resolves({});

      await recordAttempt('192.168.1.1');

      expect(ddbMock.calls()).toHaveLength(1);
      const call = ddbMock.call(0);
      expect(call.args[0].input.Item.token).toBe('unknown');
    });

    it('should not throw on DynamoDB error', async () => {
      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

      await expect(recordAttempt('192.168.1.1', 'abc123')).resolves.not.toThrow();
    });

    it('should set TTL for automatic cleanup', async () => {
      ddbMock.on(PutCommand).resolves({});

      const beforeTime = Date.now();
      await recordAttempt('192.168.1.1', 'abc123');
      const afterTime = Date.now();

      const call = ddbMock.call(0);
      const ttl = call.args[0].input.Item.ttl;
      const ttlMs = ttl * 1000;

      // TTL should be ~10 minutes in the future
      // Note: Math.floor truncates, so allow some tolerance
      expect(ttlMs).toBeGreaterThanOrEqual(beforeTime + 599000); // -1s tolerance for truncation
      expect(ttlMs).toBeLessThanOrEqual(afterTime + 600000 + 1000); // +1s tolerance
    });
  });

  describe('resetAttempts', () => {
    it('should delete all attempts for an IP', async () => {
      const now = Date.now();
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { ipAddress: '192.168.1.1', timestamp: now - 60000 },
          { ipAddress: '192.168.1.1', timestamp: now - 120000 },
          { ipAddress: '192.168.1.1', timestamp: now - 180000 },
        ],
        Count: 3,
      });

      ddbMock.on(BatchWriteCommand).resolves({});

      await resetAttempts('192.168.1.1');

      expect(ddbMock.calls()).toHaveLength(2); // 1 Query + 1 BatchWrite
      const batchCall = ddbMock.commandCalls(BatchWriteCommand)[0];
      expect(batchCall.args[0].input.RequestItems['prance-guest-rate-limits-test']).toHaveLength(3);
    });

    it('should handle empty results', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0,
      });

      await resetAttempts('192.168.1.1');

      expect(ddbMock.calls()).toHaveLength(1); // Only Query, no BatchWrite
    });

    it('should batch delete requests in chunks of 25', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        ipAddress: '192.168.1.1',
        timestamp: Date.now() - i * 60000,
      }));

      ddbMock.on(QueryCommand).resolves({
        Items: items,
        Count: 50,
      });

      ddbMock.on(BatchWriteCommand).resolves({});

      await resetAttempts('192.168.1.1');

      // Should have 1 Query + 2 BatchWrites (50 items / 25 per batch)
      expect(ddbMock.calls()).toHaveLength(3);
      expect(ddbMock.commandCalls(BatchWriteCommand)).toHaveLength(2);
    });

    it('should not throw on DynamoDB error', async () => {
      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      await expect(resetAttempts('192.168.1.1')).resolves.not.toThrow();
    });
  });

  describe('getRateLimitStats', () => {
    it('should return statistics for an IP', async () => {
      const now = Date.now();
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { ipAddress: '192.168.1.1', timestamp: now - 60000 },
          { ipAddress: '192.168.1.1', timestamp: now - 120000 },
          { ipAddress: '192.168.1.1', timestamp: now - 700000 }, // Outside window
        ],
        Count: 3,
      });

      const stats = await getRateLimitStats('192.168.1.1');

      expect(stats.totalAttempts).toBe(3);
      expect(stats.recentAttempts).toBe(2);
      expect(stats.isLocked).toBe(false);
      expect(stats.lockedUntil).toBeUndefined();
    });

    it('should indicate locked status', async () => {
      const now = Date.now();
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { ipAddress: '192.168.1.1', timestamp: now - 60000 },
          { ipAddress: '192.168.1.1', timestamp: now - 120000 },
          { ipAddress: '192.168.1.1', timestamp: now - 180000 },
          { ipAddress: '192.168.1.1', timestamp: now - 240000 },
          { ipAddress: '192.168.1.1', timestamp: now - 300000 },
        ],
        Count: 5,
      });

      const stats = await getRateLimitStats('192.168.1.1');

      expect(stats.totalAttempts).toBe(5);
      expect(stats.recentAttempts).toBe(5);
      expect(stats.isLocked).toBe(true);
      expect(stats.lockedUntil).toBeDefined();
    });

    it('should return zeros on DynamoDB error', async () => {
      ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const stats = await getRateLimitStats('192.168.1.1');

      expect(stats.totalAttempts).toBe(0);
      expect(stats.recentAttempts).toBe(0);
      expect(stats.isLocked).toBe(false);
    });
  });

  describe('getExponentialBackoff', () => {
    it('should return 0 for 0 attempts', () => {
      expect(getExponentialBackoff(0)).toBe(0);
    });

    it('should calculate exponential backoff', () => {
      expect(getExponentialBackoff(1)).toBe(2000); // 2^1 = 2 seconds
      expect(getExponentialBackoff(2)).toBe(4000); // 2^2 = 4 seconds
      expect(getExponentialBackoff(3)).toBe(8000); // 2^3 = 8 seconds
      expect(getExponentialBackoff(4)).toBe(16000); // 2^4 = 16 seconds
      expect(getExponentialBackoff(5)).toBe(32000); // 2^5 = 32 seconds
    });

    it('should cap at 60 seconds', () => {
      expect(getExponentialBackoff(6)).toBe(60000); // 2^6 = 64, capped at 60
      expect(getExponentialBackoff(10)).toBe(60000); // 2^10 = 1024, capped at 60
    });

    it('should handle negative attempts', () => {
      expect(getExponentialBackoff(-1)).toBe(0);
      expect(getExponentialBackoff(-10)).toBe(0);
    });
  });
});
