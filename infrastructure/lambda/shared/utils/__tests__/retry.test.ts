/**
 * Retry Utility Tests
 * Unit tests for retry logic with exponential backoff
 */

import {
  retryWithBackoff,
  retry,
  isRetryableError,
  calculateBackoffDelay,
  RETRYABLE_HTTP_CODES,
} from '../retry';

describe('Retry Utility', () => {
  describe('isRetryableError', () => {
    it('should identify retryable HTTP status codes', () => {
      const error408 = { statusCode: 408 };
      const error429 = { statusCode: 429 };
      const error500 = { statusCode: 500 };
      const error502 = { statusCode: 502 };
      const error503 = { statusCode: 503 };
      const error504 = { statusCode: 504 };

      expect(isRetryableError(error408)).toBe(true);
      expect(isRetryableError(error429)).toBe(true);
      expect(isRetryableError(error500)).toBe(true);
      expect(isRetryableError(error502)).toBe(true);
      expect(isRetryableError(error503)).toBe(true);
      expect(isRetryableError(error504)).toBe(true);
    });

    it('should identify non-retryable HTTP status codes', () => {
      const error400 = { statusCode: 400 };
      const error401 = { statusCode: 401 };
      const error403 = { statusCode: 403 };
      const error404 = { statusCode: 404 };

      expect(isRetryableError(error400)).toBe(false);
      expect(isRetryableError(error401)).toBe(false);
      expect(isRetryableError(error403)).toBe(false);
      expect(isRetryableError(error404)).toBe(false);
    });

    it('should identify retryable error messages', () => {
      const timeoutError = new Error('Request timeout');
      const connectionError = new Error('ECONNRESET');
      const throttleError = new Error('ThrottlingException');
      const rateLimitError = new Error('Rate limit exceeded');

      expect(isRetryableError(timeoutError)).toBe(true);
      expect(isRetryableError(connectionError)).toBe(true);
      expect(isRetryableError(throttleError)).toBe(true);
      expect(isRetryableError(rateLimitError)).toBe(true);
    });

    it('should identify non-retryable error messages', () => {
      const validationError = new Error('Invalid input');
      const authError = new Error('Unauthorized');

      expect(isRetryableError(validationError)).toBe(false);
      expect(isRetryableError(authError)).toBe(false);
    });

    it('should use custom retryable errors', () => {
      const customError = new Error('CustomRetryableError');
      const retryableErrors = ['CustomRetryableError'];

      expect(isRetryableError(customError, retryableErrors)).toBe(true);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      expect(calculateBackoffDelay(1, 1000, 10000, 2)).toBe(1000); // 1000 * 2^0 = 1000
      expect(calculateBackoffDelay(2, 1000, 10000, 2)).toBe(2000); // 1000 * 2^1 = 2000
      expect(calculateBackoffDelay(3, 1000, 10000, 2)).toBe(4000); // 1000 * 2^2 = 4000
      expect(calculateBackoffDelay(4, 1000, 10000, 2)).toBe(8000); // 1000 * 2^3 = 8000
    });

    it('should respect max delay', () => {
      expect(calculateBackoffDelay(5, 1000, 10000, 2)).toBe(10000); // 1000 * 2^4 = 16000, capped at 10000
      expect(calculateBackoffDelay(10, 1000, 5000, 2)).toBe(5000); // Very large, capped at 5000
    });

    it('should handle different backoff factors', () => {
      expect(calculateBackoffDelay(2, 1000, 10000, 3)).toBe(3000); // 1000 * 3^1 = 3000
      expect(calculateBackoffDelay(3, 1000, 10000, 3)).toBe(9000); // 1000 * 3^2 = 9000
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const successFn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(successFn, { maxAttempts: 3 });

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalDelay).toBe(0);
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and eventually succeed', async () => {
      const retryableFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(retryableFn, {
        maxAttempts: 3,
        initialDelay: 10, // Short delay for testing
      });

      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
      expect(result.totalDelay).toBeGreaterThan(0);
      expect(retryableFn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts', async () => {
      const alwaysFailFn = jest.fn().mockRejectedValue(new Error('timeout'));

      await expect(
        retryWithBackoff(alwaysFailFn, {
          maxAttempts: 3,
          initialDelay: 10,
        })
      ).rejects.toThrow('timeout');

      expect(alwaysFailFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable error', async () => {
      const nonRetryableFn = jest.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(
        retryWithBackoff(nonRetryableFn, {
          maxAttempts: 3,
          initialDelay: 10,
        })
      ).rejects.toThrow('Invalid input');

      expect(nonRetryableFn).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const retryableFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      await retryWithBackoff(retryableFn, {
        maxAttempts: 3,
        initialDelay: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1, // attempt
        expect.any(Number) // delay
      );
    });

    it('should handle custom retryable errors', async () => {
      const customErrorFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('CustomError'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(customErrorFn, {
        maxAttempts: 3,
        initialDelay: 10,
        retryableErrors: ['CustomError'],
      });

      expect(result.result).toBe('success');
      expect(customErrorFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry (simple wrapper)', () => {
    it('should retry with default options', async () => {
      const retryableFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      const result = await retry(retryableFn, 3);

      expect(result).toBe('success');
      expect(retryableFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle 0 max attempts (should throw immediately)', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('error'));

      await expect(
        retryWithBackoff(fn, { maxAttempts: 0 })
      ).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(0);
    });

    it('should handle errors without message', async () => {
      const errorWithoutMessage = { code: 503 };
      const fn = jest.fn().mockRejectedValue(errorWithoutMessage);

      // Non-retryable because no message/statusCode matches
      await expect(
        retryWithBackoff(fn, {
          maxAttempts: 2,
          initialDelay: 10,
        })
      ).rejects.toEqual(errorWithoutMessage);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
