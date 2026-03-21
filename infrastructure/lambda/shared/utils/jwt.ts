/**
 * JWT Verification Utilities
 * Used for verifying tokens from API Gateway authorizer
 */

export interface JWTPayload {
  sub: string;        // User ID
  email: string;
  role: string;       // UserRole
  orgId: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify JWT token from API Gateway event
 * In our architecture, API Gateway Lambda Authorizer validates the token,
 * so this function extracts the payload from the requestContext
 */
export function verifyToken(event: any): JWTPayload {
  // Extract user information from API Gateway authorizer context
  const authorizer = event.requestContext?.authorizer;

  if (!authorizer) {
    throw new Error('No authorizer context found');
  }

  // API Gateway authorizer stores user information in these fields
  const payload: JWTPayload = {
    sub: authorizer.sub || authorizer.userId,
    email: authorizer.email,
    role: authorizer.role,
    orgId: authorizer.orgId,
  };

  if (!payload.sub || !payload.email || !payload.role || !payload.orgId) {
    throw new Error('Invalid or incomplete JWT payload');
  }

  return payload;
}

/**
 * Extract user ID from event
 */
export function getUserId(event: any): string {
  const payload = verifyToken(event);
  return payload.sub;
}

/**
 * Extract user role from event
 */
export function getUserRole(event: any): string {
  const payload = verifyToken(event);
  return payload.role;
}

/**
 * Extract organization ID from event
 */
export function getOrgId(event: any): string {
  const payload = verifyToken(event);
  return payload.orgId;
}

/**
 * Check if user has required role
 */
export function hasRole(event: any, requiredRole: string | string[]): boolean {
  const payload = verifyToken(event);
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(payload.role);
}
