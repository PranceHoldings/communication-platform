/**
 * Retry Utility Functions
 * Provides exponential backoff retry logic for API calls
 */

export interface RetryOptions {
  maxAttempts?: number; // Maximum number of retry attempts (default: 3)
  initialDelay?: number; // Initial delay in milliseconds (default: 1000)
  maxDelay?: number; // Maximum delay in milliseconds (default: 10000)
  backoffFactor?: number; // Exponential backoff factor (default: 2)
  retryableErrors?: string[]; // List of retryable error codes/messages
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalDelay: number;
}

/**
 * Default retryable HTTP status codes
 */
export const RETRYABLE_HTTP_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Default retryable error patterns
 */
export const RETRYABLE_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /ENETUNREACH/i,
  /throttl/i,
  /rate limit/i,
  /too many requests/i,
];

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error | any, retryableErrors?: string[]): boolean {
  // Check HTTP status code
  if (error.statusCode && RETRYABLE_HTTP_CODES.includes(error.statusCode)) {
    return true;
  }

  // Check response status
  if (error.response?.status && RETRYABLE_HTTP_CODES.includes(error.response.status)) {
    return true;
  }

  // Check error message against patterns
  const errorMessage = error.message || String(error);
  for (const pattern of RETRYABLE_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return true;
    }
  }

  // Check custom retryable errors
  if (retryableErrors) {
    for (const retryableError of retryableErrors) {
      if (errorMessage.includes(retryableError)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number
): number {
  const delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns Promise with result and retry metadata
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryableErrors,
    onRetry,
  } = options;

  let lastError: Error | null = null;
  let totalDelay = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        result,
        attempts: attempt,
        totalDelay,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(lastError, retryableErrors)) {
        console.error('[Retry] Non-retryable error:', {
          error: lastError.message,
          attempt,
          maxAttempts,
        });
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt >= maxAttempts) {
        console.error('[Retry] Max attempts reached:', {
          error: lastError.message,
          attempts: attempt,
          totalDelay,
        });
        throw lastError;
      }

      // Calculate delay and wait
      const delay = calculateBackoffDelay(attempt, initialDelay, maxDelay, backoffFactor);
      totalDelay += delay;

      console.warn('[Retry] Attempt failed, retrying:', {
        error: lastError.message,
        attempt,
        maxAttempts,
        nextAttemptIn: delay,
        totalDelay,
      });

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Retry failed');
}

/**
 * Retry a function with simple retry logic (no backoff)
 *
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum number of attempts
 * @returns Promise with result
 */
export async function retry<T>(fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
  const result = await retryWithBackoff(fn, {
    maxAttempts,
    initialDelay: 1000,
    maxDelay: 1000, // No exponential backoff
    backoffFactor: 1,
  });
  return result.result;
}

/**
 * Create a retryable version of an async function
 *
 * @param fn - Async function to make retryable
 * @param options - Retry options
 * @returns Retryable function
 */
export function makeRetryable<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: RetryOptions = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const result = await retryWithBackoff(() => fn(...args), options);
    return result.result;
  };
}

/**
 * Retry decorator (for class methods)
 * Note: TypeScript decorators are experimental
 */
export function Retryable(options: RetryOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await retryWithBackoff(() => originalMethod.apply(this, args), options);
      return result.result;
    };

    return descriptor;
  };
}
