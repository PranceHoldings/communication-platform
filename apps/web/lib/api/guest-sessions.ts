import { apiClient } from './client';
import { buildQueryString } from './utils';
import type { PaginationMeta } from '@prance/shared';

export type GuestSessionStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'REVOKED';

export interface GuestSession {
  id: string;
  orgId: string;
  creatorUserId: string;
  sessionId?: string;
  scenarioId: string;
  avatarId?: string;
  token: string;
  guestName?: string;
  guestEmail?: string;
  guestMetadata?: Record<string, unknown>;
  status: GuestSessionStatus;
  validFrom: string;
  validUntil: string;
  accessCount: number;
  failedAttempts: number;
  lockedUntil?: string;
  firstAccessedAt?: string;
  completedAt?: string;
  dataRetentionDays?: number;
  autoDeleteAt?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  scenario?: {
    id: string;
    title: string;
  };
  avatar?: {
    id: string;
    name: string;
  };
  creator?: {
    id: string;
    name: string;
  };
  session?: {
    id: string;
    status: string;
  };
}

export interface GuestSessionLog {
  id: string;
  guestSessionId: string;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface GuestSessionListResponse {
  guestSessions: GuestSession[];
  pagination: PaginationMeta;
}

export interface CreateGuestSessionRequest {
  scenarioId: string;
  avatarId?: string;
  guestName?: string;
  guestEmail?: string;
  guestMetadata?: Record<string, unknown>;
  validUntil: string;
  dataRetentionDays?: number;
  pinCode?: string; // Optional custom PIN
}

export interface CreateGuestSessionResponse {
  guestSession: {
    id: string;
    token: string;
    pinCode: string; // Only in response, not stored
    inviteUrl: string;
    status: GuestSessionStatus;
    validFrom: string;
    validUntil: string;
    createdAt: string;
  };
}

export interface BatchCreateGuestSessionRequest {
  sessions: CreateGuestSessionRequest[];
}

export interface BatchCreateGuestSessionResponse {
  results: Array<{
    success: boolean;
    guestSession?: CreateGuestSessionResponse['guestSession'];
    error?: string;
    index: number;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface UpdateGuestSessionRequest {
  guestName?: string;
  guestEmail?: string;
  guestMetadata?: Record<string, unknown>;
  validUntil?: string;
  status?: GuestSessionStatus;
  dataRetentionDays?: number;
}

export interface GuestSessionLogsResponse {
  logs: GuestSessionLog[];
  pagination: PaginationMeta;
}

/**
 * Get list of guest sessions
 */
export async function listGuestSessions(params?: {
  limit?: number;
  offset?: number;
  status?: GuestSessionStatus;
  scenarioId?: string;
  guestEmail?: string;
  sortBy?: 'createdAt' | 'validUntil' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
}): Promise<GuestSessionListResponse> {
  const url = `/guest-sessions${buildQueryString(params)}`;
  const response = await apiClient.get<GuestSessionListResponse>(url);
  return apiClient.unwrapResponse(response);
}

/**
 * Create a new guest session
 */
export async function createGuestSession(
  data: CreateGuestSessionRequest
): Promise<CreateGuestSessionResponse> {
  const response = await apiClient.post<CreateGuestSessionResponse>('/guest-sessions', data);
  return apiClient.unwrapResponse(response);
}

/**
 * Batch create guest sessions
 */
export async function batchCreateGuestSessions(
  data: BatchCreateGuestSessionRequest
): Promise<BatchCreateGuestSessionResponse> {
  const response = await apiClient.post<BatchCreateGuestSessionResponse>(
    '/guest-sessions/batch',
    data
  );
  return apiClient.unwrapResponse(response);
}

/**
 * Get guest session by ID
 */
export async function getGuestSession(id: string): Promise<GuestSession> {
  const response = await apiClient.get<{ guestSession: GuestSession }>(`/guest-sessions/${id}`);
  const data = apiClient.unwrapResponse(response);
  return data.guestSession;
}

/**
 * Update guest session
 */
export async function updateGuestSession(
  id: string,
  data: UpdateGuestSessionRequest
): Promise<GuestSession> {
  const response = await apiClient.patch<{ guestSession: GuestSession }>(
    `/guest-sessions/${id}`,
    data
  );
  const result = apiClient.unwrapResponse(response);
  return result.guestSession;
}

/**
 * Delete (revoke) guest session
 */
export async function deleteGuestSession(id: string): Promise<void> {
  const response = await apiClient.delete(`/guest-sessions/${id}`);
  apiClient.unwrapResponse(response);
}

/**
 * Complete guest session
 */
export async function completeGuestSession(id: string): Promise<void> {
  const response = await apiClient.post(`/guest-sessions/${id}/complete`, {});
  apiClient.unwrapResponse(response);
}

/**
 * Get guest session logs
 */
export async function getGuestSessionLogs(
  id: string,
  params?: {
    limit?: number;
    offset?: number;
    eventType?: string;
  }
): Promise<GuestSessionLogsResponse> {
  const url = `/guest-sessions/${id}/logs${buildQueryString(params)}`;
  const response = await apiClient.get<GuestSessionLogsResponse>(url);
  return apiClient.unwrapResponse(response);
}

/**
 * Verify guest token (before PIN authentication)
 */
export async function verifyGuestToken(token: string): Promise<{
  valid: boolean;
  reason?: string;
  scenarioTitle?: string;
  avatarName?: string;
  validUntil?: string;
  organizationName?: string;
}> {
  const response = await apiClient.get<{
    valid: boolean;
    reason?: string;
    scenarioTitle?: string;
    avatarName?: string;
    validUntil?: string;
    organizationName?: string;
  }>(`/guest/verify/${token}`);
  return apiClient.unwrapResponse(response);
}

/**
 * Authenticate guest with PIN
 */
export async function authenticateGuest(token: string, pinCode: string): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
  remainingAttempts?: number;
  lockedUntil?: string;
}> {
  const response = await apiClient.post<{
    success: boolean;
    accessToken?: string;
    error?: string;
    remainingAttempts?: number;
    lockedUntil?: string;
  }>('/guest/auth', {
    token,
    pinCode,
  });
  return apiClient.unwrapResponse(response);
}

/**
 * Get guest session data (requires guest JWT)
 */
export async function getGuestSessionData(): Promise<{
  session: any; // TODO: Type this properly
  scenario: any;
  avatar: any;
  guestSession: GuestSession;
}> {
  const response = await apiClient.get<{
    session: any;
    scenario: any;
    avatar: any;
    guestSession: GuestSession;
  }>('/guest/session-data');
  return apiClient.unwrapResponse(response);
}
