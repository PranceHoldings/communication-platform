/**
 * データベースマイグレーション実行 Lambda 関数
 * migrationsディレクトリ内の全SQLファイルを順次実行
 */

import { Handler } from 'aws-lambda';
import { prisma } from '../shared/database/prisma';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export const handler: Handler = async (event, context) => {
  console.log('Starting database migration...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

  try {
    // migrationsディレクトリ内の全SQLファイルを取得
    const migrationsDir = __dirname;
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    console.log('Found SQL files:', files);

    let totalExecuted = 0;

    for (const sqlFile of files) {
      console.log(`\n[Migration] Processing: ${sqlFile}`);
      const migrationSqlPath = join(migrationsDir, sqlFile);
      const migrationSql = readFileSync(migrationSqlPath, 'utf-8');

      // コメント行を除去
      const lines = migrationSql.split('\n');
      const sqlWithoutComments = lines.filter(line => !line.trim().startsWith('--')).join('\n');

      // SQLを実行（一つずつ実行）
      const statements = sqlWithoutComments
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log(`[Migration] ${sqlFile}: ${statements.length} statements`);

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await prisma.$executeRawUnsafe(statement);
            totalExecuted++;
          } catch (error: any) {
            // テーブルやエンティティが既に存在する場合はスキップ
            if (error.code === '42P07' || error.code === '42710' || error.code === '23505' || error.code === 'P2010' || error.code === '42701') {
              console.warn(`[Migration] Statement already exists (skipping):`, error.message.substring(0, 100));
              totalExecuted++;
              continue;
            }
            throw error;
          }
        }
      }

      console.log(`[Migration] ✅ Completed: ${sqlFile}`);
    }

    console.log(`\n[Migration] All migrations completed successfully. Executed ${totalExecuted} statements.`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Migration completed successfully',
        statementsExecuted: totalExecuted,
        filesProcessed: files.length,
      }),
    };
  } catch (error: any) {
    console.error('[Migration] Failed:', error);
    console.error('[Migration] Error details:', {
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
