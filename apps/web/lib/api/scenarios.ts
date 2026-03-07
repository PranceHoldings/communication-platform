import { apiClient } from './client';
import { buildQueryString } from './utils';
import type { Visibility, PaginationMeta } from '@prance/shared';

export interface Scenario {
  id: string;
  title: string;
  category: string;
  language: string;
  visibility: Visibility;
  configJson: Record<string, unknown>;
  createdAt: string;
  userId: string | null;
  orgId: string;
}

export interface ScenarioListResponse {
  scenarios: Scenario[];
  pagination: PaginationMeta;
}

export interface CreateScenarioRequest {
  title: string;
  category: string;
  configJson: Record<string, unknown>;
  language?: string;
  visibility?: Visibility;
}

export interface UpdateScenarioRequest {
  title?: string;
  category?: string;
  configJson?: Record<string, unknown>;
  language?: string;
  visibility?: Visibility;
}

/**
 * Get list of scenarios
 */
export async function listScenarios(params?: {
  limit?: number;
  offset?: number;
  category?: string;
  visibility?: Visibility;
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
