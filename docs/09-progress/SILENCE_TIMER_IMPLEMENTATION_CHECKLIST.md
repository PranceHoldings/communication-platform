# 沈黙タイマー機能 実装チェックリスト

**作成日:** 2026-03-15 02:35 JST
**ステータス:** 検証中
**目的:** 沈黙タイマー機能が動作しない原因を段階的に特定し、全て対応する

---

## 設計概要

### 機能要件
1. **タイマー表示**: ユーザーが無言の間、カウントアップタイマーを表示
2. **タイムアウト処理**: 指定時間（デフォルト10秒）経過後、AIが会話を促すメッセージを送信
3. **階層的設定**:
   - 優先度1: Scenario個別設定
   - 優先度2: Organization組織デフォルト設定
   - 優先度3: システムデフォルト値（true/10秒）

### 技術スタック
- **Frontend**: Next.js 15, React hooks (`useSilenceTimer`)
- **Backend**: AWS Lambda (Node.js 22), WebSocket (AWS IoT Core)
- **Database**: Aurora Serverless v2 (PostgreSQL), Prisma ORM
- **AI**: AWS Bedrock Claude, ElevenLabs TTS

---

## 検証結果

### ✅ Phase 1: データベーススキーマ（完了）

**Scenarioテーブル:**
```sql
showSilenceTimer    Boolean? @map("show_silence_timer")   -- UIタイマー表示（null = use org default）
enableSilencePrompt Boolean? @map("enable_silence_prompt") -- プロンプト有効化（null = use org default）
silenceTimeout      Int?     @map("silence_timeout")       -- タイムアウト秒数（null = use org default）
silenceThreshold    Float?   @map("silence_threshold")     -- 音量閾値（null = use org default）
minSilenceDuration  Int?     @map("min_silence_duration")  -- 最小無音時間ms（null = use org default）
```

**Organizationテーブル:**
```sql
settings Json? @default("{}")  -- JSON型でデフォルト設定を保存
```

**Organization Settings JSON構造:**
```json
{
  "showSilenceTimer": true,
  "enableSilencePrompt": true,
  "silenceTimeout": 10,
  "silenceThreshold": 0.15,
  "minSilenceDuration": 200
}
```

**検証方法:**
```bash
# Prismaスキーマ確認
grep -A 10 "無音時間管理" packages/database/prisma/schema.prisma
```

**結果:** ✅ スキーマ定義は正しい

---

### ✅ Phase 2: データベースマイグレーション（完了）

**マイグレーションファイル:**
1. `20260311_add_silence_management_to_scenarios/` - フィールド追加
2. `20260312_remove_silence_defaults/` - デフォルト値削除（階層的設定を有効化）

**マイグレーション内容:**
```sql
-- Step 1: フィールド追加（デフォルト値あり）
ALTER TABLE "scenarios"
ADD COLUMN "show_silence_timer" BOOLEAN DEFAULT false,
ADD COLUMN "enable_silence_prompt" BOOLEAN DEFAULT true,
ADD COLUMN "silence_timeout" INTEGER DEFAULT 10,
...

-- Step 2: デフォルト値削除（組織設定を優先）
ALTER TABLE "scenarios" ALTER COLUMN "show_silence_timer" DROP DEFAULT;
UPDATE "scenarios" SET "show_silence_timer" = NULL WHERE "show_silence_timer" = false;
...
```

**検証方法:**
```bash
# マイグレーション存在確認
ls packages/database/prisma/migrations | grep silence

# マイグレーション実行確認（Lambda経由）
aws lambda invoke --function-name prance-db-migration-dev \
  --payload '{}' /tmp/migration-result.json
```

**結果:** ✅ マイグレーションファイル存在、実行状況は後続で確認

---

### ✅ Phase 3: Frontend実装（完了）

#### 3.1 useSilenceTimer Hook

**ファイル:** `apps/web/hooks/useSilenceTimer.ts`

**主要機能:**
- 1秒の猶予期間（即座のタイムアウト防止）
- AI再生中/ユーザー発話中/処理中は停止
- カウントアップタイマー（0秒から開始）
- タイムアウト時にコールバック実行

**検証方法:**
```bash
# Hook存在確認
ls apps/web/hooks/useSilenceTimer.ts

# Hook実装確認
grep -A 20 "export function useSilenceTimer" apps/web/hooks/useSilenceTimer.ts
```

**結果:** ✅ Hook実装済み

#### 3.2 SessionPlayer統合

**ファイル:** `apps/web/components/session-player/index.tsx`

**統合箇所:**
- **Line 24:** Import `useSilenceTimer`
- **Line 837-841:** 階層的設定値の計算
- **Line 844-856:** デバッグログ出力
- **Line 859-868:** Hook呼び出し
- **Line 1454-1463:** UI表示コンポーネント

**階層的設定（修正済み）:**
```typescript
// Line 839: デフォルト値を true に修正済み
const effectiveShowSilenceTimer = scenario.showSilenceTimer ?? orgSettings?.showSilenceTimer ?? true;
const effectiveSilenceTimeout = scenario.silenceTimeout ?? orgSettings?.silenceTimeout ?? 10;
const effectiveEnableSilencePrompt = scenario.enableSilencePrompt ?? orgSettings?.enableSilencePrompt ?? true;
```

**Hook呼び出し:**
```typescript
const { elapsedTime: silenceElapsedTime, resetTimer: _resetSilenceTimer } = useSilenceTimer({
  enabled: status === 'ACTIVE' && initialGreetingCompleted && effectiveEnableSilencePrompt,
  timeoutSeconds: effectiveSilenceTimeout,
  isAIPlaying: isPlayingAudio,
  isUserSpeaking: isMicRecording,
  isProcessing: isProcessing,
  onTimeout: handleSilenceTimeout,
});
```

**UI表示条件:**
```typescript
{effectiveShowSilenceTimer && status === 'ACTIVE' && initialGreetingCompleted && (
  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
    <div className="text-xs text-indigo-600">Silence Timer</div>
    <div className="text-xl font-mono">{silenceElapsedTime}s / {effectiveSilenceTimeout}s</div>
  </div>
)}
```

**検証方法:**
```bash
# SessionPlayerでの使用確認
grep "useSilenceTimer" apps/web/components/session-player/index.tsx

# UI表示コード確認
grep -A 10 "Silence Timer Display" apps/web/components/session-player/index.tsx
```

**結果:** ✅ 統合完了、デフォルト値修正済み

#### 3.3 翻訳キー

**ファイル:**
- `apps/web/messages/en/sessions.json`
- `apps/web/messages/ja/sessions.json`

**翻訳キー:**
```json
{
  "sessions": {
    "player": {
      "silenceTimer": {
        "label": "Silence Timer" // 英語
        "label": "沈黙" // 日本語
      }
    }
  }
}
```

**検証方法:**
```bash
# 翻訳キー確認
grep -A 3 "silenceTimer" apps/web/messages/en/sessions.json
grep -A 3 "silenceTimer" apps/web/messages/ja/sessions.json
```

**結果:** ✅ 翻訳キー存在

---

### ✅ Phase 4: Backend実装（完了）

#### 4.1 Lambda Handler

**ファイル:** `infrastructure/lambda/websocket/default/index.ts`

**ハンドラー:** `case 'silence_prompt_request'` (Line 595-717)

**処理フロー:**
1. スロットリングチェック（60秒以内の重複防止）
2. DynamoDBに最終プロンプト時刻を保存
3. AWS Bedrock Claudeで会話を促すプロンプトを生成
4. ElevenLabs TTSで音声生成
5. S3に音声保存
6. WebSocket経由でクライアントに送信

**検証方法:**
```bash
# Handler存在確認
grep -A 5 "case 'silence_prompt_request'" infrastructure/lambda/websocket/default/index.ts
```

**結果:** ✅ Handler実装済み

#### 4.2 デプロイ状況

**検証方法:**
```bash
# Lambda関数デプロイ確認
aws lambda get-function --function-name prance-websocket-default-dev

# Lambda環境変数確認
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Environment.Variables'
```

**結果:** ⚠️ デプロイ状況は後続で確認

---

## ❌ Phase 5: 未実装・問題箇所の特定

### 5.1 データベースマイグレーション適用状況

**問題:** マイグレーションファイルは存在するが、実際にデータベースに適用されているか不明

**確認方法:**
```bash
# Prisma Clientを直接使用して確認（要データベース接続）
cd packages/database
pnpm exec prisma db pull  # スキーマをデータベースから取得
pnpm exec prisma migrate status  # マイグレーション状況確認
```

**代替方法（Lambda経由）:**
```bash
# マイグレーションLambdaを実行
aws lambda invoke --function-name prance-db-migration-dev \
  --payload '{}' /tmp/migration-result.json
cat /tmp/migration-result.json
```

**対応:**
- [ ] マイグレーション適用状況を確認
- [ ] 未適用の場合、`pnpm exec prisma migrate deploy` を実行

---

### 5.2 Organization Settings（組織デフォルト設定）

**問題:** 組織のデフォルト設定が存在するか、正しい値が入っているか不明

**確認方法:**
```bash
# API経由で組織設定を取得
curl -X GET http://localhost:3000/api/settings \
  -H "Authorization: Bearer <token>" | jq
```

**期待される値:**
```json
{
  "showSilenceTimer": true,
  "enableSilencePrompt": true,
  "silenceTimeout": 10,
  "silenceThreshold": 0.15,
  "minSilenceDuration": 200
}
```

**対応:**
- [ ] 組織設定を取得
- [ ] 設定が存在しない場合、デフォルト値を設定するAPIを実装
- [ ] Settings画面でUI編集可能にする

---

### 5.3 Scenario Settings（シナリオ個別設定）

**問題:** 編集画面で設定を変更しても、データベースに保存されているか不明

**確認方法:**
```bash
# ブラウザでシナリオ詳細ページを開く
# http://localhost:3000/dashboard/scenarios/28c97f47-b51c-4334-aac3-dbb14c681c42

# 「沈黙タイマー設定」セクションを確認
# - showSilenceTimer: 緑（有効）/ 赤（無効）/ グレー（デフォルト使用）
# - enableSilencePrompt: 同上
# - silenceTimeout: 秒数 / グレー（デフォルト使用）
```

**対応:**
- [ ] シナリオ詳細ページで設定値を確認
- [ ] グレー（デフォルト使用）でない場合、編集画面で「デフォルトを使用」に変更
- [ ] 保存後、データベースに`NULL`が保存されることを確認

---

### 5.4 ブラウザコンソールでのデバッグ

**問題:** `effectiveShowSilenceTimer`が実際にtrueになっているか不明

**確認方法:**
```javascript
// ブラウザ開発者ツール（F12）のコンソールで確認
// セッション開始時に以下のログが出力される

[SessionPlayer] Silence timer configuration: {
  'scenario.showSilenceTimer': null,  // シナリオ設定値
  'orgSettings?.showSilenceTimer': true,  // 組織設定値
  effectiveShowSilenceTimer: true,  // 最終的に使用される値
  'scenario.enableSilencePrompt': null,
  'orgSettings?.enableSilencePrompt': true,
  effectiveEnableSilencePrompt: true,
  'scenario.silenceTimeout': null,
  'orgSettings?.silenceTimeout': 10,
  effectiveSilenceTimeout: 10,
  status: 'ACTIVE',
  initialGreetingCompleted: true
}
```

**対応:**
- [ ] ブラウザでセッションを開始
- [ ] コンソールログを確認
- [ ] `effectiveShowSilenceTimer`が`false`の場合、原因を特定
- [ ] `status`、`initialGreetingCompleted`の値も確認

---

### 5.5 useSilenceTimer Hook動作状況

**問題:** Hookが実際に起動しているか、タイマーがカウントされているか不明

**確認方法:**
```javascript
// useSilenceTimer.ts内のログ（既に実装済み）
[useSilenceTimer] Starting timer  // タイマー開始
[useSilenceTimer] Stopping timer: { reason: 'AI playing' }  // 停止理由
[useSilenceTimer] Timer tick: 3s  // カウント状況
[useSilenceTimer] Timeout! Calling onTimeout callback  // タイムアウト
```

**対応:**
- [ ] コンソールで`[useSilenceTimer]`ログを検索
- [ ] ログが出力されない場合、Hook起動条件を確認
  - `enabled: status === 'ACTIVE' && initialGreetingCompleted && effectiveEnableSilencePrompt`
- [ ] ログが出力されるが停止される場合、停止理由を確認
  - `isAIPlaying: true` → AI再生中
  - `isUserSpeaking: true` → ユーザー発話中
  - `isProcessing: true` → 処理中

---

### 5.6 UI表示条件

**問題:** タイマーUIが表示されない原因の特定

**表示条件（全て満たす必要がある）:**
1. `effectiveShowSilenceTimer === true`
2. `status === 'ACTIVE'`
3. `initialGreetingCompleted === true`

**確認方法:**
```javascript
// ブラウザコンソールで確認
// Line 844-856のデバッグログに全ての値が出力される
```

**対応:**
- [ ] 各条件の値を確認
- [ ] どれか1つでもfalseの場合、その原因を特定

---

### 5.7 Lambda Handler動作状況

**問題:** `silence_prompt_request`が実際に呼ばれているか、正常に動作しているか不明

**確認方法:**
```bash
# CloudWatch Logs確認
aws logs tail /aws/lambda/prance-websocket-default-dev --since 10m --follow

# 期待されるログ:
[silence_prompt_request] Received silence prompt request
[silence_prompt_request] Generating silence prompt: {...}
[silence_prompt_request] Generated prompt: "..."
[silence_prompt_request] TTS audio generated, uploading to S3
[silence_prompt_request] Sent AI response to client
```

**対応:**
- [ ] セッションでタイムアウトまで待機
- [ ] CloudWatch Logsで上記ログを確認
- [ ] エラーが出力される場合、原因を特定

---

## 📋 実施手順（優先順位順）

### Step 1: ブラウザコンソールでデバッグログ確認 🔴 最優先

**目的:** 現在の設定値と状態を確認

**手順:**
1. ブラウザでNext.jsをリフレッシュ（Ctrl+Shift+R）
2. セッションを開始
3. 開発者ツール（F12）のコンソールタブを開く
4. `[SessionPlayer] Silence timer configuration:` ログを探す
5. 以下の値を確認:
   - `effectiveShowSilenceTimer`
   - `effectiveEnableSilencePrompt`
   - `effectiveSilenceTimeout`
   - `status`
   - `initialGreetingCompleted`

**期待結果:**
```javascript
effectiveShowSilenceTimer: true  // ✅
effectiveEnableSilencePrompt: true  // ✅
effectiveSilenceTimeout: 10  // ✅
status: 'ACTIVE'  // ✅
initialGreetingCompleted: true  // ✅ (初回挨拶完了後)
```

**問題があった場合の対応:**
- `effectiveShowSilenceTimer: false` → Step 2へ
- `status !== 'ACTIVE'` → セッションが正常に開始されているか確認
- `initialGreetingCompleted: false` → 初回挨拶が完了するまで待機

---

### Step 2: シナリオ・組織設定の確認

**目的:** データベースに正しい設定値が保存されているか確認

**手順:**
1. シナリオ詳細ページを開く:
   `http://localhost:3000/dashboard/scenarios/28c97f47-b51c-4334-aac3-dbb14c681c42`

2. 「沈黙タイマー設定」セクションを確認:
   - **showSilenceTimer**: グレー（デフォルト使用）を期待
   - **enableSilencePrompt**: グレー（デフォルト使用）を期待
   - **silenceTimeout**: グレー（デフォルト使用）を期待

3. 赤（無効）またはグレー以外の場合:
   - シナリオ編集ページを開く
   - トグルをクリックしてグレー（デフォルト使用）に変更
   - 「シナリオを更新」をクリック
   - 詳細ページで確認

4. 組織設定を確認:
   - `http://localhost:3000/dashboard/settings`
   - 「沈黙タイマー」関連の設定を確認

**期待結果:**
- シナリオ設定: 全て `NULL`（デフォルト使用）
- 組織設定: `showSilenceTimer: true`, `enableSilencePrompt: true`, `silenceTimeout: 10`

---

### Step 3: useSilenceTimer Hook動作確認

**目的:** Hookが実際に起動し、タイマーがカウントされているか確認

**手順:**
1. ブラウザコンソールで`[useSilenceTimer]`を検索
2. 以下のログが出力されることを確認:
   - `[useSilenceTimer] Starting timer`
   - `[useSilenceTimer] Timer tick: 1s`
   - `[useSilenceTimer] Timer tick: 2s`
   - ...
   - `[useSilenceTimer] Timeout! Calling onTimeout callback`

**期待結果:**
- タイマーが1秒ごとにカウントアップ
- 10秒でタイムアウトコールバックが実行される

**問題があった場合:**
- ログが全く出力されない → Hook起動条件を確認（Step 1のデバッグログ）
- タイマーが途中で停止 → 停止理由のログを確認

---

### Step 4: Lambda Handler動作確認

**目的:** タイムアウト時にLambda関数が正しく動作するか確認

**手順:**
1. セッションを開始
2. 10秒間無言で待機
3. CloudWatch Logsを確認:
   ```bash
   aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m
   ```
4. 以下のログを確認:
   - `[silence_prompt_request] Received silence prompt request`
   - `[silence_prompt_request] Generating silence prompt`
   - `[silence_prompt_request] Sent AI response to client`

**期待結果:**
- 10秒後にLambda関数が呼ばれる
- AIが会話を促すメッセージを送信
- ブラウザでAI音声が再生される

---

### Step 5: マイグレーション適用状況確認（必要に応じて）

**目的:** データベースに沈黙タイマーフィールドが存在するか確認

**手順:**
```bash
# packages/databaseディレクトリに移動
cd packages/database

# マイグレーション状況確認
pnpm exec prisma migrate status

# 未適用のマイグレーションがある場合
pnpm exec prisma migrate deploy
```

**期待結果:**
- 全てのマイグレーションが適用済み
- `scenarios`テーブルに`show_silence_timer`等のカラムが存在

---

## 🐛 既知の問題と解決策

### 問題1: ブラウザキャッシュで古いコードが使用される

**症状:** コード修正後もタイマーが表示されない

**解決策:**
```bash
# ハードリフレッシュ
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# または開発者ツールでキャッシュ無効化
F12 → Network → Disable cache をチェック
```

---

### 問題2: effectiveShowSilenceTimer がfalse

**症状:** デバッグログで`effectiveShowSilenceTimer: false`

**原因:** シナリオ設定が`false`、組織設定も`false`またはNULL

**解決策:**
1. シナリオ編集ページで「デフォルトを使用」（グレー）に変更
2. 組織設定ページで「沈黙タイマーを表示」を「有効」に変更

---

### 問題3: useSilenceTimer Hookが起動しない

**症状:** `[useSilenceTimer]`ログが全く出力されない

**原因:** Hook起動条件が満たされていない

**起動条件:**
```typescript
enabled: status === 'ACTIVE' && initialGreetingCompleted && effectiveEnableSilencePrompt
```

**解決策:**
- `status !== 'ACTIVE'` → セッションを開始
- `initialGreetingCompleted === false` → 初回挨拶完了まで待機
- `effectiveEnableSilencePrompt === false` → 設定を確認（問題2と同じ）

---

### 問題4: タイマーが途中で停止

**症状:** タイマーがカウントアップするが、すぐに停止する

**原因:** 停止条件が満たされている

**停止条件:**
- `isAIPlaying: true` → AI音声再生中
- `isUserSpeaking: true` → ユーザー発話中
- `isProcessing: true` → 処理中（speech_end等）

**解決策:**
これらは正常な動作です。AI再生中やユーザー発話中はタイマーを停止すべきです。

---

### 問題5: Lambda関数が呼ばれない

**症状:** 10秒経過してもLambda関数が呼ばれない

**原因:** WebSocket送信エラー、またはLambda関数デプロイミス

**解決策:**
1. ブラウザコンソールでWebSocketエラーを確認
2. Lambda関数を再デプロイ:
   ```bash
   pnpm run deploy:websocket
   ```
3. CloudWatch Logsでエラーを確認

---

## ✅ 最終確認チェックリスト

実装完了後、以下を全て確認してください：

- [ ] **タイマー表示**: セッション画面右上に「Silence Timer: Xs / 10s」が表示される
- [ ] **カウントアップ**: 1秒ごとにカウントが増える
- [ ] **AI再生中停止**: AI音声再生中はタイマーが停止する
- [ ] **ユーザー発話中停止**: ユーザーが話すとタイマーがリセットされる
- [ ] **タイムアウト**: 10秒経過後、AIが会話を促すメッセージを送信
- [ ] **AI音声再生**: タイムアウト後、AIの音声が自動再生される
- [ ] **設定変更**: シナリオ編集画面で設定を変更できる
- [ ] **階層的設定**: シナリオ設定 → 組織設定 → デフォルト値の順に適用される

---

## 📝 デバッグログ収集手順

問題報告時は以下の情報を提供してください：

### 1. ブラウザコンソールログ
```javascript
// セッション開始時のログ
[SessionPlayer] Silence timer configuration: {...}

// useSilenceTimerのログ
[useSilenceTimer] Starting timer
[useSilenceTimer] Timer tick: 1s
```

### 2. CloudWatch Logs
```bash
aws logs tail /aws/lambda/prance-websocket-default-dev --since 10m
```

### 3. シナリオ設定値
- シナリオ詳細ページのスクリーンショット
- 「沈黙タイマー設定」セクションの各設定値

### 4. 組織設定値
- Settings画面のスクリーンショット
- 沈黙タイマー関連の設定値

---

## 📚 関連ドキュメント

- [CLAUDE.md](../../CLAUDE.md) - プロジェクト全体の設計
- [MEMORY.md](../../../.claude/projects/-workspaces-prance-communication-platform/memory/MEMORY.md) - 開発履歴
- [SESSION_HISTORY.md](./SESSION_HISTORY.md) - Day 12-17セッション記録
- [prisma-schema-fix.md](../../../.claude/projects/-workspaces-prance-communication-platform/memory/prisma-schema-fix.md) - Prisma Client問題解決記録

---

**次回アクション:**
1. Step 1（ブラウザコンソールでデバッグログ確認）を実施
2. 結果に基づいて問題箇所を特定
3. 該当するStepを実施して修正
