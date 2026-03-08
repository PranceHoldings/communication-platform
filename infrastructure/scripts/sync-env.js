#!/usr/bin/env node
/**
 * Environment Variables Synchronization Script
 *
 * このスクリプトは自動的に実行されます:
 * - npm run deploy の前（predeploy フック）
 * - ./deploy.sh の実行時
 *
 * 機能:
 * 1. プロジェクトルートの .env.local を infrastructure/.env にコピー
 * 2. 必須APIキーの存在確認
 * 3. エラーがある場合はデプロイを中止
 *
 * 詳細: docs/development/API_KEY_MANAGEMENT.md
 */

const fs = require('fs');
const path = require('path');

// 色付き出力
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function main() {
  log('blue', '🔐 環境変数ファイルを同期中...');

  // パスの設定
  const projectRoot = path.resolve(__dirname, '../..');
  const envLocal = path.join(projectRoot, '.env.local');
  const envInfra = path.join(__dirname, '../.env');

  // .env.local の存在確認
  if (!fs.existsSync(envLocal)) {
    log('red', '❌ エラー: .env.local が見つかりません');
    log('red', `   場所: ${envLocal}`);
    log('yellow', '\n   以下の手順で作成してください:');
    log('yellow', `   1. cp ${path.join(projectRoot, '.env.example')} ${envLocal}`);
    log('yellow', '   2. .env.local にAPIキーを設定');
    log('yellow', '   3. 詳細: docs/development/API_KEY_MANAGEMENT.md');
    process.exit(1);
  }

  // .env.local を infrastructure/.env にコピー
  try {
    fs.copyFileSync(envLocal, envInfra);
    log('green', '✅ 環境変数ファイル同期完了');
    log('blue', `   コピー元: ${envLocal}`);
    log('blue', `   コピー先: ${envInfra}`);
  } catch (error) {
    log('red', `❌ エラー: ファイルのコピーに失敗しました`);
    log('red', `   ${error.message}`);
    process.exit(1);
  }

  // 環境変数の読み込みと検証
  log('yellow', '\n🔍 必須APIキーの確認中...');

  const envContent = fs.readFileSync(envInfra, 'utf8');
  const envVars = {};

  // 環境変数をパース
  envContent.split('\n').forEach(line => {
    // コメントと空行をスキップ
    if (line.trim().startsWith('#') || !line.trim()) {
      return;
    }

    // KEY=VALUE の形式をパース
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      // クォートを除去
      envVars[key] = value.replace(/^["'](.*)["']$/, '$1');
    }
  });

  // 必須APIキーのチェック
  const requiredKeys = [
    { key: 'AZURE_SPEECH_KEY', name: 'Azure Speech Services' },
    { key: 'ELEVENLABS_API_KEY', name: 'ElevenLabs' },
    { key: 'JWT_SECRET', name: 'JWT Secret' },
  ];

  const missingKeys = [];
  const defaultKeys = [];

  requiredKeys.forEach(({ key, name }) => {
    const value = envVars[key];

    if (!value || value === 'xxxxx' || value === '') {
      missingKeys.push({ key, name });
    } else if (key === 'JWT_SECRET' && value.includes('dev-secret-change-in-production')) {
      defaultKeys.push({ key, name });
    }
  });

  // 結果の表示
  if (missingKeys.length > 0) {
    log('red', `\n❌ エラー: ${missingKeys.length} 個のAPIキーが設定されていません`);
    missingKeys.forEach(({ key, name }) => {
      log('red', `   - ${key} (${name})`);
    });
    log('yellow', `\n   ${envLocal} を編集してAPIキーを設定してください`);
    log('yellow', '   詳細: docs/development/API_KEY_MANAGEMENT.md');
    process.exit(1);
  }

  if (defaultKeys.length > 0) {
    log('yellow', '\n⚠️  警告: デフォルト値が使用されています');
    defaultKeys.forEach(({ key, name }) => {
      log('yellow', `   - ${key} (${name})`);
    });
    log('yellow', '   本番環境では必ず変更してください');
  }

  log('green', '\n✅ 必須APIキー確認完了');
  log('blue', '   デプロイを続行します...\n');
}

// スクリプト実行
try {
  main();
} catch (error) {
  log('red', `❌ 予期しないエラーが発生しました: ${error.message}`);
  process.exit(1);
}
