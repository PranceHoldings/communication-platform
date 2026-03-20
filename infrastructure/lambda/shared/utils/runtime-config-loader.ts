/**
 * Runtime Configuration Loader
 * Phase 5: Runtime Configuration Management
 *
 * 3-tier caching architecture:
 * 1. Lambda memory cache (TTL: 10 seconds) - Fastest
 * 2. ElastiCache Redis (TTL: 60 seconds) - Fast
 * 3. Aurora RDS (permanent storage) - Source of truth
 * 4. Environment variable fallback (for backward compatibility)
 */

import { prisma } from '../database/prisma';
import { getCacheValue, setCacheValue } from './elasticache-client';
import { getRequiredEnv } from './env-validator';

// Lambda memory cache
interface CacheEntry {
  value: any;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry>();

// Memory cache TTL: 10 seconds
const MEMORY_CACHE_TTL_MS = 10_000;

// ElastiCache TTL: 60 seconds
const ELASTICACHE_TTL_SECONDS = 60;

/**
 * Get runtime configuration value with 3-tier caching
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

  // Layer 2: ElastiCache Redis (fast)
  if (!skipCache) {
    try {
      const redisValue = await getCacheValue<T>(`runtime:${key}`);
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
      console.error(`[RuntimeConfig] Redis error for key ${key}:`, error);
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
      const value = config.value as T;
      console.log(`[RuntimeConfig] Database hit: ${key}`);

      // Update both caches
      if (!skipCache) {
        // ElastiCache
        await setCacheValue(`runtime:${key}`, value, ELASTICACHE_TTL_SECONDS);
        // Memory cache
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

// Score Calculation
export async function getMinConfidenceThreshold(): Promise<number> {
  return getRuntimeConfig<number>('MIN_CONFIDENCE_THRESHOLD');
}

export async function getMinQualityThreshold(): Promise<number> {
  return getRuntimeConfig<number>('MIN_QUALITY_THRESHOLD');
}

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
