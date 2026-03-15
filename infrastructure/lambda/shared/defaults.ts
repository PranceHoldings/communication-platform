/**
 * 組織設定・シナリオ設定のデフォルト値定義（Lambda用）
 *
 * 🔴 CRITICAL: このファイルは packages/shared/src/defaults.ts のコピーです
 * - 変更する場合は必ず両方のファイルを更新すること
 * - Lambda関数では @prance/shared を使用できないためコピーが必要
 *
 * SOURCE: packages/shared/src/defaults.ts
 */

import { OrganizationSettings } from './types/organization';

/**
 * 組織設定のデフォルト値
 */
export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  // AI Response Behavior
  enableSilencePrompt: true, // 無音時に会話を促す（デフォルト: 有効）
  silenceTimeout: 10, // 無音待機時間（秒）
  silencePromptTimeout: 15, // AI会話促し待機時間（秒、デフォルト: 15秒）
  silencePromptStyle: 'neutral', // 促し言葉のトーン
  showSilenceTimer: true, // UIに無音タイマーを表示（デフォルト: 表示）

  // Audio Detection Settings
  silenceThreshold: 0.12, // 音量閾値（0.01-0.2）
  minSilenceDuration: 500, // 最小無音継続時間（ms）
  // initialSilenceTimeout: DEPRECATED - 無音トリミング（ffmpeg silenceremove）で対応
};

/**
 * シナリオ設定のデフォルト値（null/undefined = 組織設定を使用）
 */
export const DEFAULT_SCENARIO_SETTINGS = {
  initialGreeting: undefined, // AI初回挨拶テキスト（undefined = 使用しない）
  silenceTimeout: undefined, // 無音タイマー（undefined = 組織設定を使用）
  silencePromptTimeout: undefined, // AI会話促し待機時間（undefined = 組織設定を使用）
  enableSilencePrompt: undefined, // 無音促し（undefined = 組織設定を使用）
  showSilenceTimer: undefined, // UIにタイマー表示（undefined = 組織設定を使用）
  silenceThreshold: undefined, // 音量閾値（undefined = 組織設定を使用）
  minSilenceDuration: undefined, // 最小無音継続時間（undefined = 組織設定を使用）
};

/**
 * バリデーション範囲
 */
export const VALIDATION_RANGES = {
  silenceTimeout: { min: 5, max: 60 }, // 秒
  silencePromptTimeout: { min: 5, max: 60 }, // 秒
  silenceThreshold: { min: 0.01, max: 0.2 }, // 音量
  minSilenceDuration: { min: 100, max: 2000 }, // ミリ秒
  // initialSilenceTimeout: DEPRECATED - 無音トリミング（ffmpeg silenceremove）で対応
};

/**
 * 許可される値
 */
export const ALLOWED_VALUES = {
  silencePromptStyle: ['formal', 'casual', 'neutral'] as const,
};
