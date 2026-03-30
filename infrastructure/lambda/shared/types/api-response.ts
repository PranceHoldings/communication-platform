/**
 * Standard API Response Types (ENFORCED)
 *
 * ALL Lambda functions MUST use these types.
 * Direct response construction is FORBIDDEN.
 */

import { APIGatewayProxyResult } from 'aws-lambda';

/**
 * Standard Success Response Structure
 * ENFORCED: { success: true, data: T }
 */
export interface StandardSuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * Standard Error Response Structure
 * ENFORCED: { success: false, error: { code, message, details? } }
 */
export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Union type for all API responses
 */
export type StandardAPIResponse<T = any> = StandardSuccessResponse<T> | StandardErrorResponse;

/**
 * Lambda Function Return Type (ENFORCED)
 *
 * Use this as return type for ALL Lambda handlers:
 * export const handler = async (event): Promise<StandardLambdaResponse<MyDataType>> => {
 *   return successResponse(data);
 * };
 */
export interface StandardLambdaResponse<T = any> extends APIGatewayProxyResult {
  body: string; // JSON.stringify(StandardAPIResponse<T>)
}

/**
 * Type guard to validate response structure at runtime
 */
export function isStandardSuccessResponse<T>(response: any): response is StandardSuccessResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    response.success === true &&
    'data' in response
  );
}

export function isStandardErrorResponse(response: any): response is StandardErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    response.success === false &&
    'error' in response &&
    typeof response.error === 'object' &&
    'code' in response.error &&
    'message' in response.error
  );
}

export function isStandardAPIResponse<T>(response: any): response is StandardAPIResponse<T> {
  return isStandardSuccessResponse<T>(response) || isStandardErrorResponse(response);
}

/**
 * Runtime validator (throws error in dev mode if structure is invalid)
 */
export function validateResponseStructure<T>(response: any): StandardAPIResponse<T> {
  if (!isStandardAPIResponse<T>(response)) {
    const error = new Error(
      `INVALID API RESPONSE STRUCTURE:\n` +
      `Expected: { success: boolean, data?: any, error?: { code, message } }\n` +
      `Received: ${JSON.stringify(response, null, 2)}\n\n` +
      `FIX: Use successResponse() or errorResponse() from shared/utils/response.ts`
    );

    // Always throw in development
    if (process.env.ENVIRONMENT === 'dev' || process.env.NODE_ENV === 'development') {
      throw error;
    }

    // Log error in production but don't crash
    console.error('[CRITICAL] Invalid API response structure:', error.message);
  }

  return response as StandardAPIResponse<T>;
}
