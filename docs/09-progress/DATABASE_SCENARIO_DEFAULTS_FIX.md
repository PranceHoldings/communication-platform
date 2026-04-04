# Database Scenario Defaults Fix - 2026-03-11

## 問題

Week 2 Day 12のテスト中に、既存シナリオが無音管理（Silence Management）フィールドに NULL 値を持っていることが判明しました。

### 根本原因

1. **Week 1 マイグレーション** でカラムを追加し、`DEFAULT` 制約を設定
2. PostgreSQLは `DEFAULT` 制約を **新規行のみ** に適用
3. **既存の行** には NULL 値が残ったまま

### 影響

テスト中のシナリオ「面接練習 - 基本編 - 追加」が以下の問題を引き起こしました:

```javascript
// WebSocketメッセージで送信されたデータ
{
  hasInitialGreeting: false,      // ❌ initialGreeting が NULL
  silenceTimeout: undefined,       // ❌ silenceTimeout が NULL
  enableSilencePrompt: undefined   // ❌ enableSilencePrompt が NULL
}
```

これにより:
- ❌ AI初回挨拶が生成されない
- ❌ 無音タイマーが動作しない
- ❌ 無音促し機能が無効
- ❌ 音声認識でエラー発生 (InitialSilenceTimeout, NotRecognized)

## 解決策

3つのアプローチを用意しました。**推奨順序で選択してください。**

---

## 🥇 推奨: Option 1 - Lambda関数による自動更新（最も簡単）

### ステップ 1: デプロイ完了を待つ

現在、Lambda関数をデプロイ中です。

```bash
# デプロイステータス確認
cd infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### ステップ 2: Lambda関数を実行

デプロイ完了後、以下のコマンドで実行:

```bash
aws lambda invoke \
  --function-name prance-populate-scenario-defaults-dev \
  --payload '{}' \
  /tmp/populate-result.json \
  && cat /tmp/populate-result.json | jq '.'
```

### 期待される出力

```json
{
  "success": true,
  "scenariosUpdated": 5,
  "scenariosFailed": 0,
  "remainingNulls": 0,
  "updatedScenarios": [
    "面接練習 - 基本編 - 追加",
    "カスタマーサポート - 初級",
    // ... 他のシナリオ
  ]
}
```

### 完了確認

```bash
# シナリオが正しく更新されたか確認
aws lambda invoke \
  --function-name prance-scenarios-list-dev \
  --payload '{"queryStringParameters":{"limit":"10"}}' \
  /tmp/scenarios.json \
  && cat /tmp/scenarios.json | jq '.body | fromjson | .scenarios[] | {title, silenceTimeout, enableSilencePrompt}'
```

---

## 🥈 代替: Option 2 - AWS RDS Query Editorで SQL実行

### 前提条件

- AWS Console にログイン済み
- RDS Query Editor v2 にアクセス可能

### 手順

1. **AWS Console → RDS → Query Editor** を開く

2. **接続情報を選択:**
   - Database: `prance-dev-database-auroracluster23d869c0-q5mfamjdr2yp`
   - Secret: `prance/aurora/dev`
   - Database name: `prance`

3. **以下のSQLを実行:**

```sql
-- 更新が必要なシナリオを確認
SELECT
  id,
  title,
  silence_timeout,
  enable_silence_prompt,
  show_silence_timer,
  silence_threshold,
  min_silence_duration
FROM scenarios
WHERE
  silence_timeout IS NULL
  OR enable_silence_prompt IS NULL
  OR show_silence_timer IS NULL
  OR silence_threshold IS NULL
  OR min_silence_duration IS NULL;

-- デフォルト値で更新
UPDATE scenarios
SET
  silence_timeout = COALESCE(silence_timeout, 10),
  enable_silence_prompt = COALESCE(enable_silence_prompt, true),
  show_silence_timer = COALESCE(show_silence_timer, false),
  silence_threshold = COALESCE(silence_threshold, 0.05),
  min_silence_duration = COALESCE(min_silence_duration, 500)
WHERE
  silence_timeout IS NULL
  OR enable_silence_prompt IS NULL
  OR show_silence_timer IS NULL
  OR silence_threshold IS NULL
  OR min_silence_duration IS NULL;

-- 結果を確認
SELECT
  COUNT(*) as total_scenarios,
  COUNT(CASE WHEN silence_timeout IS NULL THEN 1 END) as null_timeout,
  COUNT(CASE WHEN enable_silence_prompt IS NULL THEN 1 END) as null_enable,
  COUNT(CASE WHEN show_silence_timer IS NULL THEN 1 END) as null_timer,
  COUNT(CASE WHEN silence_threshold IS NULL THEN 1 END) as null_threshold,
  COUNT(CASE WHEN min_silence_duration IS NULL THEN 1 END) as null_duration
FROM scenarios;

-- 期待: すべての null カウントが 0
```

### 完全なSQLスクリプト

`scripts/populate-scenario-defaults.sql` に完全版を用意しています。

---

## 🥉 Option 3 - AWS CLI + RDS Data API

**⚠️ 注意:** 現在、HTTP Endpoint が無効のため使用できません。

有効化する場合:

```bash
aws rds modify-db-cluster \
  --db-cluster-identifier prance-dev-database-auroracluster23d869c0-q5mfamjdr2yp \
  --enable-http-endpoint \
  --apply-immediately
```

その後:

```bash
./scripts/populate-scenario-defaults-aws.sh
```

---

## 設定されるデフォルト値

| フィールド名             | デフォルト値 | 説明                                     |
| ------------------------ | ------------ | ---------------------------------------- |
| `silence_timeout`        | 10           | 無音タイマー（秒）                       |
| `enable_silence_prompt`  | true         | 無音促し有効/無効                        |
| `show_silence_timer`     | false        | UIにタイマー表示                         |
| `silence_threshold`      | 0.05         | 音量閾値（0.01-0.2）                     |
| `min_silence_duration`   | 500          | 最小無音継続時間（ms）                   |
| `initial_greeting`       | NULL         | AI初回挨拶（シナリオ固有のため NULL OK） |

---

## テスト手順

1. **Lambda関数またはSQLでデフォルト値を設定**

2. **開発サーバー再起動:**

   ```bash
   pkill -f "next dev"
   pnpm run dev
   ```

3. **ブラウザでシナリオをテスト:**
   - `/dashboard/scenarios` → 「面接練習 - 基本編 - 追加」を選択
   - 「セッション開始」ボタンをクリック
   - AI初回挨拶が流れることを確認
   - 無音状態で10秒待つ
   - AIが促しメッセージを送信することを確認

4. **コンソールログ確認:**

   期待される出力:

   ```javascript
   [WebSocket] Sent authenticate with scenario data: {
     hasPrompt: true,
     language: 'ja',
     hasInitialGreeting: true,   // ✅ true に変更
     silenceTimeout: 10,          // ✅ 10 に変更
     enableSilencePrompt: true    // ✅ true に変更
   }
   ```

---

## 再発防止策

### 今後のマイグレーションでの対応

新しいカラムにデフォルト値を設定する場合:

```sql
-- ❌ 間違い: 既存行には適用されない
ALTER TABLE scenarios
ADD COLUMN new_field INTEGER DEFAULT 10;

-- ✅ 正しい: 既存行にも適用
ALTER TABLE scenarios
ADD COLUMN new_field INTEGER DEFAULT 10;

UPDATE scenarios
SET new_field = 10
WHERE new_field IS NULL;
```

### Prismaマイグレーション生成時

```bash
# マイグレーション生成
cd packages/database
pnpm exec prisma migrate dev --name add_new_field_with_defaults

# 生成されたSQLに UPDATE文を追加（手動）
vim prisma/migrations/YYYYMMDDHHMMSS_add_new_field_with_defaults/migration.sql
```

---

## 関連ファイル

| ファイル                                                            | 説明                             |
| ------------------------------------------------------------------- | -------------------------------- |
| `scripts/populate-scenario-defaults.sql`                            | SQL スクリプト（手動実行用）     |
| `scripts/populate-scenario-defaults-aws.sh`                         | AWS CLI スクリプト（RDS Data API） |
| `scripts/populate-scenario-defaults.ts`                             | Node.js スクリプト（未使用）     |
| `infrastructure/lambda/maintenance/populate-scenario-defaults/*`    | Lambda 関数（推奨方法）          |
| `infrastructure/lib/api-lambda-stack.ts`                            | Lambda 関数定義（CDK Stack）     |

---

## トラブルシューティング

### Lambda関数が見つからない

```bash
# Lambda関数一覧を確認
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `prance-populate`)].FunctionName'

# CDKデプロイログを確認
cd infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

### SQL実行がタイムアウト

RDS Query Editor でタイムアウトする場合、Lambda関数を使用してください。

### データが更新されない

```bash
# Prisma Clientを再生成
pnpm run db:generate

# 開発サーバーを完全再起動
pkill -f "next dev"
pnpm run dev
```

---

## まとめ

- **推奨:** Lambda関数を実行（最も簡単・安全）
- **代替:** RDS Query EditorでSQLを実行
- **テスト:** Week 2 Day 12のテストシナリオを再実行
- **確認:** コンソールログで `silenceTimeout: 10` を確認

**次のステップ:** Lambda関数実行後、Week 2 Day 12のテストを再実行してください。
