/**
 * Organization Settings API Client
 * AI & Audio グローバル設定の取得・更新
 */

import { apiClient } from './client';
import type { OrganizationSettings } from '@prance/shared';

/**
 * 組織設定を取得
 */
export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  const response = await apiClient.get<OrganizationSettings>('/organizations/settings');
  return apiClient.unwrapResponse(response);
}

/**
 * 組織設定を更新
 */
export async function updateOrganizationSettings(
  settings: Partial<OrganizationSettings>
): Promise<OrganizationSettings> {
  const response = await apiClient.put<OrganizationSettings>('/organizations/settings', settings);
  return apiClient.unwrapResponse(response);
}
