# Day 12 デプロイ・動作確認チェックリスト

**作成日:** 2026-03-11
**Phase 1.5 Day 12:** 統合デプロイ・動作確認

---

## 1. デプロイ前確認

### ソースコード確認
- ✅ Day 8-11の全変更がコミット済み
  - Day 8: フロントエンドエラーハンドリング
  - Day 9: バックエンドリトライロジック
  - Day 10: 統合テスト・ドキュメント
  - Day 11: UX改善（波形、インジケーター、ショートカット、アクセシビリティ）
- ✅ Gitステータス確認（6コミット ahead）
- ✅ ビルドエラーなし

### 環境確認
- ✅ AWS認証確認
- ✅ 環境変数ファイル同期（.env.local → infrastructure/.env）
- ✅ Prisma Client生成済み
- ✅ TypeScriptビルド成功

---

## 2. Lambda関数デプロイ

### デプロイコマンド
```bash
cd /workspaces/prance-communication-platform/infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### 期待される変更
- **Day 9のリトライロジック反映**
  - Azure STT API: 3回リトライ、指数バックオフ
  - AWS Bedrock API: 3回リトライ
  - ElevenLabs TTS: 3回リトライ
  - エラーログ強化（error-logger.ts）

### デプロイ確認項目
- [x] CloudFormation Stack更新成功
- [x] Lambda関数バージョン更新
- [x] Lambda環境変数更新
- [x] Lambda Layer更新（Prisma Client含む）
- [x] エラーなしでデプロイ完了

**デプロイ結果（2026-03-11 02:00 JST）:**
- ✅ Prance-dev-ApiLambda スタック更新成功
- ✅ WebSocketDefaultFunction 更新完了
- ✅ デプロイ時間: 124.49秒
- ✅ Exit code: 0（正常終了）

---

## 3. デプロイ後動作確認

### 3.1 Lambda関数バージョン確認
```bash
# WebSocket関数のバージョン確認
aws lambda get-function --function-name prance-websocket-default-dev \
  --query 'Configuration.[FunctionName, LastModified, CodeSize]' \
  --output table

# セッション関数のバージョン確認
aws lambda get-function --function-name prance-sessions-get-dev \
  --query 'Configuration.[FunctionName, LastModified, CodeSize]' \
  --output table
```

**確認項目:**
- [ ] LastModified が最新（2026-03-11）
- [ ] CodeSize が増加（リトライロジック追加分）

### 3.2 環境変数確認
```bash
# WebSocket関数の環境変数確認
aws lambda get-function-configuration --function-name prance-websocket-default-dev \
  --query 'Environment.Variables' | jq '.DATABASE_URL, .AZURE_SPEECH_KEY'
```

**確認項目:**
- [ ] DATABASE_URL が正しい（RDS Aurora）
- [ ] AZURE_SPEECH_KEY が設定済み
- [ ] ELEVENLABS_API_KEY が設定済み

### 3.3 CloudWatch Logs確認
```bash
# 最新ログを確認
aws logs tail /aws/lambda/prance-websocket-default-dev --follow --since 5m
```

**確認項目:**
- [ ] ログが正常に出力されている
- [ ] エラーログがない（または想定内）
- [ ] リトライログが出力される（エラー発生時）

---

## 4. E2Eテスト（セッション実行）

### テスト環境
- **URL:** http://localhost:3000 または https://dev.prance-platform.com
- **認証:** admin@prance.com / Admin2026!Prance

### テストシナリオ1: 正常フロー
1. [ ] ログイン成功
2. [ ] ダッシュボード表示
3. [ ] セッション作成（シナリオ選択 + アバター選択）
4. [ ] セッション開始（Start Session）
   - [ ] WebSocket接続成功
   - [ ] マイク許可要求
   - [ ] 音声レベルインジケーター表示
   - [ ] **音声波形表示（Day 11）**
5. [ ] 音声入力
   - [ ] 話す → 無音検出 → speech_end
   - [ ] **処理状態インジケーター: STT（Day 11）**
   - [ ] トランスクリプト表示（USER）
6. [ ] AI応答
   - [ ] **処理状態インジケーター: AI（Day 11）**
   - [ ] トランスクリプト表示（AI、部分更新）
   - [ ] **処理状態インジケーター: TTS（Day 11）**
7. [ ] TTS音声再生
   - [ ] 音声再生開始（1-2秒以内）
   - [ ] スピーカーアイコン点灯
   - [ ] **処理状態: idle（Day 11）**
8. [ ] セッション停止（Stop Session）
   - [ ] 録画停止
   - [ ] WebSocket切断
   - [ ] セッション完了表示

### テストシナリオ2: キーボードショートカット（Day 11）
1. [ ] Space: セッション開始/停止
2. [ ] P: 一時停止/再開
3. [ ] M: マイクミュート/解除
   - [ ] ミュート状態の視覚的フィードバック
   - [ ] 音声レベル/波形グレーアウト
4. [ ] Escape: セッションキャンセル
5. [ ] ?: キーボードショートカットヘルプ表示

### テストシナリオ3: アクセシビリティ（Day 11）
1. [ ] Tab キーでナビゲーション
   - [ ] フォーカスリング表示（青/緑/黄/赤）
   - [ ] 論理的な順序（ヘッダー→アバター→トランスクリプト→コントロール）
2. [ ] スクリーンリーダーテスト（可能であれば）
   - [ ] ボタンラベル読み上げ（ショートカット付き）
   - [ ] 状態変更アナウンス
   - [ ] トランスクリプトライブ更新

### テストシナリオ4: エラーハンドリング（Day 8-9）
1. [ ] マイク許可拒否
   - [ ] エラーメッセージ表示（多言語）
   - [ ] ブラウザ固有の手順表示
2. [ ] ネットワークエラー（Wi-Fi切断シミュレーション）
   - [ ] WebSocket再接続試行
   - [ ] リトライメッセージ表示
3. [ ] 音量不足
   - [ ] 5秒連続でRMS < 0.01
   - [ ] 警告メッセージ表示

---

## 5. パフォーマンス測定

### レスポンス時間測定（目標: 2-5秒）
```bash
# CloudWatch Logs Insights クエリ
fields @timestamp, @message
| filter @message like /speech_end/
| fields @timestamp as speech_end_time
| join
  (fields @timestamp, @message
   | filter @message like /audio playback started/
   | fields @timestamp as audio_start_time)
  on speech_end_time
| stats avg(audio_start_time - speech_end_time) as avg_response_time_ms
```

**測定項目:**
- [ ] 10回以上のセッション実行
- [ ] 平均レスポンス時間: _____ 秒
- [ ] 最小レスポンス時間: _____ 秒
- [ ] 最大レスポンス時間: _____ 秒
- [ ] 目標達成（2-5秒以内）: YES / NO

### エラー自動回復率（目標: 80%以上）
```bash
# リトライ統計
fields context.attempts, context.totalDelay
| filter message like /completed/
| filter context.attempts > 1
| stats count() as successAfterRetry,
        avg(context.attempts) as avgAttempts,
        avg(context.totalDelay) as avgDelay
```

**測定項目:**
- [ ] 一時的エラー発生回数: _____
- [ ] 自動回復成功回数: _____
- [ ] 自動回復率: _____ %
- [ ] 目標達成（80%以上）: YES / NO

---

## 6. Next.js アプリケーションデプロイ（オプション）

### デプロイ方法
```bash
# ローカルビルド確認
cd /workspaces/prance-communication-platform/apps/web
pnpm run build

# Amplify Hosting経由でデプロイ（または手動）
git push origin main
```

### 確認項目
- [ ] ビルド成功
- [ ] Day 8-11のUX改善が反映
- [ ] 本番環境でアクセス可能

---

## 7. 完了基準

### 必須（Must Have）
- [ ] Lambda関数デプロイ成功
- [ ] E2Eテスト: 正常フロー完了
- [ ] E2Eテスト: キーボードショートカット動作
- [ ] レスポンス時間: 2-5秒以内
- [ ] エラー自動回復率: 80%以上

### 推奨（Should Have）
- [ ] E2Eテスト: アクセシビリティ確認
- [ ] E2Eテスト: エラーハンドリング動作
- [ ] パフォーマンス測定データ記録
- [ ] CloudWatch Logs確認

### オプション（Nice to Have）
- [ ] Next.js アプリケーションデプロイ
- [ ] 本番環境での動作確認
- [ ] スクリーンリーダーテスト

---

## 8. 問題発生時の対処

### Lambda関数デプロイ失敗
1. ログ確認: `/tmp/deploy-day12.log`
2. CloudFormation スタック確認: AWS Console
3. ロールバック: `pnpm run cdk -- deploy Prance-dev-ApiLambda --rollback`

### E2Eテスト失敗
1. ブラウザコンソール確認（F12）
2. CloudWatch Logs確認
3. ネットワークタブ確認（WebSocket接続）

### パフォーマンス未達成
1. ボトルネック特定（STT/AI/TTS）
2. リトライ設定調整
3. 同時実行数調整（Lambda Concurrency）

---

## 9. 次のステップ

Day 12完了後：
- [ ] Day 13-14: パフォーマンステスト
  - 同時接続負荷テスト（5-10セッション）
  - メモリリーク確認（長時間セッション）
  - パフォーマンス最適化（ボトルネック改善）
- [ ] Phase 1.5完了報告書作成
- [ ] Phase 1.6計画確認
