import { apiClient } from './client';
import { buildQueryString } from './utils';
import type {
  AvatarType,
  AvatarStyle,
  AvatarSource,
  Visibility,
  PaginationMeta,
} from '@prance/shared';

export interface Avatar {
  id: string;
  name: string;
  type: AvatarType;
  style: AvatarStyle;
  source: AvatarSource;
  modelUrl: string;
  thumbnailUrl: string | null;
  tags: string[];
  visibility: Visibility;
  allowCloning: boolean;
  createdAt: string;
  userId: string | null;
  orgId: string;
}

export interface AvatarListResponse {
  avatars: Avatar[];
  pagination: PaginationMeta;
}

export interface CreateAvatarRequest {
  name: string;
  type: AvatarType;
  style: AvatarStyle;
  source: AvatarSource;
  modelUrl: string;
  thumbnailUrl?: string;
  configJson?: Record<string, unknown>;
  tags?: string[];
  visibility?: Visibility;
  allowCloning?: boolean;
}

export interface UpdateAvatarRequest {
  name?: string;
  type?: AvatarType;
  style?: AvatarStyle;
  source?: AvatarSource;
  modelUrl?: string;
  thumbnailUrl?: string;
  configJson?: Record<string, unknown>;
  tags?: string[];
  visibility?: Visibility;
  allowCloning?: boolean;
}

/**
 * Get list of avatars
 */
export async function listAvatars(params?: {
  limit?: number;
  offset?: number;
  type?: AvatarType;
  style?: AvatarStyle;
  source?: AvatarSource;
  visibility?: Visibility;
}): Promise<AvatarListResponse> {
  const url = `/avatars${buildQueryString(params)}`;
  const response = await apiClient.get<AvatarListResponse>(url);
  return apiClient.unwrapResponse(response);
}

/**
 * Create a new avatar
 */
export async function createAvatar(data: CreateAvatarRequest): Promise<Avatar> {
  const response = await apiClient.post<Avatar>('/avatars', data);

  return apiClient.unwrapResponse(response);
}

/**
 * Get avatar by ID
 */
export async function getAvatar(id: string): Promise<Avatar> {
  const response = await apiClient.get<Avatar>(`/avatars/${id}`);

  return apiClient.unwrapResponse(response);
}

/**
 * Update an existing avatar
 */
export async function updateAvatar(id: string, data: UpdateAvatarRequest): Promise<Avatar> {
  const response = await apiClient.put<Avatar>(`/avatars/${id}`, data);

  return apiClient.unwrapResponse(response);
}

/**
 * Delete an avatar
 */
export async function deleteAvatar(id: string): Promise<void> {
  const response = await apiClient.delete<{ message: string; id: string }>(`/avatars/${id}`);

  apiClient.unwrapVoidResponse(response);
}

/**
 * Clone a public avatar to user's organization
 */
export async function cloneAvatar(id: string): Promise<Avatar> {
  const response = await apiClient.post<{ avatar: Avatar; sourceAvatarId: string }>(
    `/avatars/${id}/clone`,
    {}
  );

  return apiClient.unwrapResponse(response).avatar;
}
