/**
 * Scenario Preview (Test Mode)
 * Phase 1.6.1 Day 36: シナリオプレビュー実装
 *
 * シナリオを実際に実行せずに検証・プレビューする機能
 */

import { validateScenario, ScenarioValidationResult } from './validator';
import {
  validateAndResolveVariables,
  replaceVariablesInText,
  extractVariablesFromText,
  getVariableList,
  VariableValidationResult,
} from './variables';
import { VariableDefinition } from './cache';

export interface ScenarioPreviewRequest {
  title: string;
  systemPrompt: string;
  language: string;
  initialGreeting?: string;
  conversationFlow?: unknown;
  variables?: Record<string, VariableDefinition>;
  variableValues?: Record<string, unknown>;
}

export interface ScenarioPreviewResult {
  validation: ScenarioValidationResult;
  variableValidation?: VariableValidationResult;
  resolvedPrompt?: string;
  resolvedGreeting?: string;
  detectedVariables?: string[];
  estimatedTurns?: number;
  estimatedDuration?: string;
  warnings: string[];
  recommendations: string[];
}

/**
 * Preview scenario without executing it
 */
export function previewScenario(request: ScenarioPreviewRequest): ScenarioPreviewResult {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Step 1: Validate scenario configuration
  const validation = validateScenario({
    title: request.title,
    systemPrompt: request.systemPrompt,
    language: request.language,
    initialGreeting: request.initialGreeting,
    conversationFlow: request.conversationFlow,
  });

  // Step 2: Detect variables in prompts
  const detectedVariables: Set<string> = new Set();

  if (request.systemPrompt) {
    const vars = extractVariablesFromText(request.systemPrompt);
    vars.forEach(v => detectedVariables.add(v));
  }

  if (request.initialGreeting) {
    const vars = extractVariablesFromText(request.initialGreeting);
    vars.forEach(v => detectedVariables.add(v));
  }

  // Step 3: Validate variables if definitions are provided
  let variableValidation: VariableValidationResult | undefined;
  let resolvedPrompt: string | undefined;
  let resolvedGreeting: string | undefined;

  if (request.variables && Object.keys(request.variables).length > 0) {
    variableValidation = validateAndResolveVariables(
      request.variables,
      request.variableValues || {}
    );

    // If variable validation passed, resolve variables in text
    if (variableValidation.isValid && request.systemPrompt) {
      resolvedPrompt = replaceVariablesInText(
        request.systemPrompt,
        variableValidation.resolvedVariables
      );
    }

    if (variableValidation.isValid && request.initialGreeting) {
      resolvedGreeting = replaceVariablesInText(
        request.initialGreeting,
        variableValidation.resolvedVariables
      );
    }

    // Check for undefined variables
    for (const detectedVar of detectedVariables) {
      if (!request.variables[detectedVar]) {
        warnings.push(
          `Variable '${detectedVar}' is used but not defined in variable definitions`
        );
      }
    }
  } else if (detectedVariables.size > 0) {
    warnings.push(
      `Detected ${detectedVariables.size} variable(s) but no variable definitions provided: ${Array.from(detectedVariables).join(', ')}`
    );
  }

  // Step 4: Estimate conversation turns and duration
  let estimatedTurns: number | undefined;
  let estimatedDuration: string | undefined;

  if (request.conversationFlow) {
    try {
      const flowStr = JSON.stringify(request.conversationFlow);
      // Simple heuristic: count number of steps/nodes
      const stepCount = (flowStr.match(/"type":/g) || []).length;
      estimatedTurns = Math.max(5, Math.min(stepCount * 2, 50));
      const durationMinutes = Math.ceil(estimatedTurns * 0.5); // ~30 sec per turn
      estimatedDuration = `${durationMinutes} minutes`;
    } catch (error) {
      warnings.push('Unable to estimate conversation flow');
    }
  }

  // Step 5: Generate recommendations
  if (!request.initialGreeting) {
    recommendations.push(
      'Add an initial greeting to make the conversation more natural and welcoming'
    );
  }

  if (!request.conversationFlow) {
    recommendations.push(
      'Define a conversation flow to structure the interaction and improve consistency'
    );
  }

  if (request.systemPrompt && request.systemPrompt.length < 100) {
    recommendations.push(
      'Consider expanding the system prompt to provide more context and guidance to the AI'
    );
  }

  if (!request.variables || Object.keys(request.variables).length === 0) {
    recommendations.push(
      'Define variables to make your scenario reusable across different contexts'
    );
  }

  // Check for common issues in prompt
  if (request.systemPrompt) {
    if (request.systemPrompt.includes('you are')) {
      // Good practice detected
    } else {
      recommendations.push(
        'Consider starting the system prompt with "You are..." to clearly define the AI role'
      );
    }

    if (!request.systemPrompt.includes('language')) {
      recommendations.push(
        'Explicitly mention the conversation language in the system prompt for better consistency'
      );
    }
  }

  return {
    validation,
    variableValidation,
    resolvedPrompt,
    resolvedGreeting,
    detectedVariables: Array.from(detectedVariables),
    estimatedTurns,
    estimatedDuration,
    warnings,
    recommendations,
  };
}

/**
 * Generate a sample conversation based on scenario configuration
 */
export interface SampleTurn {
  speaker: 'USER' | 'AI';
  text: string;
  turnNumber: number;
}

export function generateSampleConversation(
  systemPrompt: string,
  initialGreeting?: string,
  maxTurns: number = 5
): SampleTurn[] {
  const conversation: SampleTurn[] = [];

  // Add initial greeting if provided
  if (initialGreeting) {
    conversation.push({
      speaker: 'AI',
      text: initialGreeting,
      turnNumber: 0,
    });
  }

  // Generate sample turns based on prompt analysis
  const isInterview = systemPrompt.toLowerCase().includes('interview');
  const isTraining = systemPrompt.toLowerCase().includes('training');
  const isCustomerService = systemPrompt.toLowerCase().includes('customer');

  if (isInterview) {
    conversation.push({
      speaker: 'AI',
      text: 'Thank you for joining us today. Can you start by telling me about yourself?',
      turnNumber: 1,
    });
    conversation.push({
      speaker: 'USER',
      text: '[User response about background and experience]',
      turnNumber: 2,
    });
    conversation.push({
      speaker: 'AI',
      text: 'That sounds interesting. Can you elaborate on your key accomplishments?',
      turnNumber: 3,
    });
  } else if (isTraining) {
    conversation.push({
      speaker: 'AI',
      text: 'Welcome to the training session. Are you ready to begin?',
      turnNumber: 1,
    });
    conversation.push({
      speaker: 'USER',
      text: '[User confirms readiness]',
      turnNumber: 2,
    });
  } else if (isCustomerService) {
    conversation.push({
      speaker: 'AI',
      text: 'Hello! How can I help you today?',
      turnNumber: 1,
    });
    conversation.push({
      speaker: 'USER',
      text: '[User describes their issue]',
      turnNumber: 2,
    });
  } else {
    // Generic conversation
    conversation.push({
      speaker: 'AI',
      text: 'Hello! How can I assist you today?',
      turnNumber: 1,
    });
    conversation.push({
      speaker: 'USER',
      text: '[User starts the conversation]',
      turnNumber: 2,
    });
  }

  return conversation.slice(0, maxTurns);
}
