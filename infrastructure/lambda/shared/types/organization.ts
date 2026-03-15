/**
 * 組織設定型定義（Lambda用）
 *
 * SOURCE: packages/shared/src/types/index.ts (OrganizationSettings)
 */

/**
 * 組織の設定（AI & Audio のグローバルデフォルト）
 */
export interface OrganizationSettings {
  // AI Response Behavior
  enableSilencePrompt?: boolean; // 無音時に会話を促す
  silenceTimeout?: number; // 無音待機時間（秒）
  silencePromptTimeout?: number; // AI会話促し待機時間（秒、5-60秒）
  silencePromptStyle?: 'formal' | 'casual' | 'neutral'; // 促し言葉のトーン
  showSilenceTimer?: boolean; // UIに無音タイマーを表示

  // Audio Detection Settings
  silenceThreshold?: number; // 音量閾値（0.01-0.2）
  minSilenceDuration?: number; // 最小無音継続時間（ms）
  initialSilenceTimeout?: number; // Azure STT初期無音タイムアウト（ms、3000-15000推奨）
}
