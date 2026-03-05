import { apiClient } from './client';

export interface Scenario {
  id: string;
  title: string;
  category: string;
  language: string;
  visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
  configJson: Record<string, unknown>;
  createdAt: string;
  userId: string | null; // Optional - Prismaスキーマでは userId? (任意)
  orgId: string;
}

export interface ScenarioListResponse {
  scenarios: Scenario[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CreateScenarioRequest {
  title: string;
  category: string;
  configJson: Record<string, unknown>;
  language?: string;
  visibility?: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
}

export interface UpdateScenarioRequest {
  title?: string;
  category?: string;
  configJson?: Record<string, unknown>;
  language?: string;
  visibility?: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
}

/**
 * Get list of scenarios
 */
export async function listScenarios(params?: {
  limit?: number;
  offset?: number;
  category?: string;
  visibility?: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
}): Promise<ScenarioListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());
  if (params?.category) queryParams.set('category', params.category);
  if (params?.visibility) queryParams.set('visibility', params.visibility);

  const url = `/scenarios${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<ScenarioListResponse>(url);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to fetch scenarios');
  }

  return response.data;
}

/**
 * Create a new scenario
 */
export async function createScenario(data: CreateScenarioRequest): Promise<Scenario> {
  const response = await apiClient.post<Scenario>('/scenarios', data);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to create scenario');
  }

  return response.data;
}

/**
 * Get scenario by ID
 */
export async function getScenario(id: string): Promise<Scenario> {
  const response = await apiClient.get<Scenario>(`/scenarios/${id}`);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to fetch scenario');
  }

  return response.data;
}

/**
 * Update an existing scenario
 */
export async function updateScenario(id: string, data: UpdateScenarioRequest): Promise<Scenario> {
  const response = await apiClient.put<Scenario>(`/scenarios/${id}`, data);

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Failed to update scenario');
  }

  return response.data;
}

/**
 * Delete a scenario
 */
export async function deleteScenario(id: string): Promise<void> {
  const response = await apiClient.delete<{ message: string; id: string }>(`/scenarios/${id}`);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to delete scenario');
  }
}
