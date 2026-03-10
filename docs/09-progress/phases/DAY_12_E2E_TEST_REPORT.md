# Day 12 E2Eテストレポート

**実施日:** 2026-03-11
**テスト環境:** Development (localhost:3000 + AWS Lambda)

---

## 🔴 重要: 正しいURLパス（必読）

**Next.js App Routerのルート構造:**
- ✅ **ダッシュボード**: `/dashboard`
- ✅ **シナリオ一覧**: `/dashboard/scenarios`
- ✅ **アバター一覧**: `/dashboard/avatars`
- ✅ **セッション一覧**: `/dashboard/sessions`
- ✅ **新規シナリオ**: `/dashboard/scenarios/new`
- ✅ **新規アバター**: `/dashboard/avatars/new`
- ✅ **新規セッション**: `/dashboard/sessions/new`
- ✅ **セッション詳細**: `/dashboard/sessions/[id]`

**❌ 間違ったパス（404エラー）:**
- ❌ `/scenarios`, `/avatars`, `/sessions`

**認証情報:**
- Email: `admin@prance.com`
- Password: `Admin2026!Prance`

---

## テスト環境確認

### ✅ 1. Next.js開発サーバー
- **URL:** http://localhost:3000
- **ステータス:** 起動成功
- **確認:** Title tag確認済み

### ✅ 2. Lambda関数
- **Function:** prance-websocket-default-dev
- **LastModified:** 2026-03-10T13:59:44
- **Runtime:** nodejs22.x
- **Size:** 32.4 MB

### ✅ 3. 環境変数
- AZURE_SPEECH_KEY: 設定済み
- ELEVENLABS_API_KEY: 設定済み
- BEDROCK_REGION: us-east-1

---

## テストシナリオ

### テストシナリオ1: 正常フロー（音声会話セッション）

#### 前提条件
- ブラウザ: Chrome/Edge推奨
- マイク: 接続・許可済み
- ネットワーク: 安定

#### テスト手順

**Step 1: ログイン**
1. [ ] http://localhost:3000 にアクセス
2. [ ] ログインフォーム表示確認
3. [ ] 認証情報入力:
   - Email: `admin@prance.com`
   - Password: `Admin2026!Prance`
4. [ ] ログイン成功
5. [ ] ダッシュボード表示

**Step 2: セッション作成**
1. [ ] "Create Session" ボタンをクリック
2. [ ] シナリオ選択画面表示
3. [ ] 任意のシナリオを選択（例: 面接練習）
4. [ ] "Next" ボタンをクリック
5. [ ] アバター選択画面表示
6. [ ] 任意のアバターを選択
7. [ ] "Create Session" ボタンをクリック
8. [ ] セッション詳細画面へ遷移

**Step 3: セッション開始（Day 11 UX改善確認）**
1. [ ] "Start Session" ボタン表示確認
2. [ ] **キーボードショートカットヘルプ (?) アイコン表示** ←Day 11
3. [ ] "Start Session" ボタンをクリック（または Space キー）
4. [ ] マイク許可ダイアログ表示
5. [ ] "許可" をクリック
6. [ ] WebSocket接続開始（"Connecting..." 表示）
7. [ ] 接続成功（緑色のドット + "Connected" 表示）
8. [ ] ステータス変更: "In Progress"
9. [ ] **音声レベルインジケーター表示** ←既存
10. [ ] **音声波形表示（リアルタイム）** ←Day 11 NEW!
    - Canvas要素表示
    - バースタイルの波形
    - 音声に応じて波形が動く

**Step 4: 音声入力（リアルタイムSTT確認）**
1. [ ] マイクに向かって話す（例: "こんにちは"）
2. [ ] 音声レベルインジケーターが反応（バーが伸びる）
3. [ ] **音声波形がリアルタイムで表示** ←Day 11
4. [ ] 無音（500ms）検出
5. [ ] **処理状態インジケーター: "Transcribing speech..."（青色）** ←Day 11 NEW!
6. [ ] トランスクリプトに "USER: こんにちは" 表示（1-2秒以内）
7. [ ] トランスクリプトのタイムスタンプ確認

**Step 5: AI応答（ストリーミングAI確認）**
1. [ ] **処理状態インジケーター: "Generating AI response..."（紫色）** ←Day 11 NEW!
2. [ ] トランスクリプトに "AI: ..." 表示開始（部分更新）
3. [ ] AI応答が徐々に追加される（ストリーミング）
4. [ ] AI応答完了（final更新）

**Step 6: TTS音声再生（リアルタイムTTS確認）**
1. [ ] **処理状態インジケーター: "Synthesizing speech..."（緑色）** ←Day 11 NEW!
2. [ ] 音声再生開始（AI応答開始から1-2秒以内）
3. [ ] スピーカーアイコンが点灯（青色）
4. [ ] 音声が明瞭に再生される
5. [ ] 音声再生完了
6. [ ] **処理状態インジケーター: 非表示（idle）** ←Day 11

**Step 7: 複数ターン会話**
1. [ ] 再度音声入力（例: "ありがとうございます"）
2. [ ] Step 4-6 を繰り返し
3. [ ] トランスクリプトに複数のメッセージが蓄積
4. [ ] スクロール動作確認

**Step 8: セッション停止**
1. [ ] "Stop" ボタンをクリック（または Space/Escape キー）
2. [ ] 録画停止
3. [ ] WebSocket切断
4. [ ] ステータス変更: "Completed"
5. [ ] セッション完了メッセージ表示
6. [ ] 所要時間表示
7. [ ] メッセージ数表示

**期待される結果:**
- ✅ 全ステップがエラーなく完了
- ✅ レスポンス時間: 2-5秒以内
- ✅ 音声品質: 明瞭・自然
- ✅ UI: Day 11の改善が全て反映

---

### テストシナリオ2: キーボードショートカット（Day 11 NEW）

#### テスト手順

**前提条件:**
- セッション詳細画面を開いている
- 入力フィールドにフォーカスしていない

**Test 2-1: Space キー**
1. [ ] セッション開始前（IDLE状態）
2. [ ] Space キーを押す
3. [ ] セッションが開始される（= "Start Session" クリックと同等）

4. [ ] セッション実行中（ACTIVE状態）
5. [ ] Space キーを押す
6. [ ] セッションが停止する（= "Stop" クリックと同等）

**Test 2-2: P キー（一時停止/再開）**
1. [ ] セッション実行中（ACTIVE状態）
2. [ ] P キーを押す
3. [ ] ステータスが "Paused" に変更
4. [ ] 録音一時停止
5. [ ] 再度 P キーを押す
6. [ ] ステータスが "In Progress" に復帰
7. [ ] 録音再開

**Test 2-3: M キー（ミュート/解除）**
1. [ ] セッション実行中（ACTIVE状態）
2. [ ] M キーを押す
3. [ ] **マイクアイコンがミュート状態に変化**
4. [ ] **ミュートメッセージ表示: "Microphone muted"**
5. [ ] **音声レベルインジケーターがグレーアウト**
6. [ ] **音声波形がグレーアウト**
7. [ ] 再度 M キーを押す
8. [ ] マイクアイコンが通常状態に復帰
9. [ ] **ミュート解除メッセージ表示: "Microphone unmuted"**
10. [ ] 音声レベルインジケーターが復帰

**Test 2-4: Escape キー**
1. [ ] セッション実行中（ACTIVE または PAUSED状態）
2. [ ] Escape キーを押す
3. [ ] セッションがキャンセル/停止される

**Test 2-5: ? キー（ヘルプ）**
1. [ ] セッション詳細画面
2. [ ] ? キーを押す
3. [ ] **キーボードショートカットヘルプモーダル表示**
4. [ ] 全ショートカットキーのリスト表示
   - Space: Start/Stop session
   - Escape: Cancel session
   - P: Pause/Resume
   - M: Mute/Unmute microphone
   - ?: Show this help
5. [ ] モーダル外をクリック → モーダルが閉じる

**Test 2-6: 入力フィールドでのショートカット無効化**
1. [ ] セッション詳細画面
2. [ ] メタデータ入力フィールド（があれば）にフォーカス
3. [ ] Space キーを押す
4. [ ] スペース文字が入力される（セッション開始しない）
5. [ ] ✅ ショートカットが正しく無効化されている

**期待される結果:**
- ✅ 全キーボードショートカットが正常動作
- ✅ ミュート状態の視覚的フィードバック明確
- ✅ ヘルプモーダルが正しく表示
- ✅ 入力フィールドでの競合なし

---

### テストシナリオ3: アクセシビリティ（Day 11 WCAG 2.1 AA）

#### Test 3-1: キーボードナビゲーション

**前提条件:**
- セッション詳細画面を開いている
- マウスを使わない

**テスト手順:**
1. [ ] Tab キーを押す（最初のフォーカス）
2. [ ] **キーボードショートカットヘルプボタンにフォーカス**
   - [ ] 明確なフォーカスリング表示（青色、2px）
3. [ ] Tab キーを押す（次へ）
4. [ ] **"Start Session" ボタンにフォーカス**
   - [ ] 明確なフォーカスリング表示（インディゴ色、2px）
5. [ ] Enter キーを押す
6. [ ] セッション開始
7. [ ] Tab キーで順次フォーカス移動
   - [ ] 論理的な順序: ヘッダー → アバターエリア → トランスクリプト → コントロールボタン

**Test 3-2: ARIA labels確認（開発者ツール使用）**
1. [ ] F12 キー → 開発者ツール表示
2. [ ] Elements タブ → Accessibility タブ
3. [ ] "Start Session" ボタンを選択
4. [ ] aria-label 確認: "Start Session (Space)"
5. [ ] "Pause" ボタンを選択
6. [ ] aria-label 確認: "Pause (P)"
7. [ ] "Stop" ボタンを選択
8. [ ] aria-label 確認: "Stop (Space or Escape)"

**Test 3-3: ARIA live regions確認**
1. [ ] 開発者ツール → Elements タブ
2. [ ] `role="status"` の要素を探す
3. [ ] `aria-live="polite"` 属性確認
4. [ ] セッション実行中にステータス変更
5. [ ] live region のテキストが更新される

**Test 3-4: スクリーンリーダーテスト（オプション）**

> **注意:** スクリーンリーダーがインストールされている場合のみ実施

- Windows: NVDA または JAWS
- Mac: VoiceOver（Cmd + F5）
- Linux: Orca

**テスト手順（VoiceOver例）:**
1. [ ] VoiceOver を起動（Cmd + F5）
2. [ ] Tab キーで "Start Session" ボタンへ移動
3. [ ] **読み上げ確認:** "Start Session button, Space"
4. [ ] Enter キーを押してセッション開始
5. [ ] ステータス変更時の読み上げ確認
   - "In Progress"
   - "Transcribing speech..."
   - "Generating AI response..."
   - "Synthesizing speech..."
6. [ ] トランスクリプトの読み上げ確認
   - "USER: こんにちは"
   - "AI: こんにちは！..."

**期待される結果:**
- ✅ 全要素がTabキーでアクセス可能
- ✅ フォーカスリングが明確（2px、色分け）
- ✅ ARIA labels 全ボタンに設定
- ✅ ARIA live regions 動作
- ✅ スクリーンリーダーで全情報取得可能

---

### テストシナリオ4: エラーハンドリング（Day 8-9）

#### Test 4-1: マイク許可拒否

**テスト手順:**
1. [ ] ブラウザ設定でマイクをブロック
2. [ ] セッション開始
3. [ ] **エラーメッセージ表示（多言語）:**
   - 英語: "Microphone access was denied. Please allow microphone permission in your browser settings."
   - 日本語: "マイクへのアクセスが拒否されました。ブラウザの設定でマイクの許可を有効にしてください。"
4. [ ] **"View Details" ボタン表示**
5. [ ] クリックすると**ブラウザ固有の手順表示**
   - Chrome: chrome://settings/content/microphone
   - Firefox: about:preferences#privacy
   - Safari: Safari → Preferences → Websites → Microphone

**Test 4-2: マイクが接続されていない**
1. [ ] マイクを物理的に切断
2. [ ] セッション開始
3. [ ] **エラーメッセージ表示:**
   - "No microphone found. Please connect a microphone and try again."

**Test 4-3: マイクが他のアプリで使用中**
1. [ ] 他のアプリ（Zoom等）でマイクを使用
2. [ ] セッション開始
3. [ ] **エラーメッセージ表示:**
   - "Microphone is currently in use by another application. Please close other applications and try again."

**Test 4-4: 音量不足警告**
1. [ ] セッション開始成功
2. [ ] マイクに向かって**非常に小さい声**で話す（または無音）
3. [ ] 5秒間連続でRMS < 0.01
4. [ ] **警告メッセージ表示:**
   - "Audio level is too low. Please speak louder or adjust your microphone volume."

**Test 4-5: WebSocket接続エラー（シミュレーション困難）**
> ネットワーク切断をシミュレートする必要があるため、オプション

**Test 4-6: APIタイムアウト（30秒）**
> 実際に30秒待つ必要があるため、オプション

**期待される結果:**
- ✅ エラーメッセージが多言語で表示
- ✅ ブラウザ固有の手順が表示
- ✅ ユーザーフレンドリーなメッセージ
- ✅ 技術的なエラーコードは非表示

---

### テストシナリオ5: リトライロジック確認（Day 9）

> **注意:** リトライロジックのテストは意図的にエラーを発生させる必要があるため、
> CloudWatch Logsでの確認が推奨されます。

#### ログ確認方法

```bash
# リアルタイムログ監視
aws logs tail /aws/lambda/prance-websocket-default-dev --follow --since 5m
```

#### 期待されるログパターン

**正常時:**
```json
{
  "timestamp": "2026-03-11T02:00:00.000Z",
  "level": "INFO",
  "message": "STT processing completed",
  "context": {
    "attempts": 1,
    "totalDelay": 0
  }
}
```

**リトライ成功時:**
```json
{
  "timestamp": "2026-03-11T02:00:00.000Z",
  "level": "WARN",
  "message": "Retrying STT API call",
  "context": {
    "attempt": 2,
    "nextRetryIn": 2000,
    "error": "timeout"
  }
}
{
  "timestamp": "2026-03-11T02:00:03.000Z",
  "level": "INFO",
  "message": "STT processing completed",
  "context": {
    "attempts": 2,
    "totalDelay": 2000
  }
}
```

---

## パフォーマンス測定

### 測定項目

#### 1. レスポンス時間（目標: 2-5秒）

**測定方法:**
1. セッション開始
2. 音声入力（"こんにちは"）
3. 無音検出（speech_end）からTTS音声再生開始までの時間を測定

**測定データ（10回実行）:**

| 試行 | 発話内容 | 無音検出 | STT完了 | AI完了 | TTS開始 | 合計時間 | 判定 |
|------|---------|---------|---------|--------|---------|---------|------|
| 1    |         |         |         |        |         |         |      |
| 2    |         |         |         |        |         |         |      |
| 3    |         |         |         |        |         |         |      |
| 4    |         |         |         |        |         |         |      |
| 5    |         |         |         |        |         |         |      |
| 6    |         |         |         |        |         |         |      |
| 7    |         |         |         |        |         |         |      |
| 8    |         |         |         |        |         |         |      |
| 9    |         |         |         |        |         |         |      |
| 10   |         |         |         |        |         |         |      |

**統計:**
- 平均: _____ 秒
- 最小: _____ 秒
- 最大: _____ 秒
- 目標達成（2-5秒）: YES / NO

#### 2. エラー自動回復率（目標: 80%以上）

**測定方法:**
- CloudWatch Logs Insights クエリで集計

```
fields context.attempts, context.totalDelay
| filter message like /completed/
| filter context.attempts > 1
| stats count() as successAfterRetry,
        avg(context.attempts) as avgAttempts,
        avg(context.totalDelay) as avgDelay
```

**測定結果:**
- 一時的エラー発生回数: _____
- 自動回復成功回数: _____
- 自動回復率: _____ %
- 目標達成（80%以上）: YES / NO

---

## テスト結果サマリー

### 実施状況

| テストシナリオ | ステータス | 合格/不合格 | 備考 |
|--------------|-----------|-----------|------|
| 1. 正常フロー | [ ] 実施済み | [ ] PASS / [ ] FAIL | |
| 2. キーボードショートカット | [ ] 実施済み | [ ] PASS / [ ] FAIL | |
| 3. アクセシビリティ | [ ] 実施済み | [ ] PASS / [ ] FAIL | |
| 4. エラーハンドリング | [ ] 実施済み | [ ] PASS / [ ] FAIL | |
| 5. リトライロジック | [ ] 実施済み | [ ] PASS / [ ] FAIL | |

### 検出された問題

#### 重大度: 高（Critical）
- なし

#### 重大度: 中（Major）
- なし

#### 重大度: 低（Minor）
- なし

### 推奨事項
- なし

---

## 次のステップ

### Day 12完了基準
- [ ] すべてのテストシナリオ実施
- [ ] 重大な問題がゼロ
- [ ] レスポンス時間: 2-5秒達成
- [ ] エラー自動回復率: 80%以上達成

### Day 13-14（パフォーマンステスト）
- [ ] 同時接続負荷テスト（5-10セッション）
- [ ] メモリリーク確認（長時間セッション）
- [ ] パフォーマンス最適化（ボトルネック改善）

---

**テスト実施者:** _____________
**実施日時:** _____________
**承認者:** _____________
**承認日時:** _____________
