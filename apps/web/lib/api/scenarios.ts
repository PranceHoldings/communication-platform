import { apiClient } from './client';

export interface Scenario {
  id: string;
  title: string;
  category: string;
  language: string;
  visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
  configJson: Record<string, unknown>;
  createdAt: string;
  userId: string;
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
  return apiClient<ScenarioListResponse>(url);
}

/**
 * Create a new scenario
 */
export async function createScenario(data: CreateScenarioRequest): Promise<Scenario> {
  return apiClient<Scenario>('/scenarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get scenario by ID
 */
export async function getScenario(id: string): Promise<Scenario> {
  return apiClient<Scenario>(`/scenarios/${id}`);
}
