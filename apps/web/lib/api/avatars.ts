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
  return apiClient<AvatarListResponse>(url);
}

/**
 * Create a new avatar
 */
export async function createAvatar(data: CreateAvatarRequest): Promise<Avatar> {
  return apiClient<Avatar>('/avatars', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get avatar by ID
 */
export async function getAvatar(id: string): Promise<Avatar> {
  return apiClient<Avatar>(`/avatars/${id}`);
}
