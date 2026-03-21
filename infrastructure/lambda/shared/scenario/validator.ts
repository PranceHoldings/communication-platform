/**
 * Scenario Validator
 * Phase 1.6.1 Day 35: バリデーション・エラーリカバリー
 *
 * シナリオ実行前のバリデーションとエラー検出
 */

import { getRequiredEnv } from '../utils/env-validator';

const MIN_PROMPT_LENGTH = parseInt(getRequiredEnv('MIN_PROMPT_LENGTH'), 10);
const MAX_PROMPT_LENGTH = parseInt(getRequiredEnv('MAX_PROMPT_LENGTH'), 10);

export interface ScenarioValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ScenarioValidationResult {
  isValid: boolean;
  errors: ScenarioValidationError[];
  warnings: ScenarioValidationError[];
}

export interface ScenarioConfig {
  title?: string;
  systemPrompt?: string;
  language?: string;
  initialGreeting?: string;
  conversationFlow?: unknown;
}

/**
 * Validate scenario configuration before execution
 */
export function validateScenario(scenario: ScenarioConfig): ScenarioValidationResult {
  const errors: ScenarioValidationError[] = [];
  const warnings: ScenarioValidationError[] = [];

  // Required fields validation
  if (!scenario.title || scenario.title.trim().length === 0) {
    errors.push({
      field: 'title',
      message: 'Scenario title is required',
      severity: 'error',
    });
  }

  if (!scenario.systemPrompt || scenario.systemPrompt.trim().length === 0) {
    errors.push({
      field: 'systemPrompt',
      message: 'System prompt is required for AI conversation',
      severity: 'error',
    });
  } else {
    // Validate prompt length
    const promptLength = scenario.systemPrompt.trim().length;

    if (promptLength < MIN_PROMPT_LENGTH) {
      warnings.push({
        field: 'systemPrompt',
        message: `System prompt is too short (${promptLength} chars). Recommended: ${MIN_PROMPT_LENGTH}+ chars`,
        severity: 'warning',
      });
    }

    if (promptLength > MAX_PROMPT_LENGTH) {
      errors.push({
        field: 'systemPrompt',
        message: `System prompt is too long (${promptLength} chars). Maximum: ${MAX_PROMPT_LENGTH} chars`,
        severity: 'error',
      });
    }
  }

  if (!scenario.language) {
    warnings.push({
      field: 'language',
      message: 'Language not specified. Default language will be used',
      severity: 'warning',
    });
  } else {
    // Validate language code
    const validLanguages = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it'];
    if (!validLanguages.includes(scenario.language)) {
      errors.push({
        field: 'language',
        message: `Invalid language code: ${scenario.language}. Must be one of: ${validLanguages.join(', ')}`,
        severity: 'error',
      });
    }
  }

  // Recommended settings validation
  if (!scenario.initialGreeting || scenario.initialGreeting.trim().length === 0) {
    warnings.push({
      field: 'initialGreeting',
      message: 'Initial greeting not set. AI will start without greeting',
      severity: 'warning',
    });
  }

  // Check for potential infinite loop patterns in conversationFlow
  if (scenario.conversationFlow) {
    try {
      const flowStr = JSON.stringify(scenario.conversationFlow);

      // Check for circular references (basic check)
      if (flowStr.includes('"type":"loop"') && !flowStr.includes('"maxIterations"')) {
        warnings.push({
          field: 'conversationFlow',
          message: 'Loop detected without maxIterations limit. May cause infinite loop',
          severity: 'warning',
        });
      }
    } catch (error) {
      errors.push({
        field: 'conversationFlow',
        message: 'Invalid conversation flow structure',
        severity: 'error',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate scenario execution state
 */
export interface ScenarioExecutionState {
  sessionId: string;
  turnCount: number;
  conversationHistory: Array<{ role: string; content: string }>;
  startTime: number;
}

export function validateExecutionState(
  state: ScenarioExecutionState
): ScenarioValidationResult {
  const errors: ScenarioValidationError[] = [];
  const warnings: ScenarioValidationError[] = [];

  const MAX_TURNS = parseInt(getRequiredEnv('MAX_CONVERSATION_TURNS'), 10);
  const MAX_SESSION_DURATION_MS = parseInt(getRequiredEnv('MAX_SESSION_DURATION_SEC'), 10) * 1000;

  // Check turn count (infinite loop prevention)
  if (state.turnCount >= MAX_TURNS) {
    errors.push({
      field: 'turnCount',
      message: `Maximum conversation turns exceeded (${state.turnCount}/${MAX_TURNS})`,
      severity: 'error',
    });
  } else if (state.turnCount >= MAX_TURNS * 0.8) {
    warnings.push({
      field: 'turnCount',
      message: `Approaching maximum conversation turns (${state.turnCount}/${MAX_TURNS})`,
      severity: 'warning',
    });
  }

  // Check session duration
  const currentTime = Date.now();
  const elapsedTime = currentTime - state.startTime;

  if (elapsedTime >= MAX_SESSION_DURATION_MS) {
    errors.push({
      field: 'duration',
      message: `Maximum session duration exceeded (${Math.floor(elapsedTime / 1000)}s)`,
      severity: 'error',
    });
  } else if (elapsedTime >= MAX_SESSION_DURATION_MS * 0.8) {
    warnings.push({
      field: 'duration',
      message: `Approaching maximum session duration (${Math.floor(elapsedTime / 1000)}s)`,
      severity: 'warning',
    });
  }

  // Check conversation history size
  const historySize = state.conversationHistory.length;
  const MAX_HISTORY_SIZE = MAX_TURNS * 2; // user + assistant per turn

  if (historySize > MAX_HISTORY_SIZE) {
    errors.push({
      field: 'conversationHistory',
      message: `Conversation history too large (${historySize} messages)`,
      severity: 'error',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ScenarioValidationResult): string {
  const messages: string[] = [];

  if (result.errors.length > 0) {
    messages.push('Errors:');
    result.errors.forEach(error => {
      messages.push(`  - ${error.field}: ${error.message}`);
    });
  }

  if (result.warnings.length > 0) {
    messages.push('Warnings:');
    result.warnings.forEach(warning => {
      messages.push(`  - ${warning.field}: ${warning.message}`);
    });
  }

  return messages.join('\n');
}
