/**
 * API Endpoints Type Registry
 *
 * SINGLE SOURCE OF TRUTH for all API endpoint contracts
 *
 * CRITICAL:
 * - Frontend API calls MUST reference these types
 * - Lambda functions MUST implement these types
 * - Any mismatch will cause TypeScript compilation error
 *
 * Usage (Frontend):
 *   const response = await apiClient.get<GuestSessionListResponse>('/guest-sessions');
 *
 * Usage (Lambda):
 *   const handler = async (): Promise<StandardLambdaResponse<GuestSessionListResponse>> => {
 *     return successResponse({ guestSessions, pagination });
 *   };
 */

import type {
  StandardAPIResponse,
  PaginationMeta,
} from './api';

// ============================================================
// Authentication Endpoints
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    orgId: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  orgName: string;
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    orgId: string;
  };
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    orgId: string;
  };
}

// ============================================================
// Guest Sessions Endpoints
// ============================================================

export interface GuestSessionListItem {
  id: string;
  token: string;
  status: string;
  guestName: string | null;
  guestEmail: string | null;
  validFrom: string;
  validUntil: string;
  accessCount: number;
  failedAttempts: number;
  firstAccessedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
  scenario: {
    id: string;
    title: string;
    category: string;
  };
  avatar: {
    id: string;
    name: string;
    thumbnailUrl: string | null;
  } | null;
  session: {
    id: string;
    status: string;
  } | null;
}

export interface GuestSessionListResponse {
  guestSessions: GuestSessionListItem[];
  pagination: PaginationMeta;
}

export interface GuestSessionDetailResponse {
  guestSession: GuestSessionListItem;
}

export interface GuestSessionCreateRequest {
  scenarioId: string;
  avatarId?: string;
  guestName?: string;
  guestEmail?: string;
  validUntil: string;
  maxAccessCount?: number;
}

export interface GuestSessionCreateResponse {
  guestSession: GuestSessionListItem;
  accessUrl: string;
}

// ============================================================
// Scenarios Endpoints
// ============================================================

export interface ScenarioListItem {
  id: string;
  title: string;
  description: string | null;
  language: string;
  category: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioListResponse {
  scenarios: ScenarioListItem[];
  pagination: PaginationMeta;
}

export interface ScenarioDetailResponse {
  scenario: ScenarioListItem & {
    conversationFlow: any;
    systemPrompt: string | null;
  };
}

// ============================================================
// Type-safe API Endpoint Registry
// ============================================================

/**
 * Endpoint definitions with full type safety
 * Use this to ensure caller and callee are always in sync
 */
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: {
    method: 'POST' as const,
    path: '/auth/login',
    requestType: {} as LoginRequest,
    responseType: {} as LoginResponse,
  },
  REGISTER: {
    method: 'POST' as const,
    path: '/auth/register',
    requestType: {} as RegisterRequest,
    responseType: {} as RegisterResponse,
  },
  ME: {
    method: 'GET' as const,
    path: '/users/me',
    responseType: {} as MeResponse,
  },

  // Guest Sessions
  LIST_GUEST_SESSIONS: {
    method: 'GET' as const,
    path: '/guest-sessions',
    responseType: {} as GuestSessionListResponse,
  },
  GET_GUEST_SESSION: {
    method: 'GET' as const,
    path: '/guest-sessions/:id',
    responseType: {} as GuestSessionDetailResponse,
  },
  CREATE_GUEST_SESSION: {
    method: 'POST' as const,
    path: '/guest-sessions',
    requestType: {} as GuestSessionCreateRequest,
    responseType: {} as GuestSessionCreateResponse,
  },

  // Scenarios
  LIST_SCENARIOS: {
    method: 'GET' as const,
    path: '/scenarios',
    responseType: {} as ScenarioListResponse,
  },
  GET_SCENARIO: {
    method: 'GET' as const,
    path: '/scenarios/:id',
    responseType: {} as ScenarioDetailResponse,
  },
} as const;

/**
 * Helper type to extract response type from endpoint definition
 */
export type EndpointResponseType<T extends keyof typeof API_ENDPOINTS> =
  typeof API_ENDPOINTS[T]['responseType'];

/**
 * Helper type to extract request type from endpoint definition
 */
export type EndpointRequestType<T extends keyof typeof API_ENDPOINTS> =
  typeof API_ENDPOINTS[T]['requestType'];
