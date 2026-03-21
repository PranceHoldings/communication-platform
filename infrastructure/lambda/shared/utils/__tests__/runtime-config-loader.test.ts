/**
 * Runtime Config Loader Tests
 * Phase 5.3: Test 2-tier caching system
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getRuntimeConfig,
  clearMemoryCache,
  clearAllMemoryCache,
  getCacheStats,
  getMaxResults,
  getClaudeTemperature,
} from '../runtime-config-loader';

// Mock Prisma client
jest.mock('../../database/prisma', () => ({
  prisma: {
    runtimeConfig: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Import mocked prisma
import { prisma } from '../../database/prisma';

describe('RuntimeConfigLoader', () => {
  beforeEach(() => {
    // Clear all caches before each test
    clearAllMemoryCache();
    jest.clearAllMocks();

    // Reset ElastiCache availability (not configured in test)
    delete process.env.ELASTICACHE_ENDPOINT;
  });

  describe('getRuntimeConfig', () => {
    it('should load NUMBER type from database', async () => {
      // Mock database response
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: '1000',
        dataType: 'NUMBER',
      });

      const result = await getRuntimeConfig<number>('MAX_RESULTS');

      expect(result).toBe(1000);
      expect(prisma.runtimeConfig.findUnique).toHaveBeenCalledWith({
        where: { key: 'MAX_RESULTS' },
        select: { value: true, dataType: true },
      });
    });

    it('should load STRING type from database', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: 'test-value',
        dataType: 'STRING',
      });

      const result = await getRuntimeConfig<string>('TEST_KEY');

      expect(result).toBe('test-value');
    });

    it('should load BOOLEAN type from database', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: 'true',
        dataType: 'BOOLEAN',
      });

      const result = await getRuntimeConfig<boolean>('TEST_BOOL');

      expect(result).toBe(true);
    });

    it('should load JSON type from database', async () => {
      const jsonValue = { key: 'value', nested: { data: 123 } };
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: jsonValue,
        dataType: 'JSON',
      });

      const result = await getRuntimeConfig<any>('TEST_JSON');

      expect(result).toEqual(jsonValue);
    });

    it('should use memory cache on second call', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: '1000',
        dataType: 'NUMBER',
      });

      // First call - should hit database
      const result1 = await getRuntimeConfig<number>('MAX_RESULTS');
      expect(result1).toBe(1000);
      expect(prisma.runtimeConfig.findUnique).toHaveBeenCalledTimes(1);

      // Second call - should hit memory cache
      const result2 = await getRuntimeConfig<number>('MAX_RESULTS');
      expect(result2).toBe(1000);
      expect(prisma.runtimeConfig.findUnique).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should fallback to environment variable if useEnvFallback=true', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue(null);
      process.env.TEST_KEY = '500';

      const result = await getRuntimeConfig<number>('TEST_KEY', { useEnvFallback: true });

      expect(result).toBe(500);
    });

    it('should throw error if config not found and no fallback', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        getRuntimeConfig<number>('NONEXISTENT_KEY', { useEnvFallback: false })
      ).rejects.toThrow('Runtime configuration not found: NONEXISTENT_KEY');
    });

    it('should skip cache if skipCache=true', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: '1000',
        dataType: 'NUMBER',
      });

      // First call with skipCache=false (default)
      await getRuntimeConfig<number>('MAX_RESULTS');
      expect(prisma.runtimeConfig.findUnique).toHaveBeenCalledTimes(1);

      // Second call with skipCache=true - should hit database again
      await getRuntimeConfig<number>('MAX_RESULTS', { skipCache: true });
      expect(prisma.runtimeConfig.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('Typed getters', () => {
    it('should call getMaxResults', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: '1000',
        dataType: 'NUMBER',
      });

      const result = await getMaxResults();

      expect(result).toBe(1000);
      expect(prisma.runtimeConfig.findUnique).toHaveBeenCalledWith({
        where: { key: 'MAX_RESULTS' },
        select: { value: true, dataType: true },
      });
    });

    it('should call getClaudeTemperature', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: '0.7',
        dataType: 'NUMBER',
      });

      const result = await getClaudeTemperature();

      expect(result).toBe(0.7);
    });
  });

  describe('Cache management', () => {
    it('should clear specific key from memory cache', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: '1000',
        dataType: 'NUMBER',
      });

      // Load into cache
      await getRuntimeConfig<number>('MAX_RESULTS');
      expect((await getCacheStats()).memoryCacheSize).toBe(1);

      // Clear specific key
      clearMemoryCache('MAX_RESULTS');
      expect((await getCacheStats()).memoryCacheSize).toBe(0);
    });

    it('should clear all memory cache', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: '1000',
        dataType: 'NUMBER',
      });

      // Load multiple keys
      await getRuntimeConfig<number>('KEY1');
      await getRuntimeConfig<number>('KEY2');
      expect((await getCacheStats()).memoryCacheSize).toBe(2);

      // Clear all
      clearAllMemoryCache();
      expect((await getCacheStats()).memoryCacheSize).toBe(0);
    });

    it('should return cache statistics', async () => {
      (prisma.runtimeConfig.findUnique as jest.Mock).mockResolvedValue({
        value: '1000',
        dataType: 'NUMBER',
      });

      await getRuntimeConfig<number>('KEY1');
      await getRuntimeConfig<number>('KEY2');

      const stats = await getCacheStats();

      expect(stats.memoryCacheSize).toBe(2);
      expect(stats.memoryCacheKeys).toContain('KEY1');
      expect(stats.memoryCacheKeys).toContain('KEY2');
      expect(stats.elasticacheAvailable).toBe(false); // Not configured in test
    });
  });
});
