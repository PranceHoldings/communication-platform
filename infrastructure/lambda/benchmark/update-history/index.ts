import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { prisma } from '../../shared/database/prisma';
import { getRequiredEnv, getAwsRegion } from '../../shared/utils/env-validator';
import { generateProfileHash } from '../../shared/utils/profile-hash';
import { calculateGroupStats } from '../../shared/utils/statistics';
import type { StandardAPIResponse } from '../../shared/types';

const dynamoClient = new DynamoDBClient({ region: getAwsRegion() });
const historyTableName = getRequiredEnv('DYNAMODB_USER_SESSION_HISTORY_TABLE');
const cacheTableName = getRequiredEnv('DYNAMODB_BENCHMARK_CACHE_TABLE');
const TTL_DAYS_HISTORY = parseInt(getRequiredEnv('SESSION_HISTORY_TTL_DAYS'), 10);
const TTL_DAYS_CACHE = parseInt(getRequiredEnv('BENCHMARK_CACHE_TTL_DAYS'), 10);

interface SessionData {
  sessionId: string;
  userId: string;
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

interface UpdateHistoryRequest {
  sessionId: string;
}

/**
 * UpdateSessionHistory Lambda Handler
 *
 * セッション完了時に：
 * 1. UserSessionHistoryに履歴を保存
 * 2. BenchmarkCacheを更新（バッチ処理推奨）
 */
export const handler = async (event: any): Promise<StandardAPIResponse<void>> => {
  console.log('[UpdateSessionHistory] Request:', JSON.stringify(event, null, 2));

  try {
    // リクエストボディをパース
    const request: UpdateHistoryRequest = JSON.parse(event.body || '{}');

    if (!request.sessionId) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'sessionId is required',
        },
      };
    }

    // セッションデータをRDSから取得
    const session = await prisma.session.findUnique({
      where: { id: request.sessionId },
      include: {
        analysis: {
          include: {
            score: true,
          },
        },
        scenario: true,
        user: true,
      },
    });

    if (!session) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Session not found',
        },
      };
    }

    if (!session.analysis || !session.analysis.score) {
      return {
        success: false,
        error: {
          code: 'ANALYSIS_NOT_COMPLETE',
          message: 'Session analysis is not complete yet',
        },
      };
    }

    // セッションデータを構築
    const sessionData: SessionData = {
      sessionId: session.id,
      userId: session.userId,
      scenarioId: session.scenarioId,
      completedAt: session.endedAt?.toISOString() || new Date().toISOString(),
      scores: {
        overallScore: session.analysis.score.overallScore,
        emotionScore: session.analysis.score.emotionScore,
        audioScore: session.analysis.score.audioScore,
        contentScore: session.analysis.score.contentScore,
        deliveryScore: session.analysis.score.deliveryScore,
      },
      duration: session.durationSec || 0,
    };

    console.log('[UpdateSessionHistory] Session data:', {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      scenarioId: sessionData.scenarioId,
    });

    // 1. UserSessionHistoryに保存
    await saveSessionHistory(sessionData);

    // 2. BenchmarkCacheを更新（注：本番環境ではバッチ処理推奨）
    // 現在はリアルタイム更新だが、大量データでは非効率
    // TODO: Phase 4後半でバッチ処理に移行
    await updateBenchmarkCache(sessionData);

    await prisma.$disconnect();

    console.log('[UpdateSessionHistory] Successfully updated history and cache');

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error('[UpdateSessionHistory] Error:', error);
    await prisma.$disconnect();

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update session history',
      },
    };
  }
};

/**
 * UserSessionHistoryテーブルにセッション履歴を保存
 */
async function saveSessionHistory(data: SessionData): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS_HISTORY * 24 * 60 * 60;

  const putCommand = new PutItemCommand({
    TableName: historyTableName,
    Item: marshall({
      userId: data.userId,
      sessionId: data.sessionId,
      scenarioId: data.scenarioId,
      completedAt: data.completedAt,
      overallScore: data.scores.overallScore,
      emotionScore: data.scores.emotionScore,
      audioScore: data.scores.audioScore,
      contentScore: data.scores.contentScore,
      deliveryScore: data.scores.deliveryScore,
      duration: data.duration,
      ttl,
    }),
  });

  await dynamoClient.send(putCommand);
  console.log('[UpdateSessionHistory] Saved to UserSessionHistory');
}

/**
 * BenchmarkCacheテーブルを更新
 *
 * 注意：この実装は簡易版です。
 * 本番環境では、定期的なバッチ処理で全セッションから統計を再計算することを推奨します。
 *
 * 現在の実装：
 * - RDSから同じプロファイルの全セッションを取得
 * - 統計を再計算してDynamoDBに保存
 *
 * 将来の改善案：
 * - EventBridge Schedule で日次バッチ処理
 * - プロファイルごとに並列処理
 * - 増分更新（Welfordアルゴリズム）でメモリ効率化
 */
async function updateBenchmarkCache(data: SessionData): Promise<void> {
  // プロファイルハッシュ生成（ユーザー属性は現在未実装なのでscenarioIdのみ）
  const profileHash = generateProfileHash({ scenarioId: data.scenarioId });

  console.log('[UpdateSessionHistory] Updating benchmark cache for profile:', profileHash);

  // 同じシナリオの全セッションを取得（簡易版）
  // TODO: ユーザー属性も含めたフィルタリング
  const sessions = await prisma.session.findMany({
    where: {
      scenarioId: data.scenarioId,
      status: 'COMPLETED',
      analysis: {
        isNot: null,
      },
    },
    include: {
      analysis: {
        include: {
          score: true,
        },
      },
    },
    take: 1000, // 最大1000件（パフォーマンス考慮）
  });

  console.log(`[UpdateSessionHistory] Found ${sessions.length} sessions for benchmark calculation`);

  if (sessions.length === 0) {
    console.log('[UpdateSessionHistory] No sessions found for benchmark calculation');
    return;
  }

  // 各メトリクスの統計を計算
  const metrics = ['overallScore', 'emotionScore', 'audioScore', 'contentScore', 'deliveryScore'];

  for (const metric of metrics) {
    const values = sessions
      .filter((s) => s.analysis?.score)
      .map((s) => s.analysis!.score![metric as keyof typeof s.analysis.score] as number)
      .filter((v) => v !== null && v !== undefined);

    if (values.length === 0) {
      continue;
    }

    // 統計計算
    const stats = calculateGroupStats(values);

    // BenchmarkCacheに保存
    const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS_CACHE * 24 * 60 * 60;

    const putCommand = new PutItemCommand({
      TableName: cacheTableName,
      Item: marshall({
        profileHash,
        metric,
        mean: stats.mean,
        median: stats.median,
        stdDev: stats.stdDev,
        min: stats.min,
        max: stats.max,
        p25: stats.p25,
        p75: stats.p75,
        sampleSize: stats.sampleSize,
        lastUpdated: new Date().toISOString(),
        ttl,
      }),
    });

    await dynamoClient.send(putCommand);

    console.log(`[UpdateSessionHistory] Updated benchmark cache for metric: ${metric}`, {
      sampleSize: stats.sampleSize,
      mean: stats.mean.toFixed(2),
      stdDev: stats.stdDev.toFixed(2),
    });
  }

  console.log('[UpdateSessionHistory] Benchmark cache updated successfully');
}
