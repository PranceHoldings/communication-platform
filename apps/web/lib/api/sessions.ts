/**
 * Sessions API
 *
 * Note: Uses Prisma schema field names directly (Schema-First principle)
 * Date types are converted to strings for JSON serialization
 */

import { apiClient } from './client';
import { buildQueryString } from './utils';
import type {
  SessionStatus,
  PaginationMeta,
  Recording as SharedRecording,
  Transcript as SharedTranscript,
} from '@prance/shared';

// API response types (Date -> string conversion for JSON)
export type RecordingResponse = Omit<SharedRecording, 'createdAt' | 'processedAt'> & {
  createdAt: string;
  processedAt?: string;
};

export type TranscriptResponse = Omit<SharedTranscript, 'createdAt'> & {
  createdAt?: string;
};

export interface Session {
  id: string;
  scenarioId: string;
  avatarId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null; // Prisma schema field name
  metadataJson: Record<string, unknown> | null; // Prisma schema field name
  scenario?: {
    id: string;
    title: string;
    category: string;
  };
  avatar?: {
    id: string;
    name: string;
    type?: string;
    thumbnailUrl?: string;
    modelUrl?: string;
  };
  recordings?: RecordingResponse[];
  transcripts?: TranscriptResponse[];
}

export interface CreateSessionRequest {
  scenarioId: string;
  avatarId: string;
  metadata?: Record<string, unknown>;
}

export interface ListSessionsRequest {
  limit?: number;
  offset?: number;
  status?: SessionStatus;
}

export interface ListSessionsResponse {
  sessions: Session[];
  pagination: PaginationMeta;
}

/**
 * セッション一覧を取得
 */
export async function listSessions(params?: ListSessionsRequest): Promise<ListSessionsResponse> {
  const endpoint = `/sessions${buildQueryString(
    params as Record<string, string | number | boolean | undefined | null>
  )}`;
  const response = await apiClient.get<ListSessionsResponse>(endpoint);
  return apiClient.unwrapResponse(response);
}

/**
 * セッションを作成
 */
export async function createSession(data: CreateSessionRequest): Promise<Session> {
  const response = await apiClient.post<Session>('/sessions', data);

  return apiClient.unwrapResponse(response);
}

/**
 * セッション詳細を取得
 */
export async function getSession(id: string): Promise<Session> {
  const response = await apiClient.get<Session>(`/sessions/${id}`);

  return apiClient.unwrapResponse(response);
}

/**
 * セッションを更新（将来実装）
 */
export async function updateSession(id: string, data: Partial<Session>): Promise<Session> {
  const response = await apiClient.put<Session>(`/sessions/${id}`, data);

  return apiClient.unwrapResponse(response);
}

/**
 * セッションを削除（将来実装）
 */
export async function deleteSession(id: string): Promise<void> {
  const response = await apiClient.delete<void>(`/sessions/${id}`);

  apiClient.unwrapVoidResponse(response);
}

/**
 * セッションを強制終了（WebSocket切断時のフォールバック）
 */
export async function endSession(id: string): Promise<{ id: string; status: string; durationSec?: number }> {
  const response = await apiClient.put<{ id: string; status: string; durationSec?: number }>(`/sessions/${id}/end`, {});
  return apiClient.unwrapResponse(response);
}

// Backward compatibility - オブジェクト形式のエクスポートも維持
export const sessionsApi = {
  list: listSessions,
  create: createSession,
  get: getSession,
  update: updateSession,
  delete: deleteSession,
  end: endSession,
};
