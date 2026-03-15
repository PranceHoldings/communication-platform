/**
 * Organization Settings API Client
 * AI & Audio グローバル設定の取得・更新
 */

import { apiClient } from './client';
import type { OrganizationSettings } from '@prance/shared';

/**
 * 組織設定を取得
 * Cache busting: 常に最新の設定を取得するため、タイムスタンプをクエリパラメータに追加
 */
export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  // キャッシュバスティング: 毎回異なるURLを生成してブラウザキャッシュをバイパス
  const timestamp = Date.now();
  const response = await apiClient.get<OrganizationSettings>(
    `/organizations/settings?_t=${timestamp}`
  );
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
