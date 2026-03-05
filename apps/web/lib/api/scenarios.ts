import { apiClient } from './client';
import { buildQueryString } from './utils';

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
  const url = `/scenarios${buildQueryString(params)}`;
  const response = await apiClient.get<ScenarioListResponse>(url);
  return apiClient.unwrapResponse(response);
}

/**
 * Create a new scenario
 */
export async function createScenario(data: CreateScenarioRequest): Promise<Scenario> {
  const response = await apiClient.post<Scenario>('/scenarios', data);
  return apiClient.unwrapResponse(response);
}

/**
 * Get scenario by ID
 */
export async function getScenario(id: string): Promise<Scenario> {
  const response = await apiClient.get<Scenario>(`/scenarios/${id}`);
  return apiClient.unwrapResponse(response);
}

/**
 * Update an existing scenario
 */
export async function updateScenario(id: string, data: UpdateScenarioRequest): Promise<Scenario> {
  const response = await apiClient.put<Scenario>(`/scenarios/${id}`, data);
  return apiClient.unwrapResponse(response);
}

/**
 * Delete a scenario
 */
export async function deleteScenario(id: string): Promise<void> {
  const response = await apiClient.delete<{ message: string; id: string }>(`/scenarios/${id}`);
  apiClient.unwrapVoidResponse(response);
}
