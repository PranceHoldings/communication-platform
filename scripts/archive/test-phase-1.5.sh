#!/bin/bash
# Phase 1.5 音声機能テストスクリプト
# 作成日: 2026-03-11

echo "=========================================="
echo "Phase 1.5 音声機能テスト開始"
echo "=========================================="
echo ""

# Step 1: 開発サーバー再起動
echo "Step 1: 開発サーバーを再起動中..."
pkill -f "next dev" 2>/dev/null || true
sleep 2

cd /workspaces/prance-communication-platform
pnpm run dev > /tmp/next-dev.log 2>&1 &
DEV_PID=$!

echo "✅ 開発サーバー起動中 (PID: $DEV_PID)"
echo "   ログ: /tmp/next-dev.log"
echo ""

# Step 2: サーバー起動待機
echo "Step 2: サーバー起動を待機中..."
sleep 10

# Step 3: ヘルスチェック
echo "Step 3: ヘルスチェック実行中..."
if curl -s http://localhost:3000 > /dev/null; then
  echo "✅ 開発サーバーが正常に起動しました"
else
  echo "❌ 開発サーバーの起動に失敗しました"
  exit 1
fi
echo ""

# Step 4: テスト手順表示
echo "=========================================="
echo "✅ 準備完了！"
echo "=========================================="
echo ""
echo "ブラウザでテストを開始してください:"
echo ""
echo "1. URL: http://localhost:3000/dashboard/scenarios"
echo ""
echo "2. テストシナリオ: 「面接練習 - 基本編 - 追加」を選択"
echo ""
echo "3. 「セッション開始」ボタンをクリック"
echo ""
echo "4. カメラ・マイクを許可"
echo ""
echo "5. 期待される動作:"
echo "   ✅ AI初回挨拶が音声で流れる"
echo "   ✅ 無音10秒後に促しメッセージが表示"
echo "   ✅ ユーザー発話が文字起こしされる"
echo "   ✅ AIの応答が音声で流れる"
echo ""
echo "6. コンソールログを確認 (F12 → Console):"
echo "   期待: silenceTimeout: 10, enableSilencePrompt: true"
echo ""
echo "=========================================="
echo ""
echo "開発サーバーログ:"
echo "  tail -f /tmp/next-dev.log"
echo ""
echo "サーバー停止:"
echo "  kill $DEV_PID"
echo ""
