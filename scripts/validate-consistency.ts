#!/usr/bin/env node
/**
 * 型整合性検証スクリプト
 * TypeScriptの型システムを使って、コンパイル時に不整合を検出
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  category: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string[];
}

const results: ValidationResult[] = [];

console.log('🔍 型整合性検証を開始します...\n');

// ============================================================
// 1. Prisma Client生成の確認
// ============================================================
console.log('📌 [1/6] Prisma Clientの生成状態を確認中...');

try {
  const prismaClientPath = path.join(
    __dirname,
    '../packages/database/node_modules/.prisma/client'
  );

  if (!fs.existsSync(prismaClientPath)) {
    results.push({
      category: 'Prisma Client',
      status: 'fail',
      message: 'Prisma Clientが生成されていません',
      details: ['npm run prisma:generate を実行してください'],
    });
  } else {
    // Prismaスキーマの最終更新時刻
    const schemaPath = path.join(
      __dirname,
      '../packages/database/prisma/schema.prisma'
    );
    const clientIndexPath = path.join(prismaClientPath, 'index.js');

    const schemaMtime = fs.statSync(schemaPath).mtime.getTime();
    const clientMtime = fs.statSync(clientIndexPath).mtime.getTime();

    if (schemaMtime > clientMtime) {
      results.push({
        category: 'Prisma Client',
        status: 'warning',
        message: 'Prismaスキーマが更新されています',
        details: ['npm run prisma:generate を実行してください'],
      });
    } else {
      results.push({
        category: 'Prisma Client',
        status: 'pass',
        message: 'Prisma Clientは最新です',
      });
    }
  }
} catch (error) {
  results.push({
    category: 'Prisma Client',
    status: 'fail',
    message: 'Prisma Clientの確認に失敗しました',
    details: [error instanceof Error ? error.message : String(error)],
  });
}

// ============================================================
// 2. 共有型パッケージのビルド確認
// ============================================================
console.log('📌 [2/6] 共有型パッケージのビルド状態を確認中...');

try {
  const sharedDistPath = path.join(__dirname, '../packages/shared/dist');

  if (!fs.existsSync(sharedDistPath)) {
    results.push({
      category: '共有型パッケージ',
      status: 'fail',
      message: '共有型パッケージがビルドされていません',
      details: ['cd packages/shared && npm run build を実行してください'],
    });
  } else {
    results.push({
      category: '共有型パッケージ',
      status: 'pass',
      message: '共有型パッケージはビルド済みです',
    });
  }
} catch (error) {
  results.push({
    category: '共有型パッケージ',
    status: 'fail',
    message: '共有型パッケージの確認に失敗しました',
    details: [error instanceof Error ? error.message : String(error)],
  });
}

// ============================================================
// 3. TypeScriptコンパイルエラーの確認
// ============================================================
console.log('📌 [3/6] TypeScriptコンパイルエラーを確認中...');

const tsCheckDirs = [
  { name: 'Lambda関数', path: 'infrastructure/lambda' },
  { name: 'Web (Next.js)', path: 'apps/web' },
];

for (const dir of tsCheckDirs) {
  try {
    const dirPath = path.join(__dirname, '..', dir.path);

    if (!fs.existsSync(path.join(dirPath, 'tsconfig.json'))) {
      results.push({
        category: `TypeScript (${dir.name})`,
        status: 'warning',
        message: 'tsconfig.jsonが見つかりません',
      });
      continue;
    }

    // TypeScriptコンパイルチェック（エラー出力のみ）
    try {
      execSync('npx tsc --noEmit --pretty false', {
        cwd: dirPath,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      results.push({
        category: `TypeScript (${dir.name})`,
        status: 'pass',
        message: 'コンパイルエラーなし',
      });
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || '';
      const errorLines = errorOutput
        .split('\n')
        .filter((line: string) => line.includes('error TS'))
        .slice(0, 10); // 最初の10エラーのみ

      results.push({
        category: `TypeScript (${dir.name})`,
        status: 'fail',
        message: `${errorLines.length}+ 個のコンパイルエラー`,
        details: errorLines.length > 0 ? errorLines : ['詳細はログを確認'],
      });
    }
  } catch (error) {
    results.push({
      category: `TypeScript (${dir.name})`,
      status: 'fail',
      message: 'TypeScriptチェックに失敗しました',
      details: [error instanceof Error ? error.message : String(error)],
    });
  }
}

// ============================================================
// 4. 環境変数の検証
// ============================================================
console.log('📌 [4/6] 環境変数の整合性を確認中...');

try {
  const envLocalPath = path.join(__dirname, '../.env.local');
  const infraEnvPath = path.join(__dirname, '../infrastructure/.env');

  const requiredVars = [
    'DATABASE_URL',
    'AZURE_SPEECH_KEY',
    'AZURE_SPEECH_REGION',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
    'JWT_SECRET',
  ];

  const missingVars: string[] = [];

  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf-8');

    for (const varName of requiredVars) {
      if (!envContent.includes(`${varName}=`)) {
        missingVars.push(varName);
      }
    }

    // ローカルPostgreSQL接続の検出
    if (envContent.includes('localhost:5432') || envContent.includes('localhost/prance')) {
      results.push({
        category: '環境変数',
        status: 'fail',
        message: 'ローカルPostgreSQL接続が検出されました（AWS RDS専用プロジェクト）',
        details: ['DATABASE_URLをAWS RDS接続文字列に変更してください'],
      });
    } else if (missingVars.length > 0) {
      results.push({
        category: '環境変数',
        status: 'warning',
        message: `${missingVars.length}個の必須環境変数が未設定`,
        details: missingVars,
      });
    } else {
      results.push({
        category: '環境変数',
        status: 'pass',
        message: '環境変数は正しく設定されています',
      });
    }
  } else {
    results.push({
      category: '環境変数',
      status: 'fail',
      message: '.env.local ファイルが存在しません',
      details: ['.env.example をコピーして .env.local を作成してください'],
    });
  }
} catch (error) {
  results.push({
    category: '環境変数',
    status: 'fail',
    message: '環境変数の検証に失敗しました',
    details: [error instanceof Error ? error.message : String(error)],
  });
}

// ============================================================
// 5. 依存関係の整合性
// ============================================================
console.log('📌 [5/6] 依存関係の整合性を確認中...');

try {
  const packageJsonPath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // @prance/shared が依存関係にあるか
  const hasSharedPackage =
    packageJson.dependencies?.['@prance/shared'] ||
    packageJson.devDependencies?.['@prance/shared'] ||
    packageJson.workspaces;

  if (hasSharedPackage) {
    results.push({
      category: '依存関係',
      status: 'pass',
      message: '共有パッケージが正しく設定されています',
    });
  } else {
    results.push({
      category: '依存関係',
      status: 'warning',
      message: '共有パッケージが依存関係に含まれていません',
    });
  }
} catch (error) {
  results.push({
    category: '依存関係',
    status: 'fail',
    message: '依存関係の確認に失敗しました',
    details: [error instanceof Error ? error.message : String(error)],
  });
}

// ============================================================
// 6. Git状態の確認
// ============================================================
console.log('📌 [6/6] Git状態を確認中...');

try {
  const gitStatus = execSync('git status --porcelain', {
    encoding: 'utf-8',
    cwd: path.join(__dirname, '..'),
  });

  const modifiedFiles = gitStatus
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.substring(3));

  // schema.prismaが変更されているか
  const schemaModified = modifiedFiles.some((file) => file.includes('schema.prisma'));

  if (schemaModified) {
    results.push({
      category: 'Git状態',
      status: 'warning',
      message: 'Prismaスキーマが変更されています',
      details: [
        'マイグレーションを実行してください:',
        '  cd packages/database',
        '  npx prisma migrate dev --name <変更内容>',
        '  npx prisma generate',
      ],
    });
  } else {
    results.push({
      category: 'Git状態',
      status: 'pass',
      message: 'スキーマに未コミットの変更はありません',
    });
  }
} catch (error) {
  results.push({
    category: 'Git状態',
    status: 'warning',
    message: 'Git状態の確認をスキップしました',
  });
}

// ============================================================
// 結果の表示
// ============================================================
console.log('\n' + '='.repeat(60));
console.log('📊 検証結果サマリー');
console.log('='.repeat(60) + '\n');

const passCount = results.filter((r) => r.status === 'pass').length;
const warningCount = results.filter((r) => r.status === 'warning').length;
const failCount = results.filter((r) => r.status === 'fail').length;

results.forEach((result) => {
  const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
  console.log(`${icon} [${result.category}] ${result.message}`);

  if (result.details && result.details.length > 0) {
    result.details.forEach((detail) => {
      console.log(`   ${detail}`);
    });
  }
  console.log('');
});

console.log('='.repeat(60));
console.log(`合格: ${passCount} | 警告: ${warningCount} | 失敗: ${failCount}`);
console.log('='.repeat(60) + '\n');

// 終了コード
if (failCount > 0) {
  console.log('❌ 検証失敗: 修正が必要な項目があります\n');
  process.exit(1);
} else if (warningCount > 0) {
  console.log('⚠️  検証完了: 警告があります\n');
  process.exit(0);
} else {
  console.log('✅ 検証成功: すべてのチェックに合格しました\n');
  process.exit(0);
}
