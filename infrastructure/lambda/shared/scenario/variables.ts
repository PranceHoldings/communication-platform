/**
 * Scenario Variable System
 * Phase 1.6.1 Day 36: 変数システム実装
 *
 * シナリオ内の変数管理、型チェック、デフォルト値適用
 */

import { VariableDefinition } from './cache';

export interface VariableValue {
  name: string;
  value: string | number | boolean;
  type: 'string' | 'number' | 'boolean';
}

export interface VariableValidationError {
  variable: string;
  error: string;
}

export interface VariableValidationResult {
  isValid: boolean;
  errors: VariableValidationError[];
  resolvedVariables: Record<string, string | number | boolean>;
}

/**
 * Validate variable value against its definition
 */
export function validateVariableValue(
  name: string,
  value: unknown,
  definition: VariableDefinition
): VariableValidationError | null {
  // Check if required variable is missing
  if (definition.required && (value === undefined || value === null)) {
    return {
      variable: name,
      error: `Required variable '${name}' is missing`,
    };
  }

  // If value is provided, check type
  if (value !== undefined && value !== null) {
    const actualType = typeof value;
    const expectedType = definition.type;

    if (actualType !== expectedType) {
      return {
        variable: name,
        error: `Variable '${name}' expected type '${expectedType}' but got '${actualType}'`,
      };
    }

    // Additional validation for number
    if (expectedType === 'number' && typeof value === 'number') {
      if (isNaN(value) || !isFinite(value)) {
        return {
          variable: name,
          error: `Variable '${name}' must be a valid finite number`,
        };
      }
    }
  }

  return null;
}

/**
 * Validate and resolve all variables
 */
export function validateAndResolveVariables(
  definitions: Record<string, VariableDefinition>,
  providedValues: Record<string, unknown>
): VariableValidationResult {
  const errors: VariableValidationError[] = [];
  const resolvedVariables: Record<string, string | number | boolean> = {};

  // Validate and resolve each defined variable
  for (const [name, definition] of Object.entries(definitions)) {
    const providedValue = providedValues[name];

    // Validate the provided value
    const validationError = validateVariableValue(name, providedValue, definition);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    // Use provided value or default value
    let finalValue: string | number | boolean;

    if (providedValue !== undefined && providedValue !== null) {
      finalValue = providedValue as string | number | boolean;
    } else if (definition.defaultValue !== undefined) {
      finalValue = definition.defaultValue;
      console.log(`[Variables] Using default value for '${name}':`, finalValue);
    } else {
      // No value and no default (should be caught by validation if required)
      continue;
    }

    resolvedVariables[name] = finalValue;
  }

  return {
    isValid: errors.length === 0,
    errors,
    resolvedVariables,
  };
}

/**
 * Replace variable placeholders in text
 * Supports formats: {{variableName}}, {variableName}, $variableName
 */
export function replaceVariablesInText(
  text: string,
  variables: Record<string, string | number | boolean>
): string {
  let result = text;

  for (const [name, value] of Object.entries(variables)) {
    // Convert value to string
    const valueStr = String(value);

    // Replace all occurrences of variable placeholders
    const patterns = [
      new RegExp(`\\{\\{${name}\\}\\}`, 'g'), // {{variableName}}
      new RegExp(`\\{${name}\\}`, 'g'), // {variableName}
      new RegExp(`\\$${name}\\b`, 'g'), // $variableName
    ];

    for (const pattern of patterns) {
      result = result.replace(pattern, valueStr);
    }
  }

  return result;
}

/**
 * Extract variable placeholders from text
 */
export function extractVariablesFromText(text: string): string[] {
  const variables = new Set<string>();

  // Pattern 1: {{variableName}}
  const pattern1 = /\{\{(\w+)\}\}/g;
  let match1 = pattern1.exec(text);
  while (match1 !== null) {
    variables.add(match1[1]);
    match1 = pattern1.exec(text);
  }

  // Pattern 2: {variableName}
  const pattern2 = /\{(\w+)\}/g;
  let match2 = pattern2.exec(text);
  while (match2 !== null) {
    variables.add(match2[1]);
    match2 = pattern2.exec(text);
  }

  // Pattern 3: $variableName
  const pattern3 = /\$(\w+)\b/g;
  let match3 = pattern3.exec(text);
  while (match3 !== null) {
    variables.add(match3[1]);
    match3 = pattern3.exec(text);
  }

  return Array.from(variables);
}

/**
 * Get all variable definitions with their current values
 */
export function getVariableList(
  definitions: Record<string, VariableDefinition>,
  currentValues: Record<string, string | number | boolean>
): VariableValue[] {
  const list: VariableValue[] = [];

  for (const [name, definition] of Object.entries(definitions)) {
    const value = currentValues[name] ?? definition.defaultValue;

    if (value !== undefined) {
      list.push({
        name,
        value,
        type: definition.type,
      });
    }
  }

  return list;
}

/**
 * Create default variable definitions for common use cases
 */
export function getDefaultVariableDefinitions(): Record<string, VariableDefinition> {
  return {
    userName: {
      name: 'userName',
      type: 'string',
      defaultValue: 'User',
      required: false,
      description: 'Name of the user in the conversation',
    },
    sessionDate: {
      name: 'sessionDate',
      type: 'string',
      defaultValue: new Date().toISOString().split('T')[0],
      required: false,
      description: 'Current session date (YYYY-MM-DD)',
    },
    companyName: {
      name: 'companyName',
      type: 'string',
      defaultValue: 'Company',
      required: false,
      description: 'Name of the company',
    },
    position: {
      name: 'position',
      type: 'string',
      defaultValue: 'Position',
      required: false,
      description: 'Job position or role',
    },
  };
}
