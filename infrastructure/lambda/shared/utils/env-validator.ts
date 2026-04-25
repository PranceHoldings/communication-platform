/**
 * Environment Variable Validation Utilities
 *
 * Prevents runtime errors due to missing environment variables
 * Enforces explicit configuration instead of unsafe defaults
 */

/**
 * Get required environment variable or throw error
 *
 * @param key - Environment variable name
 * @returns Environment variable value
 * @throws Error if variable is not set
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    throw new Error(
      `Required environment variable ${key} is not set. ` +
        `Please configure it in your environment or Lambda function settings.`
    );
  }

  return value.trim();
}

/**
 * Get optional environment variable with type-safe default
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns Environment variable value or default
 */
export function getOptionalEnv(key: string, defaultValue: string): string {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    return defaultValue;
  }

  return value.trim();
}

/**
 * Get required environment variable as number
 *
 * @param key - Environment variable name
 * @returns Parsed number value
 * @throws Error if variable is not set or not a valid number
 */
export function getRequiredEnvAsNumber(key: string): number {
  const value = getRequiredEnv(key);
  const numValue = parseInt(value, 10);

  if (isNaN(numValue)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }

  return numValue;
}

/**
 * Get optional environment variable as number
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns Parsed number value or default
 */
export function getOptionalEnvAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    return defaultValue;
  }

  const numValue = parseInt(value, 10);

  if (isNaN(numValue)) {
    console.warn(
      `Environment variable ${key} is not a valid number: ${value}. Using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return numValue;
}

/**
 * Get required environment variable as boolean
 *
 * @param key - Environment variable name
 * @returns Boolean value
 * @throws Error if variable is not set
 */
export function getRequiredEnvAsBoolean(key: string): boolean {
  const value = getRequiredEnv(key).toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Get optional environment variable as boolean
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns Boolean value or default
 */
export function getOptionalEnvAsBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];

  if (!value || value.trim() === '') {
    return defaultValue;
  }

  const lowerValue = value.trim().toLowerCase();
  return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
}

/**
 * Get required environment variable as float
 *
 * @param key - Environment variable name
 * @returns Parsed float value
 * @throws Error if variable is not set or not a valid number
 */
export function getRequiredEnvAsFloat(key: string): number {
  const value = getRequiredEnv(key);
  const floatValue = parseFloat(value);

  if (isNaN(floatValue)) {
    throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
  }

  return floatValue;
}

/**
 * Validate all required environment variables at Lambda startup
 * Call this at the top of your handler to fail fast
 *
 * @param requiredVars - Array of required environment variable names
 * @throws Error if any required variable is missing
 */
export function validateRequiredEnvVars(requiredVars: string[]): void {
  const missing: string[] = [];

  for (const key of requiredVars) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Please configure them in your Lambda function settings.`
    );
  }
}

/**
 * Validate common Lambda environment variables
 * Call this at Lambda initialization to ensure basic config is present
 */
export function validateCommonEnvVars(): void {
  const commonRequired = ['AWS_REGION', 'DATABASE_URL', 'S3_BUCKET', 'ENVIRONMENT'];

  validateRequiredEnvVars(commonRequired);
}

/**
 * Get AWS region from environment or throw error
 * Convenience wrapper for commonly used variable
 */
export function getAwsRegion(): string {
  return getRequiredEnv('AWS_REGION');
}

/**
 * Get AWS endpoint suffix from environment or throw error
 * Example: amazonaws.com (can be changed for AWS China, GovCloud, etc.)
 */
export function getAwsEndpointSuffix(): string {
  return getRequiredEnv('AWS_ENDPOINT_SUFFIX');
}

/**
 * Get database URL from environment or throw error
 * Convenience wrapper for commonly used variable
 */
export function getDatabaseUrl(): string {
  return getRequiredEnv('DATABASE_URL');
}

/**
 * Get S3 bucket name from environment or throw error
 * Convenience wrapper for commonly used variable
 */
export function getS3Bucket(): string {
  return getRequiredEnv('S3_BUCKET');
}

/**
 * Get CloudFront domain from environment or throw error
 * Convenience wrapper for commonly used variable
 */
export function getCloudFrontDomain(): string {
  return getRequiredEnv('CLOUDFRONT_DOMAIN');
}

/**
 * Get frontend URL from environment or throw error
 * Convenience wrapper for commonly used variable
 */
export function getFrontendUrl(): string {
  return getRequiredEnv('FRONTEND_URL');
}

/**
 * Get environment name (dev/staging/production)
 * Convenience wrapper for commonly used variable
 */
export function getEnvironmentName(): string {
  return getOptionalEnv('ENVIRONMENT', 'dev');
}

/**
 * Get allowed CORS origins from FRONTEND_URL env var.
 * Always includes the primary FRONTEND_URL; dev environment also includes localhost.
 */
export function getCorsAllowedOrigins(): string[] {
  const frontendUrl = getFrontendUrl();
  const origins = [frontendUrl];
  // dev環境はlocalhostも許可
  if (!isProduction() && !origins.includes('http://localhost:3000')) {
    origins.push('http://localhost:3000');
  }
  return origins;
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return getEnvironmentName() === 'production';
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return getEnvironmentName() === 'dev';
}

/**
 * Get analysis Lambda function name from environment or throw error
 * Convenience wrapper for commonly used variable
 */
export function getAnalysisLambdaFunctionName(): string {
  return getRequiredEnv('ANALYSIS_LAMBDA_FUNCTION_NAME');
}

// ============================================================
// Query & Processing Configuration
// ============================================================

export function getMaxResults(): number {
  return getRequiredEnvAsNumber('MAX_RESULTS');
}

export function getVideoChunkBatchSize(): number {
  return getRequiredEnvAsNumber('VIDEO_CHUNK_BATCH_SIZE');
}

export function getAnalysisBatchSize(): number {
  return getRequiredEnvAsNumber('ANALYSIS_BATCH_SIZE');
}

// ============================================================
// Security Configuration
// ============================================================

export function getBcryptSaltRounds(): number {
  return getRequiredEnvAsNumber('BCRYPT_SALT_ROUNDS');
}

export function getRateLimitMaxAttempts(): number {
  return getRequiredEnvAsNumber('RATE_LIMIT_MAX_ATTEMPTS');
}

export function getRateLimitLockoutDurationMs(): number {
  return getRequiredEnvAsNumber('RATE_LIMIT_LOCKOUT_DURATION_MS');
}

export function getRateLimitAttemptWindowMs(): number {
  return getRequiredEnvAsNumber('RATE_LIMIT_ATTEMPT_WINDOW_MS');
}

// ============================================================
// Audio Processing Configuration
// ============================================================

export function getMinPauseDurationSec(): number {
  return getRequiredEnvAsFloat('MIN_PAUSE_DURATION_SEC');
}

export function getOptimalPauseSec(): number {
  return getRequiredEnvAsFloat('OPTIMAL_PAUSE_SEC');
}

export function getTtsStability(): number {
  return getRequiredEnvAsFloat('TTS_STABILITY');
}

export function getTtsSimilarityBoost(): number {
  return getRequiredEnvAsFloat('TTS_SIMILARITY_BOOST');
}

export function getDefaultSttConfidence(): number {
  return getRequiredEnvAsFloat('DEFAULT_STT_CONFIDENCE');
}

export function getAudioSampleRate(): number {
  return getRequiredEnvAsNumber('AUDIO_SAMPLE_RATE');
}

export function getSilenceThreshold(): number {
  return getRequiredEnvAsFloat('SILENCE_THRESHOLD');
}

// ============================================================
// AI Processing Configuration
// ============================================================

export function getClaudeTemperature(): number {
  return getRequiredEnvAsFloat('CLAUDE_TEMPERATURE');
}

export function getClaudeMaxTokens(): number {
  return getRequiredEnvAsNumber('CLAUDE_MAX_TOKENS');
}

export function getMaxAutoDetectLanguages(): number {
  return getRequiredEnvAsNumber('MAX_AUTO_DETECT_LANGUAGES');
}

// ============================================================
// Score Calculation Configuration
// ============================================================

export function getEmotionWeight(): number {
  return getRequiredEnvAsFloat('EMOTION_WEIGHT');
}

export function getAudioWeight(): number {
  return getRequiredEnvAsFloat('AUDIO_WEIGHT');
}

export function getContentWeight(): number {
  return getRequiredEnvAsFloat('CONTENT_WEIGHT');
}

export function getDeliveryWeight(): number {
  return getRequiredEnvAsFloat('DELIVERY_WEIGHT');
}

export function getMinConfidenceThreshold(): number {
  return getRequiredEnvAsNumber('MIN_CONFIDENCE_THRESHOLD');
}

export function getMinQualityThreshold(): number {
  return getRequiredEnvAsNumber('MIN_QUALITY_THRESHOLD');
}

// ============================================================
// DynamoDB Configuration
// ============================================================

export function getDynamoDbVideoLockTtlSeconds(): number {
  return getRequiredEnvAsNumber('DYNAMODB_VIDEO_LOCK_TTL_SECONDS');
}

export function getDynamoDbConnectionTtlSeconds(): number {
  return getRequiredEnvAsNumber('DYNAMODB_CONNECTION_TTL_SECONDS');
}

// ============================================================
// Media Configuration
// ============================================================

export function getDefaultChunkDurationMs(): number {
  return getRequiredEnvAsNumber('DEFAULT_CHUNK_DURATION_MS');
}

// ============================================================
// WebSocket ACK Tuning Configuration
// ============================================================

export function getWsAckTimeoutMsDefault(): number {
  return getOptionalEnvAsNumber('WS_ACK_TIMEOUT_MS', 5000);
}

export function getWsMaxRetriesDefault(): number {
  return getOptionalEnvAsNumber('WS_MAX_RETRIES', 6);
}
