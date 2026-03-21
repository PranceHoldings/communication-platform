/**
 * Database Query Lambda Function
 *
 * Purpose: Execute SQL queries on Aurora RDS from local development environment
 * Security: VPC-only access, optional read-only mode
 *
 * Usage:
 * 1. Upload SQL to S3: s3://prance-db-queries-dev/{query-id}.sql
 * 2. Invoke Lambda with query ID
 * 3. Lambda executes SQL and returns results
 *
 * Event Payload:
 * {
 *   "queryId": "optional-s3-key",
 *   "sql": "optional-direct-sql",
 *   "readOnly": true|false,
 *   "params": {}
 * }
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../shared/database/prisma';
import { getMaxResults } from '../shared/utils/runtime-config-loader';
import { getRequiredEnv, getAwsRegion } from '../shared/utils/env-validator';

const s3Client = new S3Client({ region: getAwsRegion() });
const S3_BUCKET = getRequiredEnv('DB_QUERIES_BUCKET');

// Fix: Enable BigInt serialization to JSON
// BigInt.prototype.toJSON を定義して、JSON.stringify() で自動的に文字列に変換
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

interface QueryEvent {
  queryId?: string; // S3 key for SQL file
  sql?: string; // Direct SQL query
  readOnly?: boolean; // If true, only SELECT queries allowed
  params?: Record<string, any>; // Query parameters
  maxResults?: number; // Maximum rows to return
}

interface QueryResult {
  success: boolean;
  data?: any[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
  query?: string;
}

/**
 * Validate SQL query for read-only mode
 */
function isReadOnlyQuery(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();

  // Allow only SELECT queries (including WITH clause)
  if (normalized.startsWith('SELECT') || normalized.startsWith('WITH')) {
    // Disallow dangerous keywords
    const dangerous = [
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'CREATE',
      'ALTER',
      'TRUNCATE',
      'GRANT',
      'REVOKE',
    ];
    for (const keyword of dangerous) {
      if (normalized.includes(keyword)) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Load SQL from S3
 */
async function loadSqlFromS3(queryId: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: queryId,
    });

    const response = await s3Client.send(command);
    const sql = await response.Body?.transformToString();

    if (!sql) {
      throw new Error('Empty SQL file');
    }

    return sql;
  } catch (error) {
    console.error('[DB Query] Failed to load SQL from S3:', error);
    throw new Error(
      `Failed to load SQL from S3: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Execute SQL query
 */
async function executeQuery(
  sql: string,
  readOnly: boolean,
  maxResults: number
): Promise<QueryResult> {
  const startTime = Date.now();

  try {
    console.log('[DB Query] Executing query:', {
      sqlPreview: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      readOnly,
      maxResults,
    });

    // Validate read-only mode
    if (readOnly && !isReadOnlyQuery(sql)) {
      throw new Error('Only SELECT queries are allowed in read-only mode');
    }

    // Execute query
    const result = await prisma.$queryRawUnsafe(sql);

    const executionTime = Date.now() - startTime;

    // Handle different result types
    let data: any[];
    let rowCount: number;

    if (Array.isArray(result)) {
      // SELECT query - return rows
      data = result.slice(0, maxResults);
      rowCount = result.length;

      if (rowCount > maxResults) {
        console.log(`[DB Query] Result truncated: ${rowCount} rows → ${maxResults} rows`);
      }
    } else if (typeof result === 'object' && result !== null && 'count' in result) {
      // COUNT query - return count
      data = [result];
      rowCount = 1;
    } else {
      // Other query types (INSERT, UPDATE, DELETE) - return affected rows
      data = [];
      rowCount = typeof result === 'number' ? result : 0;
    }

    console.log('[DB Query] Query completed:', {
      rowCount,
      executionTime: `${executionTime}ms`,
      truncated: rowCount > maxResults,
    });

    return {
      success: true,
      data,
      rowCount,
      executionTime,
      query: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    console.error('[DB Query] Query failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
      query: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
    };
  }
}

/**
 * Lambda handler
 */
export const handler = async (event: QueryEvent): Promise<QueryResult> => {
  console.log('[DB Query] Lambda invoked:', {
    hasQueryId: !!event.queryId,
    hasSql: !!event.sql,
    readOnly: event.readOnly,
    maxResults: event.maxResults,
  });

  try {
    // Load SQL
    let sql: string;

    if (event.sql) {
      // Direct SQL from payload
      sql = event.sql;
      console.log('[DB Query] Using direct SQL from payload');
    } else if (event.queryId) {
      // Load from S3
      console.log('[DB Query] Loading SQL from S3:', event.queryId);
      sql = await loadSqlFromS3(event.queryId);
    } else {
      throw new Error('Either queryId or sql must be provided');
    }

    // Default to read-only mode for safety
    const readOnly = event.readOnly !== false;
    const maxResults = event.maxResults || (await getMaxResults());

    // Execute query
    const result = await executeQuery(sql, readOnly, maxResults);

    return result;
  } catch (error) {
    console.error('[DB Query] Lambda error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Always disconnect
    await prisma.$disconnect();
  }
};

/**
 * Direct execution (for testing)
 */
if (require.main === module) {
  const testEvent: QueryEvent = {
    sql: 'SELECT id, title, "silencePromptTimeout" FROM scenarios LIMIT 5',
    readOnly: true,
  };

  handler(testEvent)
    .then(result => {
      console.log('[DB Query] Test result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('[DB Query] Test failed:', error);
      process.exit(1);
    });
}
