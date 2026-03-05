import { apiClient } from './client';

export interface Avatar {
  id: string;
  name: string;
  type: 'TWO_D' | 'THREE_D';
  style: 'ANIME' | 'REALISTIC';
  source: 'PRESET' | 'GENERATED' | 'ORG_CUSTOM';
  modelUrl: string;
  thumbnailUrl: string | null;
  tags: string[];
  visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
  allowCloning: boolean;
  createdAt: string;
  userId: string | null;
  orgId: string;
}

export interface AvatarListResponse {
  avatars: Avatar[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CreateAvatarRequest {
  name: string;
  type: 'TWO_D' | 'THREE_D';
  style: 'ANIME' | 'REALISTIC';
  source: 'PRESET' | 'GENERATED' | 'ORG_CUSTOM';
  modelUrl: string;
  thumbnailUrl?: string;
  configJson?: Record<string, unknown>;
  tags?: string[];
  visibility?: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
  allowCloning?: boolean;
}

export interface UpdateAvatarRequest {
  name?: string;
  type?: 'TWO_D' | 'THREE_D';
  style?: 'ANIME' | 'REALISTIC';
  source?: 'PRESET' | 'GENERATED' | 'ORG_CUSTOM';
  modelUrl?: string;
  thumbnailUrl?: string;
  configJson?: Record<string, unknown>;
  tags?: string[];
  visibility?: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
  allowCloning?: boolean;
}

/**
 * Get list of avatars
 */
export async function listAvatars(params?: {
  limit?: number;
  offset?: number;
  type?: 'TWO_D' | 'THREE_D';
  style?: 'ANIME' | 'REALISTIC';
  source?: 'PRESET' | 'GENERATED' | 'ORG_CUSTOM';
  visibility?: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
}): Promise<AvatarListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());
  if (params?.type) queryParams.set('type', params.type);
  if (params?.style) queryParams.set('style', params.style);
  if (params?.source) queryParams.set('source', params.source);
  if (params?.visibility) queryParams.set('visibility', params.visibility);

  const url = `/avatars${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<AvatarListResponse>(url);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to fetch avatars');
  }

  return response.data;
}

/**
 * Create a new avatar
 */
export async function createAvatar(data: CreateAvatarRequest): Promise<Avatar> {
  const response = await apiClient.post<Avatar>('/avatars', data);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to create avatar');
  }

  return response.data;
}

/**
 * Get avatar by ID
 */
export async function getAvatar(id: string): Promise<Avatar> {
  const response = await apiClient.get<Avatar>(`/avatars/${id}`);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to fetch avatar');
  }

  return response.data;
}

/**
 * Update an existing avatar
 */
export async function updateAvatar(id: string, data: UpdateAvatarRequest): Promise<Avatar> {
  const response = await apiClient.put<Avatar>(`/avatars/${id}`, data);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to update avatar');
  }

  return response.data;
}

/**
 * Delete an avatar
 */
export async function deleteAvatar(id: string): Promise<void> {
  const response = await apiClient.delete<{ message: string; id: string }>(`/avatars/${id}`);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to delete avatar');
  }
}

/**
 * Clone a public avatar to user's organization
 */
export async function cloneAvatar(id: string): Promise<Avatar> {
  const response = await apiClient.post<{ avatar: Avatar; sourceAvatarId: string }>(
    `/avatars/${id}/clone`,
    {}
  );

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to clone avatar');
  }

  return response.data.avatar;
}
