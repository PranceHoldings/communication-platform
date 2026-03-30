/**
 * Runtime Schema Validation using Zod
 *
 * OPTIONAL: For stricter runtime validation
 * Use this when you need to validate actual data structure at runtime
 *
 * Installation required:
 *   npm install zod
 */

// Uncomment when zod is installed
// import { z } from 'zod';

/**
 * Example: Guest Session Schema
 */
/*
export const GuestSessionSchema = z.object({
  id: z.string().uuid(),
  token: z.string(),
  status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED']),
  guestName: z.string().nullable(),
  guestEmail: z.string().email().nullable(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  accessCount: z.number().int().min(0),
  failedAttempts: z.number().int().min(0),
  firstAccessedAt: z.string().datetime().nullable(),
  lastAccessedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  scenario: z.object({
    id: z.string().uuid(),
    title: z.string(),
    category: z.string(),
  }),
  avatar: z.object({
    id: z.string().uuid(),
    name: z.string(),
    thumbnailUrl: z.string().url().nullable(),
  }).nullable(),
  session: z.object({
    id: z.string().uuid(),
    status: z.string(),
  }).nullable(),
});

export const GuestSessionListResponseSchema = z.object({
  guestSessions: z.array(GuestSessionSchema),
  pagination: z.object({
    total: z.number().int().min(0),
    limit: z.number().int().min(1).max(100),
    offset: z.number().int().min(0),
    hasMore: z.boolean(),
  }),
});

// Usage in Lambda function:
export const handler = async (): Promise<StandardLambdaResponse<GuestSessionListResponse>> => {
  const result = {
    guestSessions: [...],
    pagination: { ... }
  };

  // Validate at runtime (development only)
  if (process.env.ENVIRONMENT === 'dev') {
    GuestSessionListResponseSchema.parse(result);  // Throws if invalid
  }

  return successResponse(result);
};
*/

export const SCHEMAS_NOT_YET_IMPLEMENTED = true;

/**
 * Benefits of Zod:
 * - Validates actual data structure at runtime
 * - Checks field types (string, number, etc.)
 * - Validates formats (email, UUID, datetime)
 * - Provides detailed error messages
 *
 * Cost:
 * - Runtime overhead (minimal in dev mode)
 * - Additional dependency
 * - Schema definition maintenance
 *
 * Recommendation:
 * - Use for critical endpoints (payment, user data, etc.)
 * - Skip for simple CRUD endpoints
 * - Always use in development mode
 */
