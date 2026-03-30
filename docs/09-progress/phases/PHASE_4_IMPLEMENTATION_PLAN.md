# Phase 4: Benchmark System - 詳細実装計画

**作成日:** 2026-03-20
**推定期間:** 2-3日
**前提条件:** Phase 3完了（環境変数管理システム確立）

---

## 📋 目次

1. [実装概要](#実装概要)
2. [Phase 4.1: DynamoDBスキーマ実装](#phase-41-dynamodbスキーマ実装)
3. [Phase 4.2: 統計計算ロジック](#phase-42-統計計算ロジック)
4. [Phase 4.3: Lambda関数実装](#phase-43-lambda関数実装)
5. [Phase 4.4: APIエンドポイント](#phase-44-apiエンドポイント)
6. [Phase 4.5: フロントエンドUI](#phase-45-フロントエンドui)
7. [Phase 4.6: 成長トラッキング](#phase-46-成長トラッキング)
8. [Phase 4.7: AI改善提案](#phase-47-ai改善提案)
9. [Phase 4.8: テスト・デプロイ](#phase-48-テストデプロイ)

---

## 実装概要

### 目標

プロファイル（シナリオ + ユーザー属性）ごとのベンチマークデータを提供し、ユーザーが自分のパフォーマンスを同条件の他ユーザーと比較できるシステムを構築。

### 主要機能

- **プロファイルベンチマーク**: 同一シナリオ・同一属性グループの統計データ
- **成長トラッキング**: 個人の過去セッションとの比較
- **AI改善提案**: ベンチマークデータに基づくパーソナライズド提案
- **プライバシー保護**: k-anonymity（k≥10）、プロファイルハッシュ化

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Benchmark    │  │ Growth       │  │ AI Insights  │     │
│  │ Dashboard    │  │ Chart        │  │ Panel        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────┬────────────────────────────────────────────────┘
             │ API Calls (GET /benchmark, GET /history)
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Lambda Functions (Node.js 22)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ GetBenchmark │  │ UpdateSession│  │ GenerateAI   │     │
│  │              │  │ History      │  │ Suggestions  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────┬────────────────────────────────────────────────┘
             │ Read/Write
             ▼
┌─────────────────────────────────────────────────────────────┐
│                      DynamoDB Tables                         │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ BenchmarkCache       │  │ UserSessionHistory   │        │
│  │ PK: profileHash      │  │ PK: userId           │        │
│  │ SK: metric           │  │ SK: sessionId        │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 4.1: DynamoDBスキーマ実装

**推定時間:** 2-3時間

### 1. BenchmarkCacheテーブル

**目的:** プロファイルごとの統計データキャッシュ

**スキーマ:**

```typescript
// infrastructure/lib/dynamodb-stack.ts に追加

const benchmarkCacheTable = new dynamodb.Table(this, 'BenchmarkCache', {
  tableName: `${envPrefix}-BenchmarkCache`,
  partitionKey: { name: 'profileHash', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'metric', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  pointInTimeRecovery: true,
  timeToLiveAttribute: 'ttl',
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
});

// GSI: metricによる検索
benchmarkCacheTable.addGlobalSecondaryIndex({
  indexName: 'MetricIndex',
  partitionKey: { name: 'metric', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'profileHash', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

**データ構造:**

```typescript
interface BenchmarkCacheItem {
  profileHash: string;          // PK: SHA256(scenarioId + userAttributes)
  metric: string;               // SK: "overallScore" | "emotionScore" | ...
  mean: number;                 // 平均値
  median: number;               // 中央値
  stdDev: number;               // 標準偏差
  min: number;                  // 最小値
  max: number;                  // 最大値
  p25: number;                  // 第1四分位数
  p75: number;                  // 第3四分位数
  sampleSize: number;           // サンプル数（k-anonymity検証用）
  lastUpdated: string;          // ISO8601形式
  ttl: number;                  // Unix timestamp（7日後）
}
```

### 2. UserSessionHistoryテーブル

**目的:** ユーザーの過去セッション履歴

**スキーマ:**

```typescript
const userSessionHistoryTable = new dynamodb.Table(this, 'UserSessionHistory', {
  tableName: `${envPrefix}-UserSessionHistory`,
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  pointInTimeRecovery: true,
  timeToLiveAttribute: 'ttl',
});

// GSI: scenarioId による検索
userSessionHistoryTable.addGlobalSecondaryIndex({
  indexName: 'ScenarioIndex',
  partitionKey: { name: 'scenarioId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'completedAt', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

**データ構造:**

```typescript
interface UserSessionHistoryItem {
  userId: string;               // PK
  sessionId: string;            // SK
  scenarioId: string;           // GSI PK
  completedAt: string;          // GSI SK (ISO8601)
  overallScore: number;
  emotionScore: number;
  audioScore: number;
  contentScore: number;
  deliveryScore: number;
  duration: number;             // 秒
  ttl: number;                  // 90日後削除
}
```

### 3. CDKデプロイ

```bash
cd infrastructure
npm run deploy:dynamodb
```

**検証:**

```bash
# テーブル作成確認
aws dynamodb list-tables --region us-east-1 | grep Benchmark

# スキーマ確認
aws dynamodb describe-table --table-name Prance-dev-BenchmarkCache --region us-east-1
```

---

## Phase 4.2: 統計計算ロジック

**推定時間:** 2-3時間

### 1. 統計ユーティリティ関数

**ファイル:** `infrastructure/lambda/shared/utils/statistics.ts`

```typescript
/**
 * 統計計算ユーティリティ
 *
 * ベンチマークシステムで使用する統計指標を計算
 */

export interface GroupStats {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  sampleSize: number;
}

/**
 * グループ統計を計算（平均、中央値、標準偏差など）
 */
export function calculateGroupStats(values: number[]): GroupStats {
  if (values.length === 0) {
    throw new Error('Cannot calculate stats for empty array');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // 平均
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  // 中央値
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2
    : sorted[Math.floor(n / 2)]!;

  // 標準偏差
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // 四分位数
  const p25 = percentile(sorted, 25);
  const p75 = percentile(sorted, 75);

  return {
    mean,
    median,
    stdDev,
    min: sorted[0]!,
    max: sorted[n - 1]!,
    p25,
    p75,
    sampleSize: n,
  };
}

/**
 * パーセンタイル計算
 */
function percentile(sortedValues: number[], p: number): number {
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sortedValues[lower]!;
  }

  return sortedValues[lower]! * (1 - weight) + sortedValues[upper]! * weight;
}

/**
 * Z-score計算（標準化スコア）
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * 偏差値計算（日本の教育システムで使用）
 */
export function calculateDeviationValue(value: number, mean: number, stdDev: number): number {
  const zScore = calculateZScore(value, mean, stdDev);
  return 50 + 10 * zScore;
}

/**
 * パーセンタイル順位計算
 */
export function calculatePercentileRank(value: number, allValues: number[]): number {
  const belowCount = allValues.filter(v => v < value).length;
  return (belowCount / allValues.length) * 100;
}

/**
 * Welfordのオンラインアルゴリズム（増分更新）
 * 大量データの平均・分散を効率的に計算
 */
export class OnlineStats {
  private count = 0;
  private mean = 0;
  private m2 = 0;

  update(value: number): void {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  getMean(): number {
    return this.mean;
  }

  getVariance(): number {
    return this.count < 2 ? 0 : this.m2 / this.count;
  }

  getStdDev(): number {
    return Math.sqrt(this.getVariance());
  }
}
```

### 2. プロファイルハッシュ生成

**ファイル:** `infrastructure/lambda/shared/utils/profile-hash.ts`

```typescript
import crypto from 'crypto';

export interface ProfileAttributes {
  scenarioId: string;
  userAge?: number;
  userGender?: string;
  userExperience?: string;
  // 将来拡張可能
}

/**
 * プロファイルハッシュを生成
 *
 * 同一条件のユーザーグループを識別するための一意ハッシュ
 * SHA256を使用してプライバシーを保護
 */
export function generateProfileHash(attributes: ProfileAttributes): string {
  const normalized = {
    scenarioId: attributes.scenarioId,
    age: normalizeAge(attributes.userAge),
    gender: attributes.userGender || 'unknown',
    experience: attributes.userExperience || 'unknown',
  };

  const hashInput = JSON.stringify(normalized, Object.keys(normalized).sort());
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

/**
 * 年齢を年代に正規化（k-anonymity向上）
 */
function normalizeAge(age?: number): string {
  if (!age) return 'unknown';
  if (age < 20) return '10s';
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  if (age < 60) return '50s';
  return '60+';
}
```

### 3. 単体テスト

**ファイル:** `infrastructure/lambda/shared/utils/__tests__/statistics.test.ts`

```typescript
import { calculateGroupStats, calculateZScore, calculateDeviationValue } from '../statistics';

describe('Statistics Utils', () => {
  describe('calculateGroupStats', () => {
    it('calculates correct stats for sample data', () => {
      const values = [60, 70, 75, 80, 85, 90, 95];
      const stats = calculateGroupStats(values);

      expect(stats.mean).toBeCloseTo(79.29, 2);
      expect(stats.median).toBe(80);
      expect(stats.min).toBe(60);
      expect(stats.max).toBe(95);
      expect(stats.sampleSize).toBe(7);
    });
  });

  describe('calculateZScore', () => {
    it('calculates z-score correctly', () => {
      const zScore = calculateZScore(85, 75, 10);
      expect(zScore).toBe(1.0);
    });
  });

  describe('calculateDeviationValue', () => {
    it('calculates deviation value correctly', () => {
      const devValue = calculateDeviationValue(85, 75, 10);
      expect(devValue).toBe(60); // 50 + 10 * 1.0
    });
  });
});
```

---

## Phase 4.3: Lambda関数実装

**推定時間:** 3-4時間

### 1. GetBenchmark Lambda

**ファイル:** `infrastructure/lambda/benchmark/get/index.ts`

```typescript
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { generateProfileHash, type ProfileAttributes } from '../../shared/utils/profile-hash';
import { getRequiredEnv, getAwsRegion } from '../../shared/utils/env-validator';
import type { StandardAPIResponse } from '../../shared/types';

const dynamoClient = new DynamoDBClient({ region: getAwsRegion() });
const tableName = getRequiredEnv('DYNAMODB_BENCHMARK_CACHE_TABLE');
const MIN_SAMPLE_SIZE = 10; // k-anonymity threshold

interface BenchmarkMetric {
  metric: string;
  value: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  zScore: number;
  deviationValue: number;
  percentileRank: number;
}

interface BenchmarkResponse {
  profileHash: string;
  metrics: BenchmarkMetric[];
  sampleSize: number;
  sufficientData: boolean;
}

export const handler = async (event: any): Promise<StandardAPIResponse<BenchmarkResponse>> => {
  try {
    const { scenarioId, userScore } = JSON.parse(event.body || '{}');

    if (!scenarioId || typeof userScore !== 'object') {
      return {
        success: false,
        error: { code: 'INVALID_INPUT', message: 'scenarioId and userScore are required' },
      };
    }

    // プロファイルハッシュ生成
    const profileHash = generateProfileHash({
      scenarioId,
      // TODO: ユーザー属性を追加（年齢、性別、経験レベル等）
    });

    // DynamoDBからベンチマークデータ取得
    const queryCommand = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'profileHash = :ph',
      ExpressionAttributeValues: {
        ':ph': { S: profileHash },
      },
    });

    const result = await dynamoClient.send(queryCommand);

    if (!result.Items || result.Items.length === 0) {
      return {
        success: true,
        data: {
          profileHash,
          metrics: [],
          sampleSize: 0,
          sufficientData: false,
        },
      };
    }

    const benchmarkItems = result.Items.map(item => unmarshall(item));
    const sampleSize = benchmarkItems[0]?.sampleSize || 0;

    // k-anonymity検証
    if (sampleSize < MIN_SAMPLE_SIZE) {
      return {
        success: true,
        data: {
          profileHash,
          metrics: [],
          sampleSize,
          sufficientData: false,
        },
      };
    }

    // メトリクス計算
    const metrics: BenchmarkMetric[] = benchmarkItems.map(item => {
      const userValue = userScore[item.metric] || 0;
      const zScore = (userValue - item.mean) / item.stdDev;
      const deviationValue = 50 + 10 * zScore;

      return {
        metric: item.metric,
        value: userValue,
        mean: item.mean,
        median: item.median,
        stdDev: item.stdDev,
        min: item.min,
        max: item.max,
        p25: item.p25,
        p75: item.p75,
        zScore,
        deviationValue,
        percentileRank: calculatePercentileRank(userValue, item.mean, item.stdDev),
      };
    });

    return {
      success: true,
      data: {
        profileHash,
        metrics,
        sampleSize,
        sufficientData: true,
      },
    };
  } catch (error) {
    console.error('GetBenchmark error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get benchmark data' },
    };
  }
};

function calculatePercentileRank(value: number, mean: number, stdDev: number): number {
  // 正規分布を仮定した近似計算
  const zScore = (value - mean) / stdDev;
  const percentile = 0.5 * (1 + erf(zScore / Math.sqrt(2)));
  return percentile * 100;
}

// Error function approximation
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}
```

### 2. UpdateSessionHistory Lambda

**ファイル:** `infrastructure/lambda/benchmark/update-history/index.ts`

```typescript
import { DynamoDBClient, PutItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getRequiredEnv, getAwsRegion } from '../../shared/utils/env-validator';
import { calculateGroupStats, OnlineStats } from '../../shared/utils/statistics';
import { generateProfileHash } from '../../shared/utils/profile-hash';

const dynamoClient = new DynamoDBClient({ region: getAwsRegion() });
const historyTableName = getRequiredEnv('DYNAMODB_USER_SESSION_HISTORY_TABLE');
const cacheTableName = getRequiredEnv('DYNAMODB_BENCHMARK_CACHE_TABLE');
const TTL_DAYS = 90;

interface SessionData {
  userId: string;
  sessionId: string;
  scenarioId: string;
  completedAt: string;
  scores: {
    overallScore: number;
    emotionScore: number;
    audioScore: number;
    contentScore: number;
    deliveryScore: number;
  };
  duration: number;
}

export const handler = async (event: any): Promise<any> => {
  try {
    const sessionData: SessionData = JSON.parse(event.body || '{}');

    // 1. UserSessionHistoryに保存
    await saveSessionHistory(sessionData);

    // 2. BenchmarkCacheを更新
    await updateBenchmarkCache(sessionData);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('UpdateSessionHistory error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update session history' }),
    };
  }
};

async function saveSessionHistory(data: SessionData): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;

  const putCommand = new PutItemCommand({
    TableName: historyTableName,
    Item: marshall({
      userId: data.userId,
      sessionId: data.sessionId,
      scenarioId: data.scenarioId,
      completedAt: data.completedAt,
      ...data.scores,
      duration: data.duration,
      ttl,
    }),
  });

  await dynamoClient.send(putCommand);
}

async function updateBenchmarkCache(data: SessionData): Promise<void> {
  const profileHash = generateProfileHash({ scenarioId: data.scenarioId });

  // 各メトリクスに対して更新
  const metrics = ['overallScore', 'emotionScore', 'audioScore', 'contentScore', 'deliveryScore'];

  for (const metric of metrics) {
    await updateMetricCache(profileHash, metric, data.scores[metric as keyof typeof data.scores]);
  }
}

async function updateMetricCache(profileHash: string, metric: string, value: number): Promise<void> {
  // 既存データ取得
  const queryCommand = new QueryCommand({
    TableName: cacheTableName,
    KeyConditionExpression: 'profileHash = :ph AND metric = :m',
    ExpressionAttributeValues: marshall({
      ':ph': profileHash,
      ':m': metric,
    }),
  });

  const result = await dynamoClient.send(queryCommand);
  const existingItem = result.Items?.[0] ? unmarshall(result.Items[0]) : null;

  // TODO: 実際の実装ではRDSから全データを取得して再計算
  // ここでは簡略化のためOnlineStatsを使用

  const stats = new OnlineStats();
  if (existingItem) {
    // 既存の統計情報から復元（簡易版）
    stats.update(existingItem.mean);
  }
  stats.update(value);

  const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7日間

  const updateCommand = new PutItemCommand({
    TableName: cacheTableName,
    Item: marshall({
      profileHash,
      metric,
      mean: stats.getMean(),
      median: existingItem?.median || value, // 簡易版
      stdDev: stats.getStdDev(),
      min: Math.min(existingItem?.min || value, value),
      max: Math.max(existingItem?.max || value, value),
      p25: existingItem?.p25 || value,
      p75: existingItem?.p75 || value,
      sampleSize: (existingItem?.sampleSize || 0) + 1,
      lastUpdated: new Date().toISOString(),
      ttl,
    }),
  });

  await dynamoClient.send(updateCommand);
}
```

### 3. Lambda CDKスタック更新

**ファイル:** `infrastructure/lib/api-lambda-stack.ts`

```typescript
// GetBenchmark Lambda追加
const getBenchmarkFunction = new lambda.Function(this, 'GetBenchmarkFunction', {
  runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.ARM_64,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/benchmark/get'), {
    bundling: {
      image: lambda.Runtime.NODEJS_22_X.bundlingImage,
      command: [
        'bash',
        '-c',
        [
          'npm install',
          'npx esbuild index.ts --bundle --platform=node --target=node22 --outfile=/asset-output/index.js',
          'cp package.json /asset-output/',
        ].join(' && '),
      ],
    },
  }),
  timeout: Duration.seconds(30),
  memorySize: 512,
  environment: {
    ...commonEnvVars,
    DYNAMODB_BENCHMARK_CACHE_TABLE: benchmarkCacheTable.tableName,
  },
});

// DynamoDB権限付与
benchmarkCacheTable.grantReadData(getBenchmarkFunction);

// API Gateway統合
api.root.addResource('benchmark').addMethod('POST', new apigateway.LambdaIntegration(getBenchmarkFunction));
```

---

## Phase 4.4: APIエンドポイント

**推定時間:** 1-2時間

### 1. API型定義

**ファイル:** `packages/shared/src/types/benchmark.ts`

```typescript
export interface BenchmarkMetric {
  metric: 'overallScore' | 'emotionScore' | 'audioScore' | 'contentScore' | 'deliveryScore';
  value: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  zScore: number;
  deviationValue: number;
  percentileRank: number;
}

export interface BenchmarkData {
  profileHash: string;
  metrics: BenchmarkMetric[];
  sampleSize: number;
  sufficientData: boolean;
}

export interface SessionHistoryItem {
  sessionId: string;
  scenarioId: string;
  completedAt: string;
  overallScore: number;
  emotionScore: number;
  audioScore: number;
  contentScore: number;
  deliveryScore: number;
  duration: number;
}
```

### 2. APIクライアント実装

**ファイル:** `apps/web/lib/api/benchmark.ts`

```typescript
import { apiClient } from './client';
import type { BenchmarkData, SessionHistoryItem, StandardAPIResponse } from '@prance/shared';

export interface GetBenchmarkRequest {
  scenarioId: string;
  userScore: {
    overallScore: number;
    emotionScore: number;
    audioScore: number;
    contentScore: number;
    deliveryScore: number;
  };
}

export async function getBenchmark(request: GetBenchmarkRequest): Promise<StandardAPIResponse<BenchmarkData>> {
  return apiClient.post<BenchmarkData>('/benchmark', request);
}

export async function getSessionHistory(userId: string, scenarioId?: string): Promise<StandardAPIResponse<SessionHistoryItem[]>> {
  const params = scenarioId ? { scenarioId } : {};
  return apiClient.get<SessionHistoryItem[]>(`/users/${userId}/session-history`, { params });
}
```

---

## Phase 4.5: フロントエンドUI

**推定時間:** 4-5時間

### 1. BenchmarkDashboard コンポーネント

**ファイル:** `apps/web/components/benchmark/BenchmarkDashboard.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getBenchmark } from '@/lib/api/benchmark';
import { useI18n } from '@/lib/i18n/provider';
import type { BenchmarkData } from '@prance/shared';
import { BenchmarkMetricCard } from './BenchmarkMetricCard';
import { BenchmarkRadarChart } from './BenchmarkRadarChart';

interface Props {
  sessionId: string;
  scenarioId: string;
  scores: {
    overallScore: number;
    emotionScore: number;
    audioScore: number;
    contentScore: number;
    deliveryScore: number;
  };
}

export function BenchmarkDashboard({ sessionId, scenarioId, scores }: Props) {
  const { t } = useI18n();
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBenchmark() {
      try {
        const response = await getBenchmark({ scenarioId, userScore: scores });
        if (response.success) {
          setBenchmark(response.data);
        }
      } catch (error) {
        console.error('Failed to load benchmark:', error);
      } finally {
        setLoading(false);
      }
    }

    loadBenchmark();
  }, [sessionId, scenarioId]);

  if (loading) {
    return <div>{t('benchmark.loading')}</div>;
  }

  if (!benchmark || !benchmark.sufficientData) {
    return (
      <Card>
        <CardContent className="p-6">
          <p>{t('benchmark.insufficientData')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('benchmark.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('benchmark.sampleSize', { count: benchmark.sampleSize })}
          </p>
        </CardHeader>
        <CardContent>
          <BenchmarkRadarChart metrics={benchmark.metrics} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {benchmark.metrics.map(metric => (
          <BenchmarkMetricCard key={metric.metric} metric={metric} />
        ))}
      </div>
    </div>
  );
}
```

### 2. BenchmarkMetricCard コンポーネント

**ファイル:** `apps/web/components/benchmark/BenchmarkMetricCard.tsx`

```typescript
'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/i18n/provider';
import type { BenchmarkMetric } from '@prance/shared';

interface Props {
  metric: BenchmarkMetric;
}

export function BenchmarkMetricCard({ metric }: Props) {
  const { t } = useI18n();

  const getPerformanceLevel = (percentile: number) => {
    if (percentile >= 90) return { label: t('benchmark.excellent'), color: 'text-green-600' };
    if (percentile >= 75) return { label: t('benchmark.good'), color: 'text-blue-600' };
    if (percentile >= 50) return { label: t('benchmark.average'), color: 'text-yellow-600' };
    if (percentile >= 25) return { label: t('benchmark.belowAverage'), color: 'text-orange-600' };
    return { label: t('benchmark.needsImprovement'), color: 'text-red-600' };
  };

  const performance = getPerformanceLevel(metric.percentileRank);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t(`benchmark.metrics.${metric.metric}`)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>{t('benchmark.yourScore')}</span>
            <span className="font-bold">{metric.value.toFixed(1)}</span>
          </div>
          <Progress value={metric.value} max={100} />
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('benchmark.average')}</span>
            <span>{metric.mean.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('benchmark.median')}</span>
            <span>{metric.median.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('benchmark.percentile')}</span>
            <span className={performance.color}>
              {metric.percentileRank.toFixed(0)}% ({performance.label})
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. 言語リソース追加

**ファイル:** `apps/web/messages/en/benchmark.json`

```json
{
  "title": "Benchmark Comparison",
  "loading": "Loading benchmark data...",
  "insufficientData": "Not enough data for comparison. Complete more sessions to see your benchmark.",
  "sampleSize": "Compared with {count} users in similar conditions",
  "yourScore": "Your Score",
  "average": "Average",
  "median": "Median",
  "percentile": "Percentile",
  "excellent": "Excellent",
  "good": "Good",
  "average": "Average",
  "belowAverage": "Below Average",
  "needsImprovement": "Needs Improvement",
  "metrics": {
    "overallScore": "Overall Score",
    "emotionScore": "Emotion Control",
    "audioScore": "Voice Quality",
    "contentScore": "Content Quality",
    "deliveryScore": "Delivery Skills"
  }
}
```

**ファイル:** `apps/web/messages/ja/benchmark.json`

```json
{
  "title": "ベンチマーク比較",
  "loading": "ベンチマークデータを読み込み中...",
  "insufficientData": "比較に十分なデータがありません。より多くのセッションを完了してください。",
  "sampleSize": "同条件の{count}名のユーザーと比較",
  "yourScore": "あなたのスコア",
  "average": "平均",
  "median": "中央値",
  "percentile": "パーセンタイル",
  "excellent": "優秀",
  "good": "良好",
  "average": "平均的",
  "belowAverage": "平均以下",
  "needsImprovement": "要改善",
  "metrics": {
    "overallScore": "総合スコア",
    "emotionScore": "感情コントロール",
    "audioScore": "音声品質",
    "contentScore": "内容品質",
    "deliveryScore": "伝達力"
  }
}
```

---

## Phase 4.6: 成長トラッキング

**推定時間:** 2-3時間

### GrowthChart コンポーネント

**ファイル:** `apps/web/components/benchmark/GrowthChart.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getSessionHistory } from '@/lib/api/benchmark';
import { useI18n } from '@/lib/i18n/provider';
import type { SessionHistoryItem } from '@prance/shared';

interface Props {
  userId: string;
  scenarioId: string;
}

export function GrowthChart({ userId, scenarioId }: Props) {
  const { t } = useI18n();
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);

  useEffect(() => {
    async function loadHistory() {
      const response = await getSessionHistory(userId, scenarioId);
      if (response.success) {
        setHistory(response.data);
      }
    }

    loadHistory();
  }, [userId, scenarioId]);

  const chartData = history.map((item, index) => ({
    session: index + 1,
    overall: item.overallScore,
    emotion: item.emotionScore,
    audio: item.audioScore,
    content: item.contentScore,
    delivery: item.deliveryScore,
    date: new Date(item.completedAt).toLocaleDateString(),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('growth.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="session" label={{ value: t('growth.sessionNumber'), position: 'insideBottom', offset: -5 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="overall" stroke="#8884d8" name={t('benchmark.metrics.overallScore')} />
            <Line type="monotone" dataKey="emotion" stroke="#82ca9d" name={t('benchmark.metrics.emotionScore')} />
            <Line type="monotone" dataKey="audio" stroke="#ffc658" name={t('benchmark.metrics.audioScore')} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

## Phase 4.7: AI改善提案

**推定時間:** 2-3時間

### AIInsights コンポーネント

**ファイル:** `apps/web/components/benchmark/AIInsights.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n/provider';
import type { BenchmarkData } from '@prance/shared';

interface Props {
  benchmark: BenchmarkData;
  sessionId: string;
}

interface Insight {
  category: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
}

export function AIInsights({ benchmark, sessionId }: Props) {
  const { t } = useI18n();
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    // AI提案生成（簡易版）
    const generated: Insight[] = [];

    benchmark.metrics.forEach(metric => {
      if (metric.percentileRank < 25) {
        generated.push({
          category: metric.metric,
          priority: 'high',
          message: t('insights.lowPerformance', { metric: t(`benchmark.metrics.${metric.metric}`) }),
          suggestion: t(`insights.suggestions.${metric.metric}`),
        });
      } else if (metric.percentileRank < 50) {
        generated.push({
          category: metric.metric,
          priority: 'medium',
          message: t('insights.belowAverage', { metric: t(`benchmark.metrics.${metric.metric}`) }),
          suggestion: t(`insights.suggestions.${metric.metric}`),
        });
      }
    });

    setInsights(generated);
  }, [benchmark, t]);

  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p>{t('insights.noIssues')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('insights.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight, index) => (
          <div key={index} className="border-l-4 border-yellow-500 pl-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={insight.priority === 'high' ? 'destructive' : 'secondary'}>
                {t(`insights.priority.${insight.priority}`)}
              </Badge>
              <span className="font-semibold">{insight.message}</span>
            </div>
            <p className="text-sm text-muted-foreground">{insight.suggestion}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## Phase 4.8: テスト・デプロイ

**推定時間:** 2-3時間

### 1. 単体テスト

```bash
# 統計ユーティリティテスト
cd infrastructure/lambda/shared/utils
npm test -- statistics.test.ts

# API統合テスト
cd apps/web
npm test -- benchmark.test.ts
```

### 2. E2Eテスト

**ファイル:** `apps/web/tests/e2e/benchmark.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Benchmark System', () => {
  test('displays benchmark comparison', async ({ page }) => {
    await page.goto('/dashboard/sessions/test-session-id');

    // ベンチマークタブクリック
    await page.click('[data-testid="benchmark-tab"]');

    // ベンチマークカード表示確認
    await expect(page.locator('[data-testid="benchmark-card"]')).toBeVisible();

    // メトリクスカード数確認
    const metricCards = page.locator('[data-testid="metric-card"]');
    await expect(metricCards).toHaveCount(5);
  });

  test('shows growth chart', async ({ page }) => {
    await page.goto('/dashboard/sessions/test-session-id');
    await page.click('[data-testid="growth-tab"]');

    // チャート表示確認
    await expect(page.locator('[data-testid="growth-chart"]')).toBeVisible();
  });
});
```

### 3. デプロイ

```bash
# Lambda関数デプロイ
cd infrastructure
npm run deploy:lambda

# Frontend デプロイ
cd apps/web
npm run build
# Amplify auto-deploy (git push)

# DynamoDB テーブルデプロイ
cd infrastructure
npm run deploy:dynamodb
```

### 4. 検証

```bash
# Lambda関数確認
aws lambda list-functions --region us-east-1 | grep Benchmark

# DynamoDB テーブル確認
aws dynamodb list-tables --region us-east-1 | grep Benchmark

# API エンドポイント確認
curl -X POST https://api.app.prance.jp/benchmark \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"scenarioId":"test","userScore":{"overallScore":85}}'
```

---

## 完了条件

- [ ] DynamoDB テーブル作成完了（BenchmarkCache, UserSessionHistory）
- [ ] Lambda関数実装完了（GetBenchmark, UpdateSessionHistory）
- [ ] 統計計算ユーティリティ実装完了
- [ ] プロファイルハッシュ生成実装完了
- [ ] API エンドポイント実装完了
- [ ] フロントエンドUI実装完了（Dashboard, Charts, Insights）
- [ ] 言語リソース追加完了（10言語）
- [ ] 単体テスト実装完了
- [ ] E2Eテスト実装完了
- [ ] AWS dev環境デプロイ完了
- [ ] k-anonymity検証（サンプル数≥10）確認

---

**作成者:** Claude (AI Assistant)
**レビュー待ち:** Phase 4.1実装開始前の最終確認
