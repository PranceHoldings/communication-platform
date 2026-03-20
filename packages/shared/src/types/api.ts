/**
 * Standard API Response Types
 *
 * SINGLE SOURCE OF TRUTH for API contracts
 * Used by both Frontend and Lambda functions
 *
 * CRITICAL: Any changes here affect BOTH caller and callee
 */

// ============================================================
// Standard Response Structure (ENFORCED)
// ============================================================

/**
 * Standard Success Response
 * ALL successful API responses MUST follow this structure
 */
export interface StandardSuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * Standard Error Response
 * ALL error responses MUST follow this structure
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
 * This is the ONLY valid response format
 */
export type StandardAPIResponse<T = any> = StandardSuccessResponse<T> | StandardErrorResponse;

// ============================================================
// Pagination Types
// ============================================================

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ============================================================
// Type Guards
// ============================================================

export function isSuccessResponse<T>(
  response: StandardAPIResponse<T>
): response is StandardSuccessResponse<T> {
  return response.success === true && 'data' in response;
}

export function isErrorResponse(
  response: StandardAPIResponse
): response is StandardErrorResponse {
  return response.success === false && 'error' in response;
}

// ============================================================
// API Client Helper Types
// ============================================================

/**
 * Type-safe API client response unwrapper
 * Throws error if response is not successful
 */
export function unwrapResponse<T>(response: StandardAPIResponse<T>): T {
  if (!isSuccessResponse(response)) {
    throw new Error(response.error?.message || 'Request failed');
  }
  return response.data;
}

/**
 * HTTP Methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API Endpoint Definition
 * Used for type-safe endpoint registry
 */
export interface APIEndpoint<TRequest = any, TResponse = any> {
  method: HttpMethod;
  path: string;
  requestType?: TRequest;
  responseType?: TResponse;
}
