/**
 * Memory-Safe Cache Hook using WeakMap
 * Phase 1.6: Performance Optimization - Memory Leak Prevention
 */

'use client';

import { useRef, useCallback, useEffect } from 'react';

interface CacheOptions<T = unknown> {
  maxSize?: number; // Maximum number of entries (default: 100)
  ttl?: number; // Time-to-live in milliseconds (default: 5 minutes)
  onEvict?: (key: string, value: T) => void; // Callback when entry is evicted
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  size: number; // Approximate size in bytes
}

const DEFAULT_OPTIONS: Required<CacheOptions> = {
  maxSize: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
  onEvict: () => {},
};

/**
 * Memory-safe cache with automatic cleanup and size limits
 * Uses WeakMap for object references and regular Map for primitive keys
 */
export function useMemorySafeCache<K extends object, V>(options: CacheOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // WeakMap for object keys (automatic GC)
  const weakCache = useRef(new WeakMap<K, CacheEntry<V>>());

  // Map for primitive keys (manual cleanup needed)
  const strongCache = useRef(new Map<string, CacheEntry<V>>());

  // Track insertion order for LRU eviction
  const accessOrder = useRef<string[]>([]);

  // Statistics
  const stats = useRef({
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
  });

  /**
   * Estimate size of value in bytes
   */
  const estimateSize = useCallback((value: V): number => {
    try {
      const jsonString = JSON.stringify(value);
      return jsonString.length * 2; // UTF-16 chars are 2 bytes
    } catch {
      return 100; // Default estimate for non-serializable objects
    }
  }, []);

  /**
   * Evict oldest entries if cache exceeds maxSize
   */
  const evictOldest = useCallback(() => {
    while (accessOrder.current.length > config.maxSize) {
      const oldestKey = accessOrder.current.shift();
      if (!oldestKey) break;

      const entry = strongCache.current.get(oldestKey);
      if (entry) {
        strongCache.current.delete(oldestKey);
        stats.current.evictions++;
        stats.current.totalSize -= entry.size;
        config.onEvict(oldestKey, entry.value);
      }
    }
  }, [config]);

  /**
   * Clean up expired entries
   */
  const cleanupExpired = useCallback(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    strongCache.current.forEach((entry, key) => {
      if (now - entry.timestamp > config.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      const entry = strongCache.current.get(key);
      if (entry) {
        strongCache.current.delete(key);
        stats.current.evictions++;
        stats.current.totalSize -= entry.size;
        config.onEvict(key, entry.value);

        // Remove from access order
        const index = accessOrder.current.indexOf(key);
        if (index !== -1) {
          accessOrder.current.splice(index, 1);
        }
      }
    });

    if (keysToDelete.length > 0) {
      console.log(`[MemorySafeCache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }, [config]);

  /**
   * Get value from cache
   */
  const get = useCallback(
    (key: K | string): V | undefined => {
      // Try WeakMap for object keys
      if (typeof key === 'object' && key !== null) {
        const entry = weakCache.current.get(key);
        if (entry) {
          // Check TTL
          if (Date.now() - entry.timestamp <= config.ttl) {
            stats.current.hits++;
            return entry.value;
          } else {
            // Expired - will be GC'd automatically
            stats.current.misses++;
            return undefined;
          }
        }
      }

      // Try Map for primitive keys
      if (typeof key === 'string') {
        const entry = strongCache.current.get(key);
        if (entry) {
          // Check TTL
          if (Date.now() - entry.timestamp <= config.ttl) {
            stats.current.hits++;

            // Update access order (LRU)
            const index = accessOrder.current.indexOf(key);
            if (index !== -1) {
              accessOrder.current.splice(index, 1);
            }
            accessOrder.current.push(key);

            return entry.value;
          } else {
            // Expired - clean up
            strongCache.current.delete(key);
            stats.current.evictions++;
            stats.current.totalSize -= entry.size;
          }
        }
      }

      stats.current.misses++;
      return undefined;
    },
    [config.ttl]
  );

  /**
   * Set value in cache
   */
  const set = useCallback(
    (key: K | string, value: V): void => {
      const size = estimateSize(value);
      const entry: CacheEntry<V> = {
        value,
        timestamp: Date.now(),
        size,
      };

      // Use WeakMap for object keys
      if (typeof key === 'object' && key !== null) {
        weakCache.current.set(key, entry);
        return;
      }

      // Use Map for primitive keys
      if (typeof key === 'string') {
        // Remove old entry if exists
        const oldEntry = strongCache.current.get(key);
        if (oldEntry) {
          stats.current.totalSize -= oldEntry.size;
        }

        strongCache.current.set(key, entry);
        stats.current.totalSize += size;

        // Update access order
        const index = accessOrder.current.indexOf(key);
        if (index !== -1) {
          accessOrder.current.splice(index, 1);
        }
        accessOrder.current.push(key);

        // Evict if necessary
        evictOldest();
      }
    },
    [estimateSize, evictOldest]
  );

  /**
   * Check if key exists in cache (without updating access)
   */
  const has = useCallback(
    (key: K | string): boolean => {
      if (typeof key === 'object' && key !== null) {
        const entry = weakCache.current.get(key);
        return entry !== undefined && Date.now() - entry.timestamp <= config.ttl;
      }

      if (typeof key === 'string') {
        const entry = strongCache.current.get(key);
        return entry !== undefined && Date.now() - entry.timestamp <= config.ttl;
      }

      return false;
    },
    [config.ttl]
  );

  /**
   * Delete entry from cache
   */
  const del = useCallback((key: K | string): boolean => {
    if (typeof key === 'object' && key !== null) {
      // Cannot delete from WeakMap - will be GC'd automatically
      return false;
    }

    if (typeof key === 'string') {
      const entry = strongCache.current.get(key);
      if (entry) {
        strongCache.current.delete(key);
        stats.current.totalSize -= entry.size;

        const index = accessOrder.current.indexOf(key);
        if (index !== -1) {
          accessOrder.current.splice(index, 1);
        }

        return true;
      }
    }

    return false;
  }, []);

  /**
   * Clear all cache entries
   */
  const clear = useCallback(() => {
    weakCache.current = new WeakMap<K, CacheEntry<V>>();
    strongCache.current.clear();
    accessOrder.current = [];
    stats.current = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
    };
    console.log('[MemorySafeCache] Cache cleared');
  }, []);

  /**
   * Get cache statistics
   */
  const getStats = useCallback(() => {
    const hitRate =
      stats.current.hits + stats.current.misses > 0
        ? (stats.current.hits / (stats.current.hits + stats.current.misses)) * 100
        : 0;

    return {
      hits: stats.current.hits,
      misses: stats.current.misses,
      hitRate: hitRate.toFixed(2) + '%',
      evictions: stats.current.evictions,
      size: strongCache.current.size,
      totalSizeBytes: stats.current.totalSize,
      totalSizeKB: (stats.current.totalSize / 1024).toFixed(2),
    };
  }, []);

  // Auto cleanup expired entries
  useEffect(() => {
    const intervalId = setInterval(() => {
      cleanupExpired();
    }, 60000); // Every 1 minute

    return () => clearInterval(intervalId);
  }, [cleanupExpired]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  return {
    get,
    set,
    has,
    delete: del,
    clear,
    getStats,
  };
}
