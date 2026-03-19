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
    throw new Error(
      `Environment variable ${key} must be a valid number, got: ${value}`
    );
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
  const commonRequired = [
    'AWS_REGION',
    'DATABASE_URL',
    'S3_BUCKET',
    'ENVIRONMENT',
  ];

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
