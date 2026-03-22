/**
 * Scenario Validation Module (Day 36)
 *
 * シナリオ実行前の検証ロジック
 * - 必須フィールドチェック
 * - 推奨設定チェック（警告）
 */

import type { Scenario, ScenarioValidation, ValidationError, ValidationWarning } from '@prance/shared';

// 有効な言語コード（10言語）
const VALID_LANGUAGES = [
  'en', 'ja', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it'
] as const;

/**
 * シナリオバリデーション
 *
 * @param scenario - 検証対象のシナリオ
 * @returns ScenarioValidation - 検証結果（エラー・警告）
 */
export function validateScenario(scenario: Scenario): ScenarioValidation {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // ========================================
  // 必須フィールドチェック
  // ========================================

  // タイトル
  if (!scenario.title || scenario.title.trim() === '') {
    errors.push({
      field: 'title',
      code: 'TITLE_REQUIRED',
      message: 'Scenario title is required',
    });
  } else if (scenario.title.length > 200) {
    errors.push({
      field: 'title',
      code: 'TITLE_TOO_LONG',
      message: 'Scenario title must be 200 characters or less',
    });
  }

  // 言語
  if (!scenario.language) {
    errors.push({
      field: 'language',
      code: 'LANGUAGE_REQUIRED',
      message: 'Scenario language is required',
    });
  } else if (!VALID_LANGUAGES.includes(scenario.language as any)) {
    errors.push({
      field: 'language',
      code: 'LANGUAGE_INVALID',
      message: `Invalid language code: ${scenario.language}. Must be one of: ${VALID_LANGUAGES.join(', ')}`,
    });
  }

  // システムプロンプト
  const config = scenario.configJson as any;
  const systemPrompt = config?.systemPrompt;

  if (!systemPrompt || systemPrompt.trim() === '') {
    errors.push({
      field: 'systemPrompt',
      code: 'SYSTEM_PROMPT_REQUIRED',
      message: 'System prompt is required',
    });
  } else {
    // システムプロンプト文字数チェック
    if (systemPrompt.length < 20) {
      errors.push({
        field: 'systemPrompt',
        code: 'SYSTEM_PROMPT_TOO_SHORT',
        message: 'System prompt must be at least 20 characters',
      });
    }

    if (systemPrompt.length > 5000) {
      errors.push({
        field: 'systemPrompt',
        code: 'SYSTEM_PROMPT_TOO_LONG',
        message: 'System prompt must be 5000 characters or less',
      });
    }
  }

  // ========================================
  // 推奨設定チェック（警告）
  // ========================================

  // 初回挨拶
  if (!scenario.initialGreeting || scenario.initialGreeting.trim() === '') {
    warnings.push({
      field: 'initialGreeting',
      code: 'INITIAL_GREETING_MISSING',
      message: 'Initial greeting is not set. AI will wait for user to speak first.',
      severity: 'medium',
    });
  }

  // 無音タイムアウト
  if (scenario.silenceTimeout && scenario.silenceTimeout < 5) {
    warnings.push({
      field: 'silenceTimeout',
      code: 'SILENCE_TIMEOUT_TOO_SHORT',
      message: `Silence timeout is very short (${scenario.silenceTimeout}s). Consider increasing it to at least 5 seconds.`,
      severity: 'medium',
    });
  }

  // システムプロンプト長さ（警告レベル）
  if (systemPrompt && systemPrompt.length > 2000) {
    warnings.push({
      field: 'systemPrompt',
      code: 'SYSTEM_PROMPT_VERY_LONG',
      message: `System prompt is very long (${systemPrompt.length} chars). This may affect AI response quality and latency.`,
      severity: 'low',
    });
  }

  if (systemPrompt && systemPrompt.length < 50) {
    warnings.push({
      field: 'systemPrompt',
      code: 'SYSTEM_PROMPT_VERY_SHORT',
      message: `System prompt is very short (${systemPrompt.length} chars). Consider adding more context for better AI responses.`,
      severity: 'low',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * エラーメッセージのフォーマット（ユーザー表示用）
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map(e => `• ${e.message}`).join('\n');
}

/**
 * 警告メッセージのフォーマット（ユーザー表示用）
 */
export function formatValidationWarnings(warnings: ValidationWarning[]): string {
  return warnings.map(w => `• ${w.message}`).join('\n');
}
