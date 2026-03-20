/**
 * 環境変数からランタイム設定への移行スクリプト
 * Phase 5.1: 初期データ投入
 *
 * 実行方法:
 * cd /workspaces/prance-communication-platform
 * npx ts-node scripts/migrate-env-to-runtime-config.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Phase 1: システムパラメータ（緊急度：高）
const INITIAL_RUNTIME_CONFIGS = [
  // Query & Processing
  {
    key: 'MAX_RESULTS',
    value: 1000,
    dataType: 'NUMBER' as const,
    category: 'QUERY_PROCESSING' as const,
    defaultValue: 1000,
    minValue: 1,
    maxValue: 10000,
    description: 'Maximum number of query results',
  },
  {
    key: 'VIDEO_CHUNK_BATCH_SIZE',
    value: 5,
    dataType: 'NUMBER' as const,
    category: 'QUERY_PROCESSING' as const,
    defaultValue: 5,
    minValue: 1,
    maxValue: 100,
    description: 'Video chunk batch size for processing',
  },
  {
    key: 'ANALYSIS_BATCH_SIZE',
    value: 10,
    dataType: 'NUMBER' as const,
    category: 'QUERY_PROCESSING' as const,
    defaultValue: 10,
    minValue: 1,
    maxValue: 100,
    description: 'Analysis batch size',
  },

  // AI Processing
  {
    key: 'CLAUDE_TEMPERATURE',
    value: 0.7,
    dataType: 'NUMBER' as const,
    category: 'AI_PROCESSING' as const,
    defaultValue: 0.7,
    minValue: 0.0,
    maxValue: 1.0,
    description: 'Claude AI temperature (creativity vs consistency)',
  },
  {
    key: 'CLAUDE_MAX_TOKENS',
    value: 1024,
    dataType: 'NUMBER' as const,
    category: 'AI_PROCESSING' as const,
    defaultValue: 1024,
    minValue: 128,
    maxValue: 4096,
    description: 'Claude AI max tokens for response',
  },
  {
    key: 'MAX_AUTO_DETECT_LANGUAGES',
    value: 3,
    dataType: 'NUMBER' as const,
    category: 'AI_PROCESSING' as const,
    defaultValue: 3,
    minValue: 1,
    maxValue: 10,
    description: 'Maximum number of languages for STT auto-detection',
  },

  // Security
  {
    key: 'RATE_LIMIT_MAX_ATTEMPTS',
    value: 5,
    dataType: 'NUMBER' as const,
    category: 'SECURITY' as const,
    defaultValue: 5,
    minValue: 1,
    maxValue: 100,
    description: 'Maximum number of failed attempts before lockout',
  },
  {
    key: 'RATE_LIMIT_LOCKOUT_DURATION_MS',
    value: 900000,
    dataType: 'NUMBER' as const,
    category: 'SECURITY' as const,
    defaultValue: 900000,
    minValue: 60000,
    maxValue: 3600000,
    description: 'Lockout duration in milliseconds (default: 15 minutes)',
  },
  {
    key: 'BCRYPT_SALT_ROUNDS',
    value: 10,
    dataType: 'NUMBER' as const,
    category: 'SECURITY' as const,
    defaultValue: 10,
    minValue: 8,
    maxValue: 12,
    description: 'Bcrypt salt rounds for password hashing',
  },

  // Score Calculation
  {
    key: 'MIN_CONFIDENCE_THRESHOLD',
    value: 70,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    defaultValue: 70,
    minValue: 0,
    maxValue: 100,
    description: 'Minimum confidence threshold for score calculation',
  },
  {
    key: 'MIN_QUALITY_THRESHOLD',
    value: 60,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    defaultValue: 60,
    minValue: 0,
    maxValue: 100,
    description: 'Minimum quality threshold',
  },
  {
    key: 'EMOTION_WEIGHT',
    value: 0.25,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    defaultValue: 0.25,
    minValue: 0.0,
    maxValue: 1.0,
    description: 'Weight for emotion score (sum of all weights must be 1.0)',
  },
  {
    key: 'AUDIO_WEIGHT',
    value: 0.25,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    defaultValue: 0.25,
    minValue: 0.0,
    maxValue: 1.0,
    description: 'Weight for audio score (sum of all weights must be 1.0)',
  },
  {
    key: 'CONTENT_WEIGHT',
    value: 0.25,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    defaultValue: 0.25,
    minValue: 0.0,
    maxValue: 1.0,
    description: 'Weight for content score (sum of all weights must be 1.0)',
  },
  {
    key: 'DELIVERY_WEIGHT',
    value: 0.25,
    dataType: 'NUMBER' as const,
    category: 'SCORE_CALCULATION' as const,
    defaultValue: 0.25,
    minValue: 0.0,
    maxValue: 1.0,
    description: 'Weight for delivery score (sum of all weights must be 1.0)',
  },
];

async function main() {
  console.log('🚀 Starting runtime configuration migration...\n');

  for (const config of INITIAL_RUNTIME_CONFIGS) {
    console.log(`  ⏳ Inserting: ${config.key} (${config.category})`);

    try {
      await prisma.runtimeConfig.upsert({
        where: { key: config.key },
        update: {
          value: config.value,
          dataType: config.dataType,
          category: config.category,
          defaultValue: config.defaultValue,
          minValue: config.minValue,
          maxValue: config.maxValue,
          description: config.description,
        },
        create: {
          key: config.key,
          value: config.value,
          dataType: config.dataType,
          category: config.category,
          defaultValue: config.defaultValue,
          minValue: config.minValue,
          maxValue: config.maxValue,
          description: config.description,
        },
      });

      console.log(`  ✅ Success: ${config.key}\n`);
    } catch (error) {
      console.error(`  ❌ Error: ${config.key}`, error);
    }
  }

  console.log('✅ Runtime configuration migration completed!\n');

  // サマリー表示
  console.log('📊 Summary:');
  const categories = await prisma.runtimeConfig.groupBy({
    by: ['category'],
    _count: true,
  });

  for (const cat of categories) {
    console.log(`  - ${cat.category}: ${cat._count} configs`);
  }

  console.log(`\n  Total: ${INITIAL_RUNTIME_CONFIGS.length} configs\n`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
