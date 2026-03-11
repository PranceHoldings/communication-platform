/**
 * データベースマイグレーション実行 Lambda 関数
 * 一時的な使用のみ（デプロイ後に手動実行）
 */

import { Handler } from 'aws-lambda';
import { prisma } from '../shared/database/prisma';
import { readFileSync } from 'fs';
import { join } from 'path';

export const handler: Handler = async (event, context) => {
  console.log('Starting database migration...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

  try {
    // イベントから実行するSQLファイルを決定
    const sqlFile = event?.sqlFile || 'migration.sql';
    const migrationSqlPath = join(__dirname, sqlFile);
    console.log('Reading migration SQL from:', migrationSqlPath);

    const migrationSql = readFileSync(migrationSqlPath, 'utf-8');
    console.log('Migration SQL loaded, length:', migrationSql.length);

    // コメント行を除去
    const lines = migrationSql.split('\n');
    const sqlWithoutComments = lines.filter(line => !line.trim().startsWith('--')).join('\n');

    console.log('SQL without comments length:', sqlWithoutComments.length);

    // SQLを実行（一つずつ実行）
    const statements = sqlWithoutComments
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log('Executing', statements.length, 'SQL statements...');

    let executedCount = 0;
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
          executedCount++;
          if (executedCount % 10 === 0) {
            console.log(`Executed ${executedCount}/${statements.length} statements...`);
          }
        } catch (error: any) {
          // テーブルやエンティティが既に存在する場合はスキップ
          if (error.code === '42P07' || error.code === '42710' || error.code === '23505' || error.code === 'P2010') {
            console.warn('Statement already exists (skipping):', error.message);
            executedCount++;
            continue;
          }
          throw error;
        }
      }
    }

    console.log('Migration completed successfully. Executed', executedCount, 'statements.');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Migration completed successfully',
        statementsExecuted: executedCount,
      }),
    };
  } catch (error: any) {
    console.error('Migration failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Migration failed',
        error: error.message,
        code: error.code,
      }),
    };
  } finally {
    await prisma.$disconnect();
  }
};
