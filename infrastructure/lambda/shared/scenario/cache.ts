/**
 * Scenario Cache Manager
 * Phase 1.6.1 Day 36: シナリオキャッシュ実装
 *
 * DynamoDBを使用したシナリオ設定のキャッシュ管理
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { getRequiredEnv } from '../utils/env-validator';

const AWS_REGION = getRequiredEnv('AWS_REGION');
const SCENARIO_CACHE_TABLE = getRequiredEnv('DYNAMODB_SCENARIO_CACHE_TABLE');
const CACHE_TTL_DAYS = parseInt(getRequiredEnv('SCENARIO_CACHE_TTL_DAYS'), 10);

// DynamoDB Client
const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

export interface CachedScenario {
  scenarioId: string;
  title: string;
  systemPrompt: string;
  language: string;
  visibility?: string;
  initialGreeting?: string;
  variables?: Record<string, VariableDefinition>;
  conversationFlow?: unknown;
  // Scenario-level silence overrides (null = use org default)
  showSilenceTimer?: boolean | null;
  enableSilencePrompt?: boolean | null;
  silenceTimeout?: number | null;
  silencePromptTimeout?: number | null;
  silenceThreshold?: number | null;
  minSilenceDuration?: number | null;
  cachedAt: number;
  ttl: number;
}

export interface VariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean';
  defaultValue?: string | number | boolean;
  required?: boolean;
  description?: string;
}

/**
 * Get scenario from cache
 */
export async function getScenarioFromCache(
  scenarioId: string
): Promise<CachedScenario | null> {
  try {
    console.log('[ScenarioCache] Getting from cache:', scenarioId);

    const response = await docClient.send(
      new GetCommand({
        TableName: SCENARIO_CACHE_TABLE,
        Key: { scenarioId },
      })
    );

    if (!response.Item) {
      console.log('[ScenarioCache] Cache miss:', scenarioId);
      return null;
    }

    // Check if cache is expired (additional check beyond DynamoDB TTL)
    const cachedScenario = response.Item as CachedScenario;
    const now = Math.floor(Date.now() / 1000);

    if (cachedScenario.ttl && cachedScenario.ttl < now) {
      console.log('[ScenarioCache] Cache expired:', scenarioId);
      return null;
    }

    console.log('[ScenarioCache] Cache hit:', {
      scenarioId,
      cachedAt: new Date(cachedScenario.cachedAt).toISOString(),
    });

    return cachedScenario;
  } catch (error) {
    console.error('[ScenarioCache] Error getting from cache:', error);
    return null;
  }
}

/**
 * Save scenario to cache
 */
export async function saveScenarioToCache(scenario: CachedScenario): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const ttl = now + CACHE_TTL_DAYS * 24 * 60 * 60;

    const item: CachedScenario = {
      ...scenario,
      cachedAt: Date.now(),
      ttl,
    };

    console.log('[ScenarioCache] Saving to cache:', {
      scenarioId: scenario.scenarioId,
      ttl: new Date(ttl * 1000).toISOString(),
    });

    await docClient.send(
      new PutCommand({
        TableName: SCENARIO_CACHE_TABLE,
        Item: item,
      })
    );

    console.log('[ScenarioCache] Cache saved:', scenario.scenarioId);
  } catch (error) {
    console.error('[ScenarioCache] Error saving to cache:', error);
    // Non-blocking: cache failures should not break the main flow
  }
}

/**
 * Invalidate scenario cache
 */
export async function invalidateScenarioCache(scenarioId: string): Promise<void> {
  try {
    console.log('[ScenarioCache] Invalidating cache:', scenarioId);

    await docClient.send(
      new DeleteCommand({
        TableName: SCENARIO_CACHE_TABLE,
        Key: { scenarioId },
      })
    );

    console.log('[ScenarioCache] Cache invalidated:', scenarioId);
  } catch (error) {
    console.error('[ScenarioCache] Error invalidating cache:', error);
    // Non-blocking
  }
}

/**
 * Get scenario with cache-aside pattern
 * 1. Try to get from cache
 * 2. If miss, fetch from database
 * 3. Save to cache
 */
export async function getScenarioWithCache(
  scenarioId: string,
  fetchFromDatabase: () => Promise<CachedScenario>
): Promise<CachedScenario> {
  // Try cache first
  const cached = await getScenarioFromCache(scenarioId);
  if (cached) {
    return cached;
  }

  // Cache miss: fetch from database
  console.log('[ScenarioCache] Fetching from database:', scenarioId);
  const scenario = await fetchFromDatabase();

  // Save to cache (non-blocking)
  saveScenarioToCache(scenario).catch(error => {
    console.error('[ScenarioCache] Failed to save to cache:', error);
  });

  return scenario;
}
