/**
 * Runtime Configuration Loader
 * Phase 5.3: Flexible caching architecture
 *
 * Caching tiers (graceful degradation):
 * 1. Lambda memory cache (TTL: 10 seconds) - Always available
 * 2. ElastiCache Redis (TTL: 60 seconds) - Optional, used if available
 * 3. Aurora RDS (permanent storage) - Source of truth
 * 4. Environment variable fallback (for backward compatibility)
 */

import { prisma } from '../database/prisma';

// Lambda memory cache
interface CacheEntry {
  value: any;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry>();

// Memory cache TTL: 10 seconds
// NOTE: This is an internal performance tuning constant and intentionally not
// environment-variable-based. It represents Lambda memory cache behavior (fast, volatile)
// and should remain consistent across environments. If you need to adjust cache behavior,
// modify ELASTICACHE_TTL_SECONDS or database-level settings instead.
const MEMORY_CACHE_TTL_MS = 10_000;

// ElastiCache TTL: 60 seconds
const ELASTICACHE_TTL_SECONDS = 60;

// ElastiCache availability flag (lazy initialization)
let elasticacheAvailable: boolean | null = null;

// Optional ElastiCache client (lazy loaded)
let elasticacheClient: any = null;

/**
 * Check if ElastiCache is available
 */
async function checkElastiCacheAvailability(): Promise<boolean> {
  if (elasticacheAvailable !== null) {
    return elasticacheAvailable;
  }

  // Check if ELASTICACHE_ENDPOINT is set
  if (!process.env.ELASTICACHE_ENDPOINT) {
    console.log('[RuntimeConfig] ElastiCache not configured, using 2-tier cache (Memory + RDS)');
    elasticacheAvailable = false;
    return false;
  }

  try {
    // Lazy load ElastiCache client
    const { isRedisAvailable } = await import('./elasticache-client');
    elasticacheAvailable = await isRedisAvailable();

    if (elasticacheAvailable) {
      console.log('[RuntimeConfig] ElastiCache available, using 3-tier cache (Memory + Redis + RDS)');
      const { getCacheValue, setCacheValue } = await import('./elasticache-client');
      elasticacheClient = { getCacheValue, setCacheValue };
    } else {
      console.log('[RuntimeConfig] ElastiCache unavailable, using 2-tier cache (Memory + RDS)');
    }

    return elasticacheAvailable;
  } catch (error) {
    console.warn('[RuntimeConfig] ElastiCache check failed, using 2-tier cache:', error);
    elasticacheAvailable = false;
    return false;
  }
}

/**
 * Get runtime configuration value with flexible caching
 *
 * @param key - Configuration key
 * @param options - Optional parameters
 * @returns Configuration value
 */
export async function getRuntimeConfig<T>(
  key: string,
  options?: {
    skipCache?: boolean;
    useEnvFallback?: boolean;
  }
): Promise<T> {
  const { skipCache = false, useEnvFallback = true } = options || {};

  // Layer 1: Lambda memory cache (fastest)
  if (!skipCache) {
    const cached = memoryCache.get(key);
    if (cached && Date.now() < cached.expiry) {
      console.log(`[RuntimeConfig] Cache hit (memory): ${key}`);
      return cached.value as T;
    }
  }

  // Layer 2: ElastiCache Redis (fast) - Optional
  if (!skipCache && (await checkElastiCacheAvailability()) && elasticacheClient) {
    try {
      const redisValue = await elasticacheClient.getCacheValue<T>(`runtime:${key}`);
      if (redisValue !== null) {
        console.log(`[RuntimeConfig] Cache hit (Redis): ${key}`);
        // Store in memory cache
        memoryCache.set(key, {
          value: redisValue,
          expiry: Date.now() + MEMORY_CACHE_TTL_MS,
        });
        return redisValue;
      }
    } catch (error) {
      console.error(`[RuntimeConfig] Redis error for key ${key}, falling back to database:`, error);
      // Continue to database
    }
  }

  // Layer 3: Aurora RDS (source of truth)
  try {
    const config = await prisma.runtimeConfig.findUnique({
      where: { key },
      select: {
        value: true,
        dataType: true,
      },
    });

    if (config) {
      const value = parseConfigValue(config.value, config.dataType) as T;
      console.log(`[RuntimeConfig] Database hit: ${key}`);

      // Update caches (if not skipped)
      if (!skipCache) {
        // ElastiCache (if available)
        if (elasticacheAvailable && elasticacheClient) {
          try {
            await elasticacheClient.setCacheValue(`runtime:${key}`, value, ELASTICACHE_TTL_SECONDS);
          } catch (error) {
            console.error(`[RuntimeConfig] Failed to update Redis cache for ${key}:`, error);
          }
        }

        // Memory cache (always)
        memoryCache.set(key, {
          value,
          expiry: Date.now() + MEMORY_CACHE_TTL_MS,
        });
      }

      return value;
    }
  } catch (error) {
    console.error(`[RuntimeConfig] Database error for key ${key}:`, error);
  }

  // Layer 4: Environment variable fallback
  if (useEnvFallback) {
    try {
      const envValue = process.env[key];
      if (envValue !== undefined) {
        console.log(`[RuntimeConfig] Environment variable fallback: ${key}`);
        return parseEnvValue<T>(envValue);
      }
    } catch (error) {
      console.error(`[RuntimeConfig] Environment fallback error for key ${key}:`, error);
    }
  }

  // No value found
  throw new Error(`Runtime configuration not found: ${key}`);
}

/**
 * Parse configuration value based on data type
 */
function parseConfigValue(rawValue: any, dataType: string): any {
  switch (dataType) {
    case 'NUMBER':
      return typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
    case 'STRING':
      return String(rawValue);
    case 'BOOLEAN':
      if (typeof rawValue === 'boolean') return rawValue;
      const str = String(rawValue).toLowerCase();
      return str === 'true' || str === '1';
    case 'JSON':
      return typeof rawValue === 'object' ? rawValue : JSON.parse(String(rawValue));
    default:
      return rawValue;
  }
}

/**
 * Parse environment variable value to appropriate type
 */
function parseEnvValue<T>(value: string): T {
  // Try to parse as number
  const num = Number(value);
  if (!isNaN(num)) {
    return num as T;
  }

  // Try to parse as boolean
  if (value.toLowerCase() === 'true') {
    return true as T;
  }
  if (value.toLowerCase() === 'false') {
    return false as T;
  }

  // Try to parse as JSON
  try {
    return JSON.parse(value) as T;
  } catch {
    // Return as string
    return value as T;
  }
}

/**
 * Clear memory cache for a specific key
 */
export function clearMemoryCache(key: string): void {
  memoryCache.delete(key);
  console.log(`[RuntimeConfig] Memory cache cleared: ${key}`);
}

/**
 * Clear all memory cache
 */
export function clearAllMemoryCache(): void {
  memoryCache.clear();
  console.log('[RuntimeConfig] All memory cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  memoryCacheSize: number;
  memoryCacheKeys: string[];
  elasticacheAvailable: boolean | null;
} {
  return {
    memoryCacheSize: memoryCache.size,
    memoryCacheKeys: Array.from(memoryCache.keys()),
    elasticacheAvailable,
  };
}

// ============================================================
// Typed getters for common runtime configs
// ============================================================

// Query & Processing
export async function getMaxResults(): Promise<number> {
  return getRuntimeConfig<number>('MAX_RESULTS');
}

export async function getVideoChunkBatchSize(): Promise<number> {
  return getRuntimeConfig<number>('VIDEO_CHUNK_BATCH_SIZE');
}

export async function getAnalysisBatchSize(): Promise<number> {
  return getRuntimeConfig<number>('ANALYSIS_BATCH_SIZE');
}

// AI Processing
export async function getClaudeTemperature(): Promise<number> {
  return getRuntimeConfig<number>('CLAUDE_TEMPERATURE');
}

export async function getClaudeMaxTokens(): Promise<number> {
  return getRuntimeConfig<number>('CLAUDE_MAX_TOKENS');
}

export async function getMaxAutoDetectLanguages(): Promise<number> {
  return getRuntimeConfig<number>('MAX_AUTO_DETECT_LANGUAGES');
}

// Audio Processing
export async function getTtsStability(): Promise<number> {
  return getRuntimeConfig<number>('TTS_STABILITY');
}

export async function getTtsSimilarityBoost(): Promise<number> {
  return getRuntimeConfig<number>('TTS_SIMILARITY_BOOST');
}

export async function getSilenceThreshold(): Promise<number> {
  return getRuntimeConfig<number>('SILENCE_THRESHOLD');
}

export async function getOptimalPauseSec(): Promise<number> {
  return getRuntimeConfig<number>('OPTIMAL_PAUSE_SEC');
}

export async function getDefaultSttConfidence(): Promise<number> {
  return getRuntimeConfig<number>('DEFAULT_STT_CONFIDENCE');
}

// Security
export async function getRateLimitMaxAttempts(): Promise<number> {
  return getRuntimeConfig<number>('RATE_LIMIT_MAX_ATTEMPTS');
}

export async function getRateLimitLockoutDurationMs(): Promise<number> {
  return getRuntimeConfig<number>('RATE_LIMIT_LOCKOUT_DURATION_MS');
}

export async function getBcryptSaltRounds(): Promise<number> {
  return getRuntimeConfig<number>('BCRYPT_SALT_ROUNDS');
}

// Score Calculation - Component Weights
export async function getEmotionWeight(): Promise<number> {
  return getRuntimeConfig<number>('EMOTION_WEIGHT');
}

export async function getAudioWeight(): Promise<number> {
  return getRuntimeConfig<number>('AUDIO_WEIGHT');
}

export async function getContentWeight(): Promise<number> {
  return getRuntimeConfig<number>('CONTENT_WEIGHT');
}

export async function getDeliveryWeight(): Promise<number> {
  return getRuntimeConfig<number>('DELIVERY_WEIGHT');
}

// Score Calculation - Category Weights
export async function getScoreWeightCommunication(): Promise<number> {
  return getRuntimeConfig<number>('SCORE_WEIGHT_COMMUNICATION');
}

export async function getScoreWeightProblemSolving(): Promise<number> {
  return getRuntimeConfig<number>('SCORE_WEIGHT_PROBLEM_SOLVING');
}

export async function getScoreWeightTechnical(): Promise<number> {
  return getRuntimeConfig<number>('SCORE_WEIGHT_TECHNICAL');
}

export async function getScoreWeightPresentation(): Promise<number> {
  return getRuntimeConfig<number>('SCORE_WEIGHT_PRESENTATION');
}

// Score Calculation - Thresholds
export async function getScoreThresholdGood(): Promise<number> {
  return getRuntimeConfig<number>('SCORE_THRESHOLD_GOOD');
}

export async function getScoreThresholdExcellent(): Promise<number> {
  return getRuntimeConfig<number>('SCORE_THRESHOLD_EXCELLENT');
}

// ============================================================
// Score Preset Weights - Phase 5.4.1 Addition
// ============================================================

/**
 * Get score preset weights for a specific preset
 * @param preset - Scoring preset name (default, interview_practice, language_learning, presentation, custom)
 * @returns ScoringWeights object with emotion, audio, content, delivery weights
 */
export async function getScorePresetWeights(preset: string): Promise<{
  emotion: number;
  audio: number;
  content: number;
  delivery: number;
}> {
  const presetUpper = preset.toUpperCase();

  const [emotion, audio, content, delivery] = await Promise.all([
    getRuntimeConfig<number>(`SCORE_PRESET_${presetUpper}_EMOTION`),
    getRuntimeConfig<number>(`SCORE_PRESET_${presetUpper}_AUDIO`),
    getRuntimeConfig<number>(`SCORE_PRESET_${presetUpper}_CONTENT`),
    getRuntimeConfig<number>(`SCORE_PRESET_${presetUpper}_DELIVERY`),
  ]);

  return { emotion, audio, content, delivery };
}

// Individual preset weight getters
export async function getScorePresetDefaultWeights() {
  return getScorePresetWeights('default');
}

export async function getScorePresetInterviewWeights() {
  return getScorePresetWeights('interview');
}

export async function getScorePresetLanguageWeights() {
  return getScorePresetWeights('language');
}

export async function getScorePresetPresentationWeights() {
  return getScorePresetWeights('presentation');
}

export async function getScorePresetCustomWeights() {
  return getScorePresetWeights('custom');
}
