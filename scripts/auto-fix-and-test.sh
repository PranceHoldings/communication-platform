#!/bin/bash
# 自動修正 + テストスクリプト
# 作成日: 2026-03-11

# Load shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

log_section "自動修正 + テスト実行"

# Step 1: Lambda関数でSQLを実行
log_step 1 "Lambda関数でデフォルト値を設定中..."
echo ""

RESULT=$(aws lambda invoke \
  --function-name prance-db-migration-dev \
  --payload '{"sqlFile":"populate-defaults.sql"}' \
  /tmp/populate-result.json 2>&1)

INVOKE_STATUS=$?

if [ $INVOKE_STATUS -ne 0 ]; then
  log_error "Lambda関数の実行に失敗しました"
  echo "$RESULT"
  exit 1
fi

log_info "Lambda実行結果:"
cat /tmp/populate-result.json | jq '.'
echo ""

# JSONからstatusCodeを取得
STATUS_CODE=$(cat /tmp/populate-result.json | jq -r '.statusCode')

if [ "$STATUS_CODE" != "200" ]; then
  log_error "SQL実行に失敗しました (Status: $STATUS_CODE)"
  cat /tmp/populate-result.json | jq -r '.body' | jq '.'
  exit 1
fi

log_success "デフォルト値の設定が完了しました"
echo ""

# 実行されたステートメント数を表示
BODY=$(cat /tmp/populate-result.json | jq -r '.body')
STATEMENTS=$(echo "$BODY" | jq -r '.statementsExecuted')
log_info "実行されたSQLステートメント数: $STATEMENTS"
echo ""

# Step 2: データベース確認
log_step 2 "データベースの状態を確認中..."
echo ""

# シナリオ一覧を取得（Lambda経由）
aws lambda invoke \
  --function-name prance-scenarios-list-dev \
  --payload '{"queryStringParameters":{"limit":"5"}}' \
  /tmp/scenarios-result.json > /dev/null 2>&1

log_success "シナリオデータ取得完了"
echo ""

# Step 3: 開発サーバー再起動
log_step 3 "開発サーバーを再起動中..."
echo ""

# 既存のサーバーを停止
pkill -f "next dev" 2>/dev/null || true
sleep 2

# 新しいサーバーを起動
cd /workspaces/prance-communication-platform
pnpm run dev > /tmp/next-dev.log 2>&1 &
DEV_PID=$!

log_success "開発サーバー起動中 (PID: $DEV_PID)"
log_info "ログ: /tmp/next-dev.log"
echo ""

# Step 4: サーバー起動待機
log_step 4 "サーバー起動を待機中..."
for i in {1..15}; do
  if curl -s https://dev.app.prance.jp > /dev/null 2>&1; then
    log_success "開発サーバーが正常に起動しました ($i秒)"
    break
  fi
  if [ $i -eq 15 ]; then
    log_error "開発サーバーの起動がタイムアウトしました"
    log_info "ログを確認してください: tail /tmp/next-dev.log"
    exit 1
  fi
  sleep 1
done
echo ""

# Step 5: テスト手順表示
log_section "準備完了！Phase 1.5 テストを開始してください"

echo "🌐 ブラウザでアクセス:"
echo "   https://dev.app.prance.jp/dashboard/scenarios"
echo ""
echo "📝 テスト手順:"
echo "   1. 「面接練習 - 基本編 - 追加」を選択"
echo "   2. 「セッション開始」ボタンをクリック"
echo "   3. カメラ・マイクを許可"
echo ""
echo "✅ 期待される動作:"
echo "   • AI初回挨拶が音声で流れる"
echo "   • 無音10秒後に促しメッセージが表示"
echo "   • ユーザー発話が文字起こしされる"
echo "   • AIの応答が音声で流れる"
echo ""
echo "🔍 コンソールログ確認 (F12 → Console):"
echo "   期待されるログ:"
echo "   [WebSocket] Sent authenticate with scenario data: {"
echo "     hasPrompt: true,"
echo "     language: 'ja',"
echo "     hasInitialGreeting: true,   // ✅"
echo "     silenceTimeout: 10,          // ✅"
echo "     enableSilencePrompt: true    // ✅"
echo "   }"
echo ""
print_separator
echo ""
echo "📊 ログファイル:"
echo "   開発サーバー: tail -f /tmp/next-dev.log"
echo "   Lambda結果:   cat /tmp/populate-result.json | jq '.'"
echo ""
echo "🛑 サーバー停止:"
echo "   kill $DEV_PID"
echo ""
print_separator
