/**
 * Database Mutation Lambda Function
 *
 * Executes INSERT/UPDATE/DELETE queries on RDS Aurora.
 *
 * Security:
 * - Direct SQL only allowed in dev environment
 * - Preset queries for production use
 * - Transaction support
 * - Dry-run mode for validation
 * - Full audit logging
 *
 * Usage:
 * aws lambda invoke \
 *   --function-name prance-db-mutation-dev \
 *   --payload '{"mode":"direct","sql":"INSERT ..."}' \
 *   result.json
 */

import { Handler } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// Types
// ============================================================

type ExecutionMode = 'dry-run' | 'execute';
type QueryMode = 'direct' | 'preset' | 'transaction';

interface DirectQueryPayload {
  mode: 'direct';
  executionMode?: ExecutionMode;
  sql: string;
}

interface PresetQueryPayload {
  mode: 'preset';
  executionMode?: ExecutionMode;
  queryId: string;
  params?: Record<string, any>;
}

interface TransactionPayload {
  mode: 'transaction';
  executionMode?: ExecutionMode;
  queries: Array<{ sql: string; params?: Record<string, any> }>;
}

type MutationPayload = DirectQueryPayload | PresetQueryPayload | TransactionPayload;

interface MutationResponse {
  success: boolean;
  mode: QueryMode;
  executionMode: ExecutionMode;
  rowsAffected?: number;
  results?: any[];
  executionTime: number;
  query?: string;
  error?: string;
  auditLog: AuditLog;
}

interface AuditLog {
  timestamp: string;
  environment: string;
  mode: QueryMode;
  executionMode: ExecutionMode;
  queryPreview: string;
  rowsAffected: number;
  executionTime: number;
  success: boolean;
  error?: string;
}

// ============================================================
// Preset Queries
// ============================================================

const PRESET_QUERIES: Record<string, string> = {
  'seed-test-recording': `
    -- Seed Test Recording Data
    INSERT INTO recordings (
      id, session_id, type, s3_key, s3_url, cdn_url,
      file_size_bytes, duration_sec, format, resolution,
      video_chunks_count, processing_status, processed_at, created_at
    ) VALUES (
      gen_random_uuid(),
      $1,  -- sessionId
      'COMBINED',
      'recordings/' || $1 || '/combined-test.webm',
      'https://prance-dev-recordings.s3.us-east-1.amazonaws.com/recordings/' || $1 || '/combined-test.webm',
      'https://' || $2 || '/recordings/' || $1 || '/combined-test.webm',  -- cdnDomain
      5242880, 120, 'webm', '1280x720', 24,
      'COMPLETED', NOW(), NOW()
    ) ON CONFLICT DO NOTHING;
  `,

  'seed-test-transcripts': `
    -- Seed Test Transcripts
    INSERT INTO transcripts (id, session_id, speaker, text, timestamp_start, timestamp_end, confidence) VALUES
    (gen_random_uuid(), $1, 'AI', 'こんにちは。今日は面接にお越しいただき、ありがとうございます。まず自己紹介をお願いします。', 0.5, 6.2, 0.95),
    (gen_random_uuid(), $1, 'USER', 'はい、よろしくお願いします。私は5年間ソフトウェアエンジニアとして働いており、特にWebアプリケーション開発が得意です。', 7.0, 15.5, 0.92),
    (gen_random_uuid(), $1, 'AI', 'ありがとうございます。それでは、あなたの強みについて教えてください。', 16.0, 20.8, 0.96),
    (gen_random_uuid(), $1, 'USER', '私の強みは、新しい技術を素早く学習し、チームと協力して問題を解決できることです。', 21.5, 29.2, 0.89)
    ON CONFLICT DO NOTHING;
  `,

  'seed-test-score': `
    -- Seed Test Session Score
    INSERT INTO session_scores (
      id, session_id, overall_score, emotion_score, audio_score, content_score, delivery_score,
      emotion_stability, emotion_positivity, confidence, engagement,
      clarity, fluency, pacing, volume, relevance, structure, completeness,
      strengths, improvements, criteria, weights, version, calculated_at
    ) VALUES (
      gen_random_uuid(), $1, 78.5, 82.0, 75.5, 80.0, 77.0,
      85.0, 79.0, 76.0, 83.0, 72.0, 78.0, 75.0, 76.5, 82.0, 79.5, 78.5,
      '["良好な感情コントロール","適切な話速","明確な論理構造"]'::json,
      '["フィラー語を減らす","音量を少し上げる","より具体的な例を挙げる"]'::json,
      '{"emotion":"AWS Rekognition による感情解析","audio":"Azure Speech Services による音声解析","content":"Claude Sonnet による内容解析"}'::json,
      '{"emotion":0.25,"audio":0.25,"content":0.30,"delivery":0.20}'::json,
      '1.0', NOW()
    ) ON CONFLICT (session_id) DO NOTHING;
  `,

  'update-session-status': `
    -- Update Session Status
    UPDATE sessions
    SET status = $2, updated_at = NOW()
    WHERE id = $1;
  `,

  'delete-test-data': `
    -- Delete Test Data for Session
    DELETE FROM emotion_analyses WHERE session_id = $1;
    DELETE FROM audio_analyses WHERE session_id = $1;
    DELETE FROM session_scores WHERE session_id = $1;
    DELETE FROM transcripts WHERE session_id = $1;
    DELETE FROM recordings WHERE session_id = $1;
  `,
};

// ============================================================
// Main Handler
// ============================================================

export const handler: Handler<MutationPayload, MutationResponse> = async (event) => {
  const startTime = Date.now();
  const environment = process.env.NODE_ENV || 'dev';
  const executionMode = event.executionMode || 'execute';

  console.log('DB Mutation Request:', {
    mode: event.mode,
    executionMode,
    environment,
  });

  try {
    // Security: Direct SQL only in dev environment
    if (event.mode === 'direct' && environment === 'production') {
      throw new Error('Direct SQL execution is not allowed in production environment');
    }

    let result: any;
    let rowsAffected = 0;
    let queryPreview = '';

    // Execute based on mode
    switch (event.mode) {
      case 'direct':
        queryPreview = event.sql.substring(0, 200);
        if (executionMode === 'execute') {
          result = await executeDirect(event.sql);
          rowsAffected = result.rowsAffected || 0;
        } else {
          result = await validateSQL(event.sql);
        }
        break;

      case 'preset':
        const presetQuery = PRESET_QUERIES[event.queryId];
        if (!presetQuery) {
          throw new Error(`Unknown preset query: ${event.queryId}`);
        }
        queryPreview = `preset:${event.queryId}`;
        if (executionMode === 'execute') {
          result = await executePreset(event.queryId, event.params || {});
          rowsAffected = result.rowsAffected || 0;
        } else {
          result = { validated: true, query: presetQuery };
        }
        break;

      case 'transaction':
        queryPreview = `transaction:${event.queries.length} queries`;
        if (executionMode === 'execute') {
          result = await executeTransaction(event.queries);
          rowsAffected = result.rowsAffected || 0;
        } else {
          result = { validated: true, queryCount: event.queries.length };
        }
        break;
    }

    const executionTime = Date.now() - startTime;

    // Audit log
    const auditLog: AuditLog = {
      timestamp: new Date().toISOString(),
      environment,
      mode: event.mode,
      executionMode,
      queryPreview,
      rowsAffected,
      executionTime,
      success: true,
    };

    console.log('✅ DB Mutation Success:', auditLog);

    return {
      success: true,
      mode: event.mode,
      executionMode,
      rowsAffected,
      results: result.results,
      executionTime,
      query: event.mode === 'direct' ? event.sql.substring(0, 500) : undefined,
      auditLog,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Audit log for failure
    const auditLog: AuditLog = {
      timestamp: new Date().toISOString(),
      environment,
      mode: event.mode,
      executionMode,
      queryPreview: event.mode === 'direct' ? event.sql.substring(0, 200) : `${event.mode} query`,
      rowsAffected: 0,
      executionTime,
      success: false,
      error: errorMessage,
    };

    console.error('❌ DB Mutation Error:', auditLog);

    return {
      success: false,
      mode: event.mode,
      executionMode,
      executionTime,
      error: errorMessage,
      auditLog,
    };
  } finally {
    await prisma.$disconnect();
  }
};

// ============================================================
// Execution Functions
// ============================================================

async function executeDirect(sql: string): Promise<any> {
  // Security: Prevent dangerous operations
  const dangerousPatterns = [
    /DROP\s+TABLE/i,
    /DROP\s+DATABASE/i,
    /TRUNCATE\s+TABLE/i,
    /ALTER\s+TABLE.*DROP/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sql)) {
      throw new Error(`Dangerous operation detected: ${pattern.source}`);
    }
  }

  // Execute raw SQL
  const result = await prisma.$executeRawUnsafe(sql);

  return {
    rowsAffected: result,
    results: [],
  };
}

async function executePreset(queryId: string, params: Record<string, any>): Promise<any> {
  const query = PRESET_QUERIES[queryId];
  if (!query) {
    throw new Error(`Unknown preset query: ${queryId}`);
  }

  // Extract parameter values in order
  const paramValues: any[] = [];
  // Get unique parameter count (e.g., $1, $2 → 2, even if $1 appears multiple times)
  const matches = query.match(/\$(\d+)/g) || [];
  const paramNumbers = matches.map(m => parseInt(m.slice(1)));
  const paramCount = paramNumbers.length > 0 ? Math.max(...paramNumbers) : 0;

  for (let i = 1; i <= paramCount; i++) {
    const key = `param${i}`;
    if (params[key] === undefined) {
      // Try to infer from common parameter names
      if (i === 1 && params.sessionId) {
        paramValues.push(params.sessionId);
      } else if (i === 2 && params.cdnDomain) {
        paramValues.push(params.cdnDomain);
      } else {
        throw new Error(`Missing parameter: ${key}`);
      }
    } else {
      paramValues.push(params[key]);
    }
  }

  // Execute parameterized query
  const result = await prisma.$executeRawUnsafe(query, ...paramValues);

  return {
    rowsAffected: result,
    results: [],
  };
}

async function executeTransaction(queries: Array<{ sql: string; params?: Record<string, any> }>): Promise<any> {
  let totalRowsAffected = 0;

  await prisma.$transaction(async (tx) => {
    for (const query of queries) {
      const result = await (tx as any).$executeRawUnsafe(query.sql);
      totalRowsAffected += result || 0;
    }
  });

  return {
    rowsAffected: totalRowsAffected,
    results: [],
  };
}

async function validateSQL(sql: string): Promise<any> {
  // Basic SQL syntax validation
  const trimmed = sql.trim();

  if (!trimmed) {
    throw new Error('Empty SQL query');
  }

  // Check for valid SQL statement
  const validStatements = /^(INSERT|UPDATE|DELETE|WITH|SELECT)\s+/i;
  if (!validStatements.test(trimmed)) {
    throw new Error('Invalid SQL statement');
  }

  return {
    validated: true,
    preview: trimmed.substring(0, 200),
  };
}
