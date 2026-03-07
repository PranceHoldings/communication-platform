/**
 * Sessions API
 *
 * 注意: このファイルの型定義はAPIレスポンスの形式に基づいています。
 * Lambda関数が以下のマッピングを行っています:
 * - durationSec → duration
 * - metadataJson → metadata
 * - startedAt → createdAt (互換性のため)
 * - thumbnailUrl → imageUrl (Avatar)
 */

import { apiClient } from './client';
import { buildQueryString } from './utils';
import type { SessionStatus, PaginationMeta, Speaker, Highlight } from '@prance/shared';

export interface Session {
  id: string;
  scenarioId: string;
  avatarId: string;
  status: SessionStatus;
  startedAt: string; // セッション開始日時
  endedAt: string | null; // セッション終了日時
  duration: number | null; // 所要時間（秒）- DBでは durationSec
  metadata: Record<string, unknown>; // セッションメタデータ - DBでは metadataJson
  createdAt: string; // startedAtのエイリアス（互換性のため）
  scenario?: {
    id: string;
    title: string;
    category: string;
  };
  avatar?: {
    id: string;
    name: string;
    type?: string;
    imageUrl?: string; // thumbnailUrlのエイリアス（互換性のため）
    thumbnailUrl?: string;
    modelUrl?: string;
  };
  recordings?: Array<{
    id: string;
    type: string;
    s3Url: string;
    cdnUrl: string | null;
    thumbnailUrl: string | null;
    fileSizeBytes: number;
    createdAt: string;
  }>;
  transcripts?: Array<{
    id: string;
    speaker: Speaker;
    text: string;
    timestampStart: number;
    timestampEnd: number;
    confidence: number | null;
    highlight: Highlight | null;
  }>;
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

// Backward compatibility - オブジェクト形式のエクスポートも維持
export const sessionsApi = {
  list: listSessions,
  create: createSession,
  get: getSession,
  update: updateSession,
  delete: deleteSession,
};
