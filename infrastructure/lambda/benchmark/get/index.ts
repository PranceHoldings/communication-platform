import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { generateProfileHash, type ProfileAttributes } from '../../shared/utils/profile-hash';
import { calculatePercentileRankFromStats } from '../../shared/utils/statistics';
import { getRequiredEnv, getAwsRegion } from '../../shared/utils/env-validator';
import type { StandardAPIResponse } from '../../shared/types';

const dynamoClient = new DynamoDBClient({ region: getAwsRegion() });
const tableName = getRequiredEnv('DYNAMODB_BENCHMARK_CACHE_TABLE');
const MIN_SAMPLE_SIZE = parseInt(getRequiredEnv('MIN_SAMPLE_SIZE'), 10);

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

interface GetBenchmarkRequest {
  scenarioId: string;
  userScore: {
    overallScore?: number;
    emotionScore?: number;
    audioScore?: number;
    contentScore?: number;
    deliveryScore?: number;
  };
  userAttributes?: {
    age?: number;
    gender?: string;
    experience?: string;
    industry?: string;
    role?: string;
  };
}

/**
 * GetBenchmark Lambda Handler
 *
 * プロファイルベンチマークデータを取得し、ユーザースコアと比較
 */
export const handler = async (event: any): Promise<StandardAPIResponse<BenchmarkResponse>> => {
  console.log('[GetBenchmark] Request:', JSON.stringify(event, null, 2));

  try {
    // リクエストボディをパース
    const request: GetBenchmarkRequest = JSON.parse(event.body || '{}');

    // 入力検証
    if (!request.scenarioId || typeof request.userScore !== 'object') {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'scenarioId and userScore are required',
        },
      };
    }

    // プロファイル属性を構築
    const profileAttributes: ProfileAttributes = {
      scenarioId: request.scenarioId,
      userAge: request.userAttributes?.age,
      userGender: request.userAttributes?.gender,
      userExperience: request.userAttributes?.experience,
      userIndustry: request.userAttributes?.industry,
      userRole: request.userAttributes?.role,
    };

    // プロファイルハッシュ生成
    const profileHash = generateProfileHash(profileAttributes);
    console.log('[GetBenchmark] Profile hash:', profileHash);

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
      console.log('[GetBenchmark] No benchmark data found for profile');
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

    const benchmarkItems = result.Items.map((item) => unmarshall(item));
    const sampleSize = benchmarkItems[0]?.sampleSize || 0;

    console.log('[GetBenchmark] Benchmark data found:', {
      profileHash,
      itemCount: benchmarkItems.length,
      sampleSize,
    });

    // k-anonymity検証
    if (sampleSize < MIN_SAMPLE_SIZE) {
      console.log(`[GetBenchmark] Insufficient sample size: ${sampleSize} < ${MIN_SAMPLE_SIZE}`);
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
    const metrics: BenchmarkMetric[] = benchmarkItems
      .map((item) => {
        const metricName = item.metric as string;
        const userValue = request.userScore[metricName as keyof typeof request.userScore];

        // ユーザースコアが存在しない場合はスキップ
        if (userValue === undefined || userValue === null) {
          return null;
        }

        const mean = item.mean as number;
        const stdDev = item.stdDev as number;

        // Z-score計算
        const zScore = stdDev === 0 ? 0 : (userValue - mean) / stdDev;

        // 偏差値計算
        const deviationValue = 50 + 10 * zScore;

        // パーセンタイル順位計算（正規分布を仮定）
        const percentileRank = calculatePercentileRankFromStats(userValue, mean, stdDev);

        return {
          metric: metricName,
          value: userValue,
          mean,
          median: item.median as number,
          stdDev,
          min: item.min as number,
          max: item.max as number,
          p25: item.p25 as number,
          p75: item.p75 as number,
          zScore,
          deviationValue,
          percentileRank,
        };
      })
      .filter((metric): metric is BenchmarkMetric => metric !== null);

    console.log('[GetBenchmark] Calculated metrics:', metrics.length);

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
    console.error('[GetBenchmark] Error:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get benchmark data',
      },
    };
  }
};
