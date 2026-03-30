/**
 * Runtime Configuration Validation Utilities
 * Phase 5.5: Interdependency Validation
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  details?: Record<string, any>;
}

/**
 * Weight group keys
 */
const SCORE_WEIGHTS = [
  'AUDIO_WEIGHT',
  'CONTENT_WEIGHT',
  'DELIVERY_WEIGHT',
  'EMOTION_WEIGHT',
] as const;

const BASE_WEIGHTS = [
  'SCORE_WEIGHT_COMMUNICATION',
  'SCORE_WEIGHT_PROBLEM_SOLVING',
  'SCORE_WEIGHT_TECHNICAL',
  'SCORE_WEIGHT_PRESENTATION',
] as const;

/**
 * Validate weight sum equals 1.0
 */
export function validateWeightSum(
  key: string,
  newValue: number,
  allConfigs: Record<string, number>
): ValidationResult {
  let weightGroup: readonly string[];

  if (SCORE_WEIGHTS.includes(key as any)) {
    weightGroup = SCORE_WEIGHTS;
  } else if (BASE_WEIGHTS.includes(key as any)) {
    weightGroup = BASE_WEIGHTS;
  } else {
    // Not a weight field
    return { valid: true };
  }

  // Calculate sum with new value
  const weights = { ...allConfigs };
  weights[key] = newValue;

  const sum = weightGroup.reduce((acc, k) => {
    const value = weights[k];
    return acc + (typeof value === 'number' ? value : 0);
  }, 0);

  const diff = Math.abs(sum - 1.0);

  if (diff > 0.001) {
    return {
      valid: false,
      error: `Weight sum must equal 1.0 (current: ${sum.toFixed(3)})`,
      details: {
        group: weightGroup,
        currentWeights: weights,
        sum,
        expected: 1.0,
      },
    };
  }

  if (diff > 0.0001 && diff <= 0.001) {
    return {
      valid: true,
      warning: `Weight sum is ${sum.toFixed(4)} (acceptable, but close to threshold)`,
      details: { sum },
    };
  }

  return { valid: true };
}

/**
 * Validate threshold ordering (GOOD < EXCELLENT)
 */
export function validateThresholdOrder(
  key: string,
  newValue: number,
  allConfigs: Record<string, number>
): ValidationResult {
  if (key !== 'SCORE_THRESHOLD_GOOD' && key !== 'SCORE_THRESHOLD_EXCELLENT') {
    return { valid: true };
  }

  const good =
    key === 'SCORE_THRESHOLD_GOOD'
      ? newValue
      : allConfigs['SCORE_THRESHOLD_GOOD'] ?? 0;
  const excellent =
    key === 'SCORE_THRESHOLD_EXCELLENT'
      ? newValue
      : allConfigs['SCORE_THRESHOLD_EXCELLENT'] ?? 0;

  if (good >= excellent) {
    return {
      valid: false,
      error: `SCORE_THRESHOLD_GOOD (${good}) must be less than SCORE_THRESHOLD_EXCELLENT (${excellent})`,
      details: { good, excellent },
    };
  }

  return { valid: true };
}

/**
 * Validate business rules (e.g., TTS_STABILITY >= 0.3)
 */
export function validateBusinessRules(
  key: string,
  value: number
): ValidationResult {
  switch (key) {
    case 'TTS_STABILITY':
      if (value < 0.3) {
        return {
          valid: false,
          error: 'TTS_STABILITY must be at least 0.3 to prevent audio instability',
        };
      }
      break;

    case 'TTS_SIMILARITY_BOOST':
      if (value < 0.5) {
        return {
          valid: false,
          error: 'TTS_SIMILARITY_BOOST must be at least 0.5 for acceptable voice quality',
        };
      }
      break;

    case 'SILENCE_THRESHOLD':
      if (value > 0.3) {
        return {
          valid: false,
          error: 'SILENCE_THRESHOLD must be at most 0.3 to avoid missing speech',
        };
      }
      break;

    case 'OPTIMAL_PAUSE_SEC':
      if (value < 1.0 || value > 5.0) {
        return {
          valid: false,
          error: 'OPTIMAL_PAUSE_SEC must be between 1.0 and 5.0 seconds',
        };
      }
      break;
  }

  return { valid: true };
}

/**
 * Validate all rules for a configuration change
 */
export function validateConfigChange(
  key: string,
  newValue: any,
  dataType: string,
  allConfigs: Record<string, any>
): ValidationResult {
  // Type validation
  if (dataType === 'NUMBER' && typeof newValue !== 'number') {
    return { valid: false, error: 'Value must be a number' };
  }

  if (dataType === 'NUMBER') {
    // Business rules
    const businessResult = validateBusinessRules(key, newValue);
    if (!businessResult.valid) {
      return businessResult;
    }

    // Weight sum validation
    const weightResult = validateWeightSum(key, newValue, allConfigs);
    if (!weightResult.valid) {
      return weightResult;
    }

    // Threshold ordering
    const thresholdResult = validateThresholdOrder(key, newValue, allConfigs);
    if (!thresholdResult.valid) {
      return thresholdResult;
    }

    // Return warning if exists
    if (weightResult.warning) {
      return weightResult;
    }
  }

  return { valid: true };
}

/**
 * Get weight group for a key
 */
export function getWeightGroup(key: string): readonly string[] | null {
  if (SCORE_WEIGHTS.includes(key as any)) {
    return SCORE_WEIGHTS;
  }
  if (BASE_WEIGHTS.includes(key as any)) {
    return BASE_WEIGHTS;
  }
  return null;
}

/**
 * Check if key is a weight field
 */
export function isWeightField(key: string): boolean {
  return getWeightGroup(key) !== null;
}

/**
 * Check if key is a threshold field
 */
export function isThresholdField(key: string): boolean {
  return key === 'SCORE_THRESHOLD_GOOD' || key === 'SCORE_THRESHOLD_EXCELLENT';
}
