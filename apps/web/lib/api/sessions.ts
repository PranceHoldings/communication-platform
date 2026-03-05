/**
 * Sessions API
 */

import { apiClient, ApiResponse } from './client';

export interface Session {
  id: string;
  scenarioId: string;
  avatarId: string;
  status: 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  scenario?: {
    id: string;
    title: string;
    category: string;
  };
  avatar?: {
    id: string;
    name: string;
    type?: string;
    imageUrl?: string;
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
    speaker: 'AI' | 'USER';
    text: string;
    timestampStart: number;
    timestampEnd: number;
    confidence: number | null;
    highlight: 'POSITIVE' | 'NEGATIVE' | 'IMPORTANT' | null;
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
  status?: 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
}

export interface ListSessionsResponse {
  sessions: Session[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export const sessionsApi = {
  /**
   * セッション一覧を取得
   */
  async list(params?: ListSessionsRequest): Promise<ApiResponse<ListSessionsResponse>> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());
    if (params?.status) query.append('status', params.status);

    const endpoint = `/sessions${query.toString() ? `?${query.toString()}` : ''}`;
    return apiClient.get<ListSessionsResponse>(endpoint);
  },

  /**
   * セッションを作成
   */
  async create(data: CreateSessionRequest): Promise<ApiResponse<Session>> {
    return apiClient.post<Session>('/sessions', data);
  },

  /**
   * セッション詳細を取得
   */
  async get(id: string): Promise<ApiResponse<Session>> {
    return apiClient.get<Session>(`/sessions/${id}`);
  },

  /**
   * セッションを更新（将来実装）
   */
  async update(id: string, data: Partial<Session>): Promise<ApiResponse<Session>> {
    return apiClient.put<Session>(`/sessions/${id}`, data);
  },

  /**
   * セッションを削除（将来実装）
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/sessions/${id}`);
  },
};
