# セッション録画・文字起こし機能テストガイド

**デプロイ完了:** 2026-03-15 14:41 JST
**デプロイ時間:** 102.29秒

## 🎯 テスト目的

以下の機能が正しく動作することを確認：
1. ✅ 文字起こし（USER/AI）がデータベースに保存される
2. ✅ セッション終了時にステータスが `COMPLETED` に更新される
3. ✅ 終了時刻と継続時間が記録される
4. ✅ セッション詳細ページで文字起こしと録画が表示される

## 📋 テスト手順

### Step 1: ブラウザでセッション開始

```
1. http://localhost:3000/dashboard/sessions/new にアクセス
2. シナリオを選択（例: 面接練習）
3. アバターを選択
4. "Start Session" ボタンをクリック
```

### Step 2: 会話を実行

```
1. マイクアイコンをクリックして音声を有効化
2. 何か話す（例: "Hello, how are you?"）
3. AIの応答を待つ（テキストと音声で返答）
4. さらに2-3回やり取りする
```

**重要:** 音声入力後、必ず **少し待ってから** 次の発言をしてください。
- AIが応答を生成する時間が必要です（2-5秒程度）

### Step 3: セッション終了

```
1. "End Session" ボタンをクリック
2. "Session ended successfully" トーストメッセージを確認
3. セッション詳細ページにリダイレクトされる
```

### Step 4: データ確認（ブラウザ）

セッション詳細ページで以下を確認：

```
✅ セッションステータスが "COMPLETED" になっている
✅ 開始時刻・終了時刻・継続時間が表示されている
✅ 文字起こしセクションに会話内容が表示されている
   - USER: あなたの発言
   - AI: アバターの応答
✅ 録画ビデオが表示されている（ビデオチャンク送信した場合）
```

### Step 5: データ確認（データベース）

ターミナルで以下のコマンドを実行：

```bash
# 最新セッションの確認
bash scripts/db-query.sh "SELECT id, status, started_at, ended_at, duration_sec FROM sessions ORDER BY started_at DESC LIMIT 1"

# 期待される結果:
# - status: "COMPLETED" ✅
# - ended_at: 現在時刻付近 ✅
# - duration_sec: 実際の継続時間（秒） ✅
```

```bash
# 文字起こしの確認（セッションIDを置き換えてください）
bash scripts/db-query.sh "SELECT speaker, text, timestamp_start FROM transcripts WHERE session_id = '<SESSION_ID>' ORDER BY timestamp_start"

# 期待される結果:
# - USER と AI の発言が交互に記録されている ✅
# - text に実際の発言内容が入っている ✅
```

```bash
# 録画データの確認
bash scripts/db-query.sh "SELECT type, processing_status, cdn_url FROM recordings WHERE session_id = '<SESSION_ID>'"

# 期待される結果:
# - type: "COMBINED" ✅
# - processing_status: "COMPLETED" ✅
# - cdn_url: CloudFront URL ✅
```

## 🔍 トラブルシューティング

### 問題1: 文字起こしが表示されない

**原因:** 音声入力が正しく処理されていない

**対処法:**
1. ブラウザの開発者コンソール（F12）を開く
2. Console タブでエラーを確認
3. Network タブで WebSocket 接続を確認
   - `wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev` に接続されているか
   - メッセージの送受信が行われているか

### 問題2: セッションステータスが "ACTIVE" のまま

**原因:** `session_end` メッセージが送信されていない

**対処法:**
1. "End Session" ボタンを再度クリック
2. WebSocket接続が切断されているか確認
3. データベースで手動更新:
   ```bash
   # 注意: これは緊急時のみ使用
   bash scripts/db-query.sh --write "UPDATE sessions SET status = 'COMPLETED', ended_at = NOW(), duration_sec = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER WHERE id = '<SESSION_ID>'"
   ```

### 問題3: 録画が表示されない

**原因:** ビデオチャンクが送信されていない

**説明:**
- 現在の実装では、ビデオチャンクを手動で送信する必要があります
- 音声のみのセッションでは録画は作成されません
- これは期待される動作です

## 📊 デプロイ情報

**デプロイ対象:**
- WebSocket Lambda関数 (`prance-websocket-default-dev`)

**変更内容:**
```diff
+ 文字起こし保存: onTranscriptComplete コールバック
+ AI応答保存: onAIComplete コールバック
+ セッションステータス更新: session_end + speech_end ハンドラ
+ 終了時刻・継続時間計算
```

**ログ確認:**
```bash
# WebSocket Lambda のログ確認
aws logs tail /aws/lambda/prance-websocket-default-dev --follow --since 10m

# 確認すべきログメッセージ:
# - "[Streaming] Transcript saved to database"
# - "[Streaming] AI transcript saved to database"
# - "[session_end] Session status updated to COMPLETED"
```

## ✅ テスト完了の確認

以下の全てが ✅ になれば成功：

- [ ] セッションが正常に開始できた
- [ ] 音声入力・AI応答が動作した
- [ ] セッションが正常に終了できた
- [ ] セッションステータスが `COMPLETED` になった
- [ ] 文字起こしがデータベースに保存された
- [ ] 終了時刻と継続時間が記録された
- [ ] ブラウザで文字起こしが表示された

## 🐛 問題が発生した場合

1. **CloudWatch Logs を確認:**
   ```bash
   aws logs tail /aws/lambda/prance-websocket-default-dev --follow --since 30m | grep -E "Transcript|session_end|COMPLETED"
   ```

2. **データベースの生データを確認:**
   ```bash
   bash scripts/db-query.sh "SELECT * FROM sessions WHERE id = '<SESSION_ID>'"
   bash scripts/db-query.sh "SELECT * FROM transcripts WHERE session_id = '<SESSION_ID>'"
   ```

3. **問題を報告:**
   - エラーメッセージ
   - セッションID
   - 実行したステップ
   - CloudWatch Logsのスナップショット

## 📝 次回セッションへの引き継ぎ

テスト結果を `START_HERE.md` に記録してください：

```markdown
## 最新テスト結果（2026-03-15）

- [✅/❌] 文字起こし保存
- [✅/❌] セッションステータス更新
- [✅/❌] ブラウザ表示

問題点: （あれば記載）
```
