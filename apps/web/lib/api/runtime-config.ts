/**
 * Runtime Configuration API Client
 * Phase 5: Runtime Configuration Management System
 */

import { apiClient } from './client';

export type RuntimeConfigAccessLevel =
  | 'DEVELOPER_ONLY'
  | 'SUPER_ADMIN_READ_ONLY'
  | 'SUPER_ADMIN_READ_WRITE'
  | 'CLIENT_ADMIN_READ_WRITE'
  | 'CLIENT_ADMIN_READ_ONLY';

export interface RuntimeConfig {
  key: string;
  value: any;
  dataType: 'NUMBER' | 'STRING' | 'BOOLEAN' | 'JSON';
  category: 'QUERY_PROCESSING' | 'AI_PROCESSING' | 'AUDIO_PROCESSING' | 'SCORE_CALCULATION' | 'SECURITY' | 'SYSTEM';
  accessLevel: RuntimeConfigAccessLevel;
  defaultValue: any;
  minValue: number | null;
  maxValue: number | null;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface RuntimeConfigHistory {
  id: string;
  key: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: string;
  reason: string | null;
  ipAddress: string | null;
}

export interface GetRuntimeConfigsResponse {
  data: {
    configs: RuntimeConfig[];
    groupedByCategory: Record<string, RuntimeConfig[]>;
    total: number;
  };
}

export interface GetRuntimeConfigResponse {
  data: RuntimeConfig;
}

export interface UpdateRuntimeConfigRequest {
  value: any;
  reason?: string;
}

export interface UpdateRuntimeConfigResponse {
  data: RuntimeConfig;
  message: string;
}

export interface GetRuntimeConfigHistoryResponse {
  data: {
    history: RuntimeConfigHistory[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

export interface RollbackRuntimeConfigRequest {
  historyId: string;
  reason?: string;
}

export interface RollbackRuntimeConfigResponse {
  data: RuntimeConfig;
  message: string;
  rolledBackFrom: {
    historyId: string;
    changedAt: string;
    changedBy: string;
  };
}

/**
 * Get all runtime configurations
 */
export async function getRuntimeConfigs(category?: string): Promise<GetRuntimeConfigsResponse> {
  const params = category ? { category } : undefined;
  return apiClient.get('/admin/runtime-config', { params });
}

/**
 * Get runtime configuration by key
 */
export async function getRuntimeConfig(key: string): Promise<GetRuntimeConfigResponse> {
  return apiClient.get(`/admin/runtime-config/${key}`);
}

/**
 * Update runtime configuration
 */
export async function updateRuntimeConfig(
  key: string,
  data: UpdateRuntimeConfigRequest
): Promise<UpdateRuntimeConfigResponse> {
  return apiClient.put(`/admin/runtime-config/${key}`, data);
}

/**
 * Get runtime configuration change history
 */
export async function getRuntimeConfigHistory(
  key: string,
  params?: { limit?: number; offset?: number }
): Promise<GetRuntimeConfigHistoryResponse> {
  return apiClient.get(`/admin/runtime-config/${key}/history`, { params });
}

/**
 * Rollback runtime configuration to previous value
 */
export async function rollbackRuntimeConfig(
  key: string,
  data: RollbackRuntimeConfigRequest
): Promise<RollbackRuntimeConfigResponse> {
  return apiClient.post(`/admin/runtime-config/${key}/rollback`, data);
}
