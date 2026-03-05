/**
 * Sessions API
 */

import { apiClient, ApiResponse } from './client';

export interface Session {
  id: string;
  scenarioId: string;
  avatarId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  scenario?: {
    id: string;
    title: string;
    description: string;
  };
  avatar?: {
    id: string;
    name: string;
    imageUrl: string;
  };
  recording?: {
    id: string;
    recordingUrl: string;
    thumbnailUrl: string;
    duration: number;
    fileSize: number;
    metadata: Record<string, unknown>;
  };
  transcript?: {
    id: string;
    segments: unknown[];
    summary: string | null;
    analysis: Record<string, unknown> | null;
  };
}

export interface CreateSessionRequest {
  scenarioId: string;
  avatarId: string;
  metadata?: Record<string, unknown>;
}

export interface ListSessionsRequest {
  limit?: number;
  offset?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
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
