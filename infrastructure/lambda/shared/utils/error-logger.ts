/**
 * Error Logger
 * Enhanced error logging for CloudWatch Logs monitoring
 */

export interface ErrorContext {
  functionName?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  errorCode?: string;
  [key: string]: any;
}

export interface ErrorLogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context?: ErrorContext;
}

/**
 * Log error with structured format for CloudWatch Logs
 */
export function logError(message: string, error: Error | any, context?: ErrorContext): void {
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    message,
    error: {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack,
      code: error.code || error.statusCode,
    },
    context,
  };

  // Log as JSON for CloudWatch Logs Insights queries
  console.error(JSON.stringify(logEntry));
}

/**
 * Log warning with structured format
 */
export function logWarning(message: string, details?: any, context?: ErrorContext): void {
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    message,
    context: {
      ...context,
      details,
    },
  };

  console.warn(JSON.stringify(logEntry));
}

/**
 * Log info with structured format
 */
export function logInfo(message: string, details?: any, context?: ErrorContext): void {
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message,
    context: {
      ...context,
      details,
    },
  };

  console.log(JSON.stringify(logEntry));
}

/**
 * Create error context from Lambda event
 */
export function createErrorContext(event: any): ErrorContext {
  return {
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    requestId: event.requestContext?.requestId,
    connectionId: event.requestContext?.connectionId,
    routeKey: event.requestContext?.routeKey,
  };
}

/**
 * Create error response for API Gateway
 */
export function createErrorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
  details?: any
): any {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: {
        code: errorCode,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Wrap async function with error logging
 */
export function withErrorLogging<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  functionName: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(`${functionName} failed`, error, {
        functionName,
      });
      throw error;
    }
  };
}

/**
 * Sample CloudWatch Logs Insights queries
 */
export const CLOUDWATCH_QUERIES = {
  // Find all errors in the last hour
  allErrors: `
fields @timestamp, level, message, error.message, error.code, context.sessionId
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
`,

  // Find errors by error code
  errorsByCode: `
fields @timestamp, error.message, context.sessionId, context.userId
| filter level = "ERROR" and error.code = "SPECIFIC_CODE"
| sort @timestamp desc
`,

  // Find retried requests
  retriedRequests: `
fields @timestamp, message, context.sessionId
| filter message like /Retrying/
| stats count() by context.sessionId
`,

  // Find timeout errors
  timeoutErrors: `
fields @timestamp, error.message, context.sessionId
| filter error.message like /timeout/i
| sort @timestamp desc
`,

  // Find rate limit errors
  rateLimitErrors: `
fields @timestamp, error.message, context.sessionId
| filter error.code in ["429", "ThrottlingException"]
| stats count() by bin(5m)
`,

  // Error rate per minute
  errorRate: `
fields @timestamp
| filter level = "ERROR"
| stats count() as errorCount by bin(1m)
`,
};
