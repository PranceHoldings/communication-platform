/**
 * ElastiCache (Redis) Client
 * Phase 5: Runtime Configuration Management
 *
 * Purpose: Cache layer for runtime configuration
 * - TTL: 60 seconds
 * - Target hit rate: 99%+
 */

import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const elasticacheEndpoint = process.env.ELASTICACHE_ENDPOINT;
  if (!elasticacheEndpoint) {
    throw new Error('ELASTICACHE_ENDPOINT environment variable is not set');
  }

  redisClient = createClient({
    url: `redis://${elasticacheEndpoint}:6379`,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          console.error('Redis connection failed after 3 retries');
          return new Error('Max retries reached');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('Redis Client Connected');
  });

  await redisClient.connect();

  return redisClient;
}

/**
 * Get value from Redis cache
 */
export async function getCacheValue<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    const value = await client.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Error getting cache value for key: ${key}`, error);
    return null;
  }
}

/**
 * Set value in Redis cache
 */
export async function setCacheValue(
  key: string,
  value: any,
  ttlSeconds: number = 60
): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting cache value for key: ${key}`, error);
    // Don't throw - cache failure should not break the application
  }
}

/**
 * Delete value from Redis cache
 */
export async function deleteCacheValue(key: string): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.del(key);
  } catch (error) {
    console.error(`Error deleting cache value for key: ${key}`, error);
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    console.error('Redis is not available:', error);
    return false;
  }
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
}
