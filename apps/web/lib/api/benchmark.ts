import { apiClient } from './client';
import type {
  BenchmarkData,
  SessionHistoryItem,
  UserAttributes,
  StandardAPIResponse,
} from '@prance/shared';

export interface GetBenchmarkRequest {
  scenarioId: string;
  userScore: {
    overallScore?: number;
    emotionScore?: number;
    audioScore?: number;
    contentScore?: number;
    deliveryScore?: number;
  };
  userAttributes?: UserAttributes;
}

export interface UpdateSessionHistoryRequest {
  sessionId: string;
}

/**
 * ベンチマークデータを取得
 *
 * ユーザーのスコアを同条件の他ユーザーと比較
 *
 * @param request - ベンチマークリクエスト
 * @returns ベンチマークデータ
 */
export async function getBenchmark(
  request: GetBenchmarkRequest
): Promise<StandardAPIResponse<BenchmarkData>> {
  return apiClient.post<BenchmarkData>('/benchmark', request);
}

/**
 * セッション履歴を更新
 *
 * セッション完了時に呼び出し、履歴とベンチマークキャッシュを更新
 *
 * @param request - 更新リクエスト
 * @returns void
 */
export async function updateSessionHistory(
  request: UpdateSessionHistoryRequest
): Promise<StandardAPIResponse<void>> {
  return apiClient.post<void>('/benchmark/update-history', request);
}

/**
 * ユーザーのセッション履歴を取得
 *
 * 成長トラッキングに使用
 *
 * @param userId - ユーザーID
 * @param scenarioId - シナリオID（オプション）
 * @returns セッション履歴配列
 */
export async function getSessionHistory(
  userId: string,
  scenarioId?: string
): Promise<StandardAPIResponse<SessionHistoryItem[]>> {
  const endpoint = scenarioId
    ? `/users/${userId}/session-history?scenarioId=${scenarioId}`
    : `/users/${userId}/session-history`;
  return apiClient.get<SessionHistoryItem[]>(endpoint);
}
