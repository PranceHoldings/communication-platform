# ランタイム設定管理システム（Runtime Configuration Management）

**ステータス:** 📋 将来実装予定（Phase 5以降）
**優先度:** Medium（Phase 4完了後）
**推定工数:** 5-7日（設計 + 実装 + テスト）
**作成日:** 2026-03-19

---

## 📋 目次

1. [機能概要](#機能概要)
2. [目的・メリット](#目的メリット)
3. [対象となる設定項目](#対象となる設定項目)
4. [実装アーキテクチャ](#実装アーキテクチャ)
5. [データモデル設計](#データモデル設計)
6. [UI設計](#ui設計)
7. [セキュリティ考慮事項](#セキュリティ考慮事項)
8. [ホットデプロイメカニズム](#ホットデプロイメカニズム)
9. [実装ステップ](#実装ステップ)
10. [リスク・制約事項](#リスク制約事項)

---

## 機能概要

### 現状の課題

**Phase 3.5（2026-03-19完了）での環境変数管理:**

現在、すべての設定値は `.env.local` で管理され、環境変数として Lambda 関数に渡されています。

```bash
# .env.local
MAX_RESULTS=1000
BCRYPT_SALT_ROUNDS=10
TTS_STABILITY=0.5
CLAUDE_TEMPERATURE=0.7
MIN_CONFIDENCE_THRESHOLD=70
```

**課題:**
- ✅ **単一の真実の源** - 設定値が一元管理されている
- ✅ **型安全性** - env-validator.ts 経由で厳密な型チェック
- ❌ **変更の柔軟性** - 設定値変更には Lambda 再デプロイが必要（5-10分）
- ❌ **環境差異** - dev/staging/production で異なる値を管理するにはデプロイが必要
- ❌ **即時反映** - A/Bテスト、緊急時のパラメータ調整ができない

### 提案する機能

**スーパー管理者UIからのランタイム設定管理:**

スーパー管理者が管理画面から設定値を変更し、**サーバー再起動なしで即座に全Lambda関数に反映**する機能。

```
┌─────────────────────────────────────────────────────────┐
│ Super Admin Dashboard                                   │
│                                                         │
│ Runtime Configuration                                   │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Category: Query & Processing                    │   │
│ │ MAX_RESULTS:          [1000        ] ▼         │   │
│ │ VIDEO_CHUNK_BATCH:    [5           ] ▼         │   │
│ │                                                 │   │
│ │ Category: AI Processing                         │   │
│ │ CLAUDE_TEMPERATURE:   [0.7         ] ▼         │   │
│ │ CLAUDE_MAX_TOKENS:    [1024        ] ▼         │   │
│ │                                                 │   │
│ │ [Save Changes] [Reset to Defaults]             │   │
│ └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
            ↓
    ホットデプロイ（即座に反映）
            ↓
┌─────────────────────────────────────────────────────────┐
│ All Lambda Functions (20+ functions)                    │
│ - 次のリクエストから新しい設定値を使用                │
│ - サーバー再起動不要                                   │
│ - DynamoDB/ElastiCache からリアルタイム取得           │
└─────────────────────────────────────────────────────────┘
```

---

## 目的・メリット

### 1. 運用の柔軟性向上

**Before (環境変数):**
```bash
# 設定変更手順（5-10分）
1. .env.local 編集
2. Lambda 関数デプロイ
3. 動作確認
4. 問題発生時はロールバック・再デプロイ
```

**After (ランタイム設定):**
```bash
# 設定変更手順（即座）
1. 管理画面で変更
2. 保存ボタンクリック
3. 即座に全Lambda関数に反映
4. 問題発生時は管理画面から即座にロールバック
```

### 2. A/Bテスト・実験の実現

```typescript
// 異なるAIパラメータでのA/Bテスト
// Group A: temperature=0.7, max_tokens=1024
// Group B: temperature=0.5, max_tokens=2048

// UIから即座に切り替え可能
// デプロイ不要で実験を繰り返せる
```

### 3. 緊急時の即座対応

**シナリオ: レート制限超過によるサービス停止**

```
09:00 - 大量リクエスト発生、ElevenLabs API レート制限に達する
09:01 - スーパー管理者が管理画面から TTS_STABILITY を 0.5 → 0.3 に変更
        （音質を下げてレート制限を緩和）
09:02 - 全Lambda関数に反映、サービス復旧
09:30 - トラフィック正常化、TTS_STABILITY を 0.5 に戻す
```

### 4. 環境ごとの最適化

```
Development:   MAX_RESULTS=1000  (開発効率重視)
Staging:       MAX_RESULTS=500   (本番に近い設定)
Production:    MAX_RESULTS=100   (パフォーマンス重視)

# UIから環境ごとに異なる値を設定可能
# デプロイ不要で環境差異を管理
```

### 5. 監査ログ・変更履歴

```sql
-- 誰が、いつ、何を変更したか完全記録
SELECT * FROM runtime_config_history
WHERE changed_at >= NOW() - INTERVAL '7 days'
ORDER BY changed_at DESC;

-- 結果:
-- 2026-03-20 10:30:00 | admin@example.com | CLAUDE_TEMPERATURE | 0.7 → 0.5
-- 2026-03-19 15:00:00 | admin@example.com | MAX_RESULTS        | 1000 → 500
```

---

## 対象となる設定項目

### Phase 1: システムパラメータ（緊急度：高）

**Query & Processing:**
```typescript
MAX_RESULTS: number;               // クエリ結果の最大件数
VIDEO_CHUNK_BATCH_SIZE: number;    // 動画チャンクのバッチサイズ
ANALYSIS_BATCH_SIZE: number;       // 解析バッチサイズ
```

**AI Processing:**
```typescript
CLAUDE_TEMPERATURE: number;        // Claude AI の temperature
CLAUDE_MAX_TOKENS: number;         // Claude AI の max_tokens
MAX_AUTO_DETECT_LANGUAGES: number; // STT 自動言語検出の最大数
```

**Security:**
```typescript
RATE_LIMIT_MAX_ATTEMPTS: number;       // レート制限の最大試行回数
RATE_LIMIT_LOCKOUT_DURATION_MS: number;// ロックアウト期間
```

### Phase 2: 音声処理パラメータ（緊急度：中）

**Audio Processing:**
```typescript
MIN_PAUSE_DURATION_SEC: number;    // 最小ポーズ時間
OPTIMAL_PAUSE_SEC: number;         // 最適ポーズ時間
TTS_STABILITY: number;             // TTS 安定性
TTS_SIMILARITY_BOOST: number;      // TTS 類似性ブースト
DEFAULT_STT_CONFIDENCE: number;    // STT デフォルト信頼度
AUDIO_SAMPLE_RATE: number;         // オーディオサンプルレート
SILENCE_THRESHOLD: number;         // 沈黙閾値
```

### Phase 3: スコア計算パラメータ（緊急度：低）

**Score Calculation:**
```typescript
EMOTION_WEIGHT: number;            // 感情スコアの重み
AUDIO_WEIGHT: number;              // 音声スコアの重み
CONTENT_WEIGHT: number;            // 内容スコアの重み
DELIVERY_WEIGHT: number;           // 発表スコアの重み
MIN_CONFIDENCE_THRESHOLD: number;  // 最小信頼度閾値
MIN_QUALITY_THRESHOLD: number;     // 最小品質閾値
```

### 対象外の項目（環境変数のまま）

**機密情報・外部サービスキー:**
```bash
# これらは環境変数のまま管理（セキュリティ上の理由）
DATABASE_URL                # データベース接続文字列
JWT_SECRET                  # JWT署名キー
ELEVENLABS_API_KEY         # ElevenLabs APIキー
AZURE_SPEECH_KEY           # Azure Speech キー
AWS_REGION                 # AWSリージョン
CLOUDFRONT_DOMAIN          # CloudFrontドメイン
```

**理由:**
- 機密情報をデータベースに平文で保存するのはセキュリティリスク
- 外部サービスキーは頻繁に変更されない
- リージョン・ドメインは環境固有の値

---

## 実装アーキテクチャ

### システム構成図

```
┌──────────────────────────────────────────────────────────────────┐
│ Frontend (Next.js)                                               │
│                                                                  │
│ Super Admin Dashboard                                            │
│ /admin/runtime-config                                            │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ - 設定値の表示・編集                                      │   │
│ │ - カテゴリ別グループ化                                    │   │
│ │ - バリデーション（範囲チェック）                          │   │
│ │ - 変更履歴の表示                                          │   │
│ │ - デフォルト値へのリセット                                │   │
│ └──────────────────────────────────────────────────────────┘   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     │ POST /api/v1/admin/runtime-config
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ API Gateway + Lambda                                             │
│                                                                  │
│ PUT /api/v1/admin/runtime-config                                │
│ GET /api/v1/admin/runtime-config                                │
│ GET /api/v1/admin/runtime-config/history                        │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ - 権限チェック（SUPER_ADMIN のみ）                        │   │
│ │ - バリデーション（型・範囲・依存関係）                    │   │
│ │ - Aurora RDS に保存                                       │   │
│ │ - ElastiCache に即座反映（TTL: 1分）                     │   │
│ │ - 変更履歴記録                                            │   │
│ │ - CloudWatch Events 発行（変更通知）                     │   │
│ └──────────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ├──────────────────────────────────────────────────────┐
             │                                                      │
             ▼                                                      ▼
┌──────────────────────────┐                    ┌──────────────────────────┐
│ Aurora RDS               │                    │ ElastiCache Serverless   │
│ (PostgreSQL)             │                    │ (Redis)                  │
│                          │                    │                          │
│ runtime_configs テーブル │◄───────────────────│ Cache Layer              │
│ - key (PK)              │  定期同期（1分毎）  │ - TTL: 60秒              │
│ - value                 │                    │ - 全Lambda関数から参照   │
│ - data_type             │                    │                          │
│ - category              │                    │ キャッシュヒット率: 99%+ │
│ - default_value         │                    │                          │
│ - min_value             │                    └──────────────────────────┘
│ - max_value             │
│ - description           │
│ - updated_at            │
│ - updated_by            │
└──────────────────────────┘
             │
             │ 変更履歴
             ▼
┌──────────────────────────┐
│ runtime_config_history   │
│ - id (PK)               │
│ - key                   │
│ - old_value             │
│ - new_value             │
│ - changed_by            │
│ - changed_at            │
│ - reason                │
└──────────────────────────┘
             │
             │ 全Lambda関数から参照
             ▼
┌──────────────────────────────────────────────────────────────────┐
│ All Lambda Functions                                             │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Config Loader (shared/utils/runtime-config.ts)           │   │
│ │                                                          │   │
│ │ 1. ElastiCache から取得（キャッシュヒット）              │   │
│ │ 2. キャッシュミス時は Aurora RDS から取得                │   │
│ │ 3. 取得失敗時は環境変数フォールバック                    │   │
│ │ 4. すべて失敗時はハードコードデフォルト値（最終手段）    │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ 使用例:                                                          │
│ const maxResults = await getRuntimeConfig('MAX_RESULTS');       │
│ // 環境変数より優先してランタイム設定を使用                     │
└──────────────────────────────────────────────────────────────────┘
```

### データフロー

**設定変更時のフロー:**

```
1. スーパー管理者が管理画面で値を変更
   ↓
2. PUT /api/v1/admin/runtime-config
   - バリデーション
   - 権限チェック（SUPER_ADMIN のみ）
   ↓
3. Aurora RDS に保存
   ↓
4. ElastiCache に即座反映（TTL: 60秒）
   ↓
5. runtime_config_history に変更履歴記録
   ↓
6. CloudWatch Events 発行（変更通知）
   ↓
7. 全Lambda関数が次のリクエストから新しい値を使用
   - ElastiCache から取得（キャッシュヒット）
   - キャッシュ更新は自動（TTL: 60秒）
```

**Lambda関数での設定取得フロー:**

```typescript
// shared/utils/runtime-config.ts

export async function getRuntimeConfig<T>(
  key: string,
  options?: {
    useCache?: boolean;    // デフォルト: true
    fallbackToEnv?: boolean; // デフォルト: true
    throwOnMissing?: boolean; // デフォルト: false
  }
): Promise<T> {
  // 1. ElastiCache から取得（最速）
  const cached = await elasticache.get(`runtime:${key}`);
  if (cached) return JSON.parse(cached);

  // 2. Aurora RDS から取得
  const dbValue = await prisma.runtimeConfig.findUnique({
    where: { key },
  });
  if (dbValue) {
    // ElastiCache に保存（次回のため）
    await elasticache.set(`runtime:${key}`, JSON.stringify(dbValue.value), 60);
    return dbValue.value;
  }

  // 3. 環境変数フォールバック
  if (options?.fallbackToEnv) {
    const envValue = process.env[key];
    if (envValue) return parseEnvValue(envValue);
  }

  // 4. デフォルト値（最終手段）
  const defaultValue = RUNTIME_CONFIG_DEFAULTS[key];
  if (defaultValue !== undefined) return defaultValue;

  // 5. すべて失敗
  if (options?.throwOnMissing) {
    throw new Error(`Runtime config not found: ${key}`);
  }
  return undefined as T;
}
```

---

## データモデル設計

### Prisma スキーマ

```prisma
// packages/database/prisma/schema.prisma

model RuntimeConfig {
  key           String    @id // 設定キー（例: MAX_RESULTS）
  value         Json      // 設定値（JSON形式、型に応じて number/string/boolean）
  dataType      DataType  // データ型（NUMBER/STRING/BOOLEAN/JSON）
  category      String    // カテゴリ（QUERY_PROCESSING/AI_PROCESSING/SECURITY等）
  defaultValue  Json      // デフォルト値
  minValue      Json?     // 最小値（数値型の場合）
  maxValue      Json?     // 最大値（数値型の場合）
  description   String    // 説明文
  isSystem      Boolean   @default(false) // システム設定（削除不可）
  isEditable    Boolean   @default(true)  // 編集可能か
  updatedAt     DateTime  @updatedAt
  updatedBy     String?   // 最終更新者のユーザーID

  history RuntimeConfigHistory[]

  @@map("runtime_configs")
}

model RuntimeConfigHistory {
  id          String   @id @default(cuid())
  key         String   // 設定キー
  oldValue    Json?    // 変更前の値
  newValue    Json     // 変更後の値
  changedBy   String   // 変更者のユーザーID
  changedAt   DateTime @default(now())
  reason      String?  // 変更理由（オプション）
  ipAddress   String?  // 変更元IPアドレス

  config RuntimeConfig @relation(fields: [key], references: [key], onDelete: Cascade)

  @@index([key, changedAt])
  @@map("runtime_config_history")
}

enum DataType {
  NUMBER
  STRING
  BOOLEAN
  JSON
}
```

### データ例

```sql
-- runtime_configs テーブル
INSERT INTO runtime_configs (key, value, data_type, category, default_value, min_value, max_value, description, is_system, is_editable)
VALUES
  ('MAX_RESULTS', '1000', 'NUMBER', 'QUERY_PROCESSING', '1000', '1', '10000', 'Maximum query results', true, true),
  ('CLAUDE_TEMPERATURE', '0.7', 'NUMBER', 'AI_PROCESSING', '0.7', '0.0', '1.0', 'Claude AI temperature', true, true),
  ('TTS_STABILITY', '0.5', 'NUMBER', 'AUDIO_PROCESSING', '0.5', '0.0', '1.0', 'TTS stability parameter', true, true),
  ('RATE_LIMIT_MAX_ATTEMPTS', '5', 'NUMBER', 'SECURITY', '5', '1', '100', 'Rate limit max attempts', true, true);

-- runtime_config_history テーブル
INSERT INTO runtime_config_history (key, old_value, new_value, changed_by, changed_at, reason)
VALUES
  ('CLAUDE_TEMPERATURE', '0.7', '0.5', 'user-admin-001', '2026-03-20 10:30:00', 'A/B test for response quality'),
  ('MAX_RESULTS', '1000', '500', 'user-admin-001', '2026-03-19 15:00:00', 'Performance optimization');
```

---

## UI設計

### 管理画面レイアウト

```
┌────────────────────────────────────────────────────────────────────┐
│ Super Admin Dashboard                                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ Runtime Configuration Management                                   │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search: [                    ] │ Category: [All ▼]          │ │
│ │ [Export CSV] [Import CSV] [Reset All to Defaults]              │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Query & Processing                                            ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ MAX_RESULTS                                            ⓘ       │ │
│ │ Maximum query results                                          │ │
│ │ Current: 1000  │ Default: 1000  │ Range: 1 - 10000           │ │
│ │ [1000                                                      ]   │ │
│ │                                                                │ │
│ │ Last updated: 2026-03-19 15:00:00 by admin@example.com        │ │
│ │ [View History] [Reset to Default]                             │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ VIDEO_CHUNK_BATCH_SIZE                                 ⓘ       │ │
│ │ Video chunk batch size                                         │ │
│ │ Current: 5     │ Default: 5     │ Range: 1 - 100             │ │
│ │ [5                                                         ]   │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ AI Processing                                                 ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ CLAUDE_TEMPERATURE                                     ⓘ       │ │
│ │ Claude AI temperature (creativity vs consistency)              │ │
│ │ Current: 0.5   │ Default: 0.7   │ Range: 0.0 - 1.0           │ │
│ │ [━━━━━●━━━━] 0.5                                              │ │
│ │                                                                │ │
│ │ ⚠️  Changed from default (0.7 → 0.5)                          │ │
│ │ Last updated: 2026-03-20 10:30:00 by admin@example.com        │ │
│ │ Reason: "A/B test for response quality"                       │ │
│ │ [View History] [Reset to Default]                             │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ [Save All Changes] [Cancel]                                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 変更履歴モーダル

```
┌────────────────────────────────────────────────────────────────┐
│ Change History: CLAUDE_TEMPERATURE                      [✕]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Date/Time           │ Changed By │ Old Value │ New Value │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ 2026-03-20 10:30:00 │ admin@... │ 0.7       │ 0.5       │ │
│ │ Reason: A/B test for response quality                    │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ 2026-03-15 14:00:00 │ admin@... │ 0.6       │ 0.7       │ │
│ │ Reason: Restore default after experiment                 │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ 2026-03-10 09:00:00 │ admin@... │ 0.7       │ 0.6       │ │
│ │ Reason: Performance optimization test                    │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ [Export to CSV] [Close]                                        │
└────────────────────────────────────────────────────────────────┘
```

---

## セキュリティ考慮事項

### 1. 権限管理

**アクセス制御:**
```typescript
// ランタイム設定の変更は SUPER_ADMIN のみ
if (user.role !== UserRole.SUPER_ADMIN) {
  throw new ForbiddenError('Only super admins can modify runtime configuration');
}

// 読み取りは CLIENT_ADMIN も可能（監査用）
if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.CLIENT_ADMIN) {
  throw new ForbiddenError('Insufficient permissions');
}
```

### 2. バリデーション

**範囲チェック:**
```typescript
// 最小値・最大値のチェック
if (value < config.minValue || value > config.maxValue) {
  throw new ValidationError(
    `Value ${value} is out of range [${config.minValue}, ${config.maxValue}]`
  );
}

// データ型チェック
if (config.dataType === DataType.NUMBER && typeof value !== 'number') {
  throw new ValidationError(`Expected number, got ${typeof value}`);
}
```

**依存関係チェック:**
```typescript
// スコア重みの合計が1.0になるか検証
const scoreWeights = [
  'EMOTION_WEIGHT',
  'AUDIO_WEIGHT',
  'CONTENT_WEIGHT',
  'DELIVERY_WEIGHT',
];

const sum = scoreWeights.reduce((total, key) => {
  return total + (await getRuntimeConfig<number>(key));
}, 0);

if (Math.abs(sum - 1.0) > 0.001) {
  throw new ValidationError('Score weights must sum to 1.0');
}
```

### 3. 変更理由の記録

```typescript
// 変更時に理由を必須入力
interface UpdateRuntimeConfigRequest {
  key: string;
  value: any;
  reason: string; // 必須
}

// 監査ログに記録
await prisma.runtimeConfigHistory.create({
  data: {
    key,
    oldValue,
    newValue,
    changedBy: user.id,
    changedAt: new Date(),
    reason,
    ipAddress: request.ip,
  },
});
```

### 4. ロールバック機能

```typescript
// 過去の値に即座にロールバック
async function rollbackRuntimeConfig(key: string, historyId: string) {
  const history = await prisma.runtimeConfigHistory.findUnique({
    where: { id: historyId },
  });

  if (!history) {
    throw new NotFoundError('History not found');
  }

  // 旧値に戻す
  await updateRuntimeConfig(key, history.oldValue, {
    reason: `Rollback to previous value (history: ${historyId})`,
  });
}
```

---

## ホットデプロイメカニズム

### ElastiCache による即座反映

```typescript
// 設定変更時のキャッシュ更新
async function updateRuntimeConfig(key: string, value: any) {
  // 1. データベース更新
  await prisma.runtimeConfig.update({
    where: { key },
    data: { value, updatedAt: new Date() },
  });

  // 2. ElastiCache 即座更新
  await elasticache.set(`runtime:${key}`, JSON.stringify(value), 60);

  // 3. CloudWatch Events 発行（オプション）
  await eventBridge.putEvents({
    Entries: [
      {
        Source: 'prance.runtime-config',
        DetailType: 'RuntimeConfigUpdated',
        Detail: JSON.stringify({ key, value }),
      },
    ],
  });
}
```

### Lambda 関数での取得最適化

```typescript
// メモリキャッシュ（Lambda コンテナ内）
const configCache = new Map<string, { value: any; expiry: number }>();

export async function getRuntimeConfig<T>(key: string): Promise<T> {
  // 1. Lambda メモリキャッシュ（最速、TTL: 10秒）
  const cached = configCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.value;
  }

  // 2. ElastiCache（高速、TTL: 60秒）
  const redisValue = await elasticache.get(`runtime:${key}`);
  if (redisValue) {
    const parsed = JSON.parse(redisValue);
    // Lambda メモリキャッシュに保存
    configCache.set(key, { value: parsed, expiry: Date.now() + 10_000 });
    return parsed;
  }

  // 3. Aurora RDS（通常速度）
  const dbValue = await prisma.runtimeConfig.findUnique({ where: { key } });
  if (dbValue) {
    // ElastiCache + Lambda メモリキャッシュに保存
    await elasticache.set(`runtime:${key}`, JSON.stringify(dbValue.value), 60);
    configCache.set(key, { value: dbValue.value, expiry: Date.now() + 10_000 });
    return dbValue.value;
  }

  // 4. 環境変数フォールバック
  return getEnvFallback(key);
}
```

### 反映時間

```
管理画面で保存
    ↓ 0秒
Aurora RDS 更新
    ↓ 0-1秒
ElastiCache 更新
    ↓ 1-10秒（Lambda メモリキャッシュの有効期限による）
全Lambda関数に反映

最大反映時間: 10秒
平均反映時間: 2-5秒
```

---

## 実装ステップ

### Phase 5.1: データモデル・基盤構築（2日）

**タスク:**
1. Prisma スキーマ追加（`RuntimeConfig`, `RuntimeConfigHistory`）
2. データベースマイグレーション実行
3. ElastiCache Serverless 設定追加
4. 初期データ投入（現在の環境変数を移行）

**成果物:**
```bash
packages/database/prisma/migrations/xxx_add_runtime_config_tables.sql
scripts/migrate-env-to-runtime-config.ts
```

### Phase 5.2: Backend API実装（2日）

**タスク:**
1. API エンドポイント実装
   - `GET /api/v1/admin/runtime-config` - 全設定取得
   - `GET /api/v1/admin/runtime-config/:key` - 個別設定取得
   - `PUT /api/v1/admin/runtime-config/:key` - 設定更新
   - `GET /api/v1/admin/runtime-config/:key/history` - 変更履歴取得
   - `POST /api/v1/admin/runtime-config/:key/rollback` - ロールバック

2. バリデーションロジック実装
3. 権限チェック（SUPER_ADMIN のみ）
4. ElastiCache 統合

**成果物:**
```
infrastructure/lambda/admin/runtime-config/
  ├── get.ts
  ├── update.ts
  ├── history.ts
  └── rollback.ts
```

### Phase 5.3: ランタイム設定ローダー実装（1日）

**タスク:**
1. `shared/utils/runtime-config.ts` 実装
2. 既存の `env-validator.ts` との統合
3. フォールバックメカニズム実装
4. ユニットテスト作成

**成果物:**
```typescript
// infrastructure/lambda/shared/utils/runtime-config.ts
export async function getRuntimeConfig<T>(key: string): Promise<T>;
export async function getMaxResults(): Promise<number>;
export async function getClaudeTemperature(): Promise<number>;
// ... すべての設定値用の getter
```

### Phase 5.4: Frontend UI実装（1.5日）

**タスク:**
1. 管理画面ページ作成（`/admin/runtime-config`）
2. カテゴリ別グループ化UI
3. スライダー・入力フォーム
4. 変更履歴モーダル
5. ロールバック機能
6. リアルタイムバリデーション

**成果物:**
```
apps/web/app/admin/runtime-config/
  ├── page.tsx
  └── components/
      ├── ConfigItem.tsx
      ├── ConfigCategory.tsx
      └── HistoryModal.tsx
```

### Phase 5.5: 既存Lambda関数の移行（1日）

**タスク:**
1. 20+ Lambda関数を `getRuntimeConfig()` に移行
2. 環境変数フォールバック設定
3. 統合テスト実行
4. パフォーマンステスト

**成果物:**
- 全Lambda関数が `getRuntimeConfig()` 経由でランタイム設定取得

### Phase 5.6: ドキュメント・デプロイ（0.5日）

**タスク:**
1. 運用ドキュメント作成
2. 設定変更手順書作成
3. トラブルシューティングガイド作成
4. Dev環境デプロイ
5. Production環境デプロイ

**成果物:**
```
docs/08-operations/RUNTIME_CONFIGURATION_GUIDE.md
docs/07-development/RUNTIME_CONFIG_DEVELOPMENT.md
```

---

## リスク・制約事項

### 1. キャッシュ不整合のリスク

**リスク:**
- ElastiCache のTTLが切れるまで古い値が使用される
- 複数Lambda関数でキャッシュのタイミングが異なる

**対策:**
```typescript
// 即座反映が必要な場合は、キャッシュをクリア
async function updateRuntimeConfigUrgent(key: string, value: any) {
  await updateRuntimeConfig(key, value);
  // 全Lambda関数のキャッシュをクリア
  await eventBridge.putEvents({
    Entries: [
      {
        Source: 'prance.runtime-config',
        DetailType: 'RuntimeConfigUrgentUpdate',
        Detail: JSON.stringify({ key, value }),
      },
    ],
  });
}

// Lambda側でEventBridgeイベントを受信してキャッシュクリア
configCache.delete(key);
```

### 2. パフォーマンスへの影響

**リスク:**
- 毎リクエストで設定値を取得するとオーバーヘッド

**対策:**
- 3層キャッシュ（Lambda メモリ → ElastiCache → Aurora RDS）
- キャッシュヒット率 99%+ を目標
- CloudWatch メトリクスで監視

**ベンチマーク目標:**
```
Lambda メモリキャッシュヒット: <0.1ms (99%)
ElastiCache ヒット:            1-2ms  (0.9%)
Aurora RDS アクセス:           5-10ms (0.1%)
```

### 3. 誤設定によるサービス停止

**リスク:**
- 不適切な値設定でLambda関数がエラー

**対策:**
```typescript
// バリデーション強化
const VALIDATION_RULES = {
  MAX_RESULTS: {
    min: 1,
    max: 10000,
    validate: (value: number) => {
      if (value > 5000) {
        return { warning: 'High value may cause performance issues' };
      }
      return { valid: true };
    },
  },
  CLAUDE_TEMPERATURE: {
    min: 0.0,
    max: 1.0,
    validate: (value: number) => {
      if (value < 0.3 || value > 0.9) {
        return { warning: 'Value outside recommended range [0.3, 0.9]' };
      }
      return { valid: true };
    },
  },
};

// ステージング環境で先にテスト
// Production環境には段階的にロールアウト
```

### 4. セキュリティリスク

**リスク:**
- 不正アクセスで設定値が改ざんされる

**対策:**
- SUPER_ADMIN のみアクセス可能
- すべての変更を監査ログに記録
- MFA（多要素認証）必須
- 変更理由の記録必須
- CloudWatch Alarms で異常な変更を検知

---

## 参考実装例

### AWS Systems Manager Parameter Store との比較

**Parameter Store（AWS標準）:**
```typescript
// AWS Systems Manager Parameter Store
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({ region: 'us-east-1' });
const parameter = await ssm.send(
  new GetParameterCommand({ Name: '/prance/MAX_RESULTS' })
);
const value = parameter.Parameter?.Value;
```

**メリット:**
- AWS標準サービス、追加コスト不要
- 暗号化サポート

**デメリット:**
- UI が管理者向けではない（AWS Console）
- 変更履歴の管理が弱い
- ElastiCache との統合が必要

**本実装のメリット:**
- スーパー管理者専用UIで直感的
- 詳細な変更履歴・監査ログ
- ElastiCache 統合で高速アクセス
- カスタムバリデーションルール

---

## まとめ

### 実装の価値

**即座対応:**
- 緊急時のパラメータ調整がデプロイ不要（5-10分 → 10秒）

**運用効率:**
- A/Bテスト・実験が容易
- 環境ごとの最適化が簡単

**監査・コンプライアンス:**
- すべての変更が記録される
- 誰が、いつ、何を変更したか完全追跡

**コスト削減:**
- デプロイ回数削減
- エンジニアの作業時間削減

### 実装タイムライン

```
Phase 5.1: データモデル・基盤構築        2日
Phase 5.2: Backend API実装              2日
Phase 5.3: ランタイム設定ローダー実装    1日
Phase 5.4: Frontend UI実装              1.5日
Phase 5.5: 既存Lambda関数の移行         1日
Phase 5.6: ドキュメント・デプロイ        0.5日
────────────────────────────────────────
合計: 8日（1.6週間）
```

### 次のステップ

1. **Phase 4完了後に実装検討**
2. **Dev環境で先行実装・検証**
3. **段階的にProduction環境へロールアウト**

---

**関連ドキュメント:**
- [ハードコード値削除レポート](../07-development/HARDCODE_ELIMINATION_REPORT.md) - 現在の環境変数管理
- [環境アーキテクチャ](../02-architecture/ENVIRONMENT_ARCHITECTURE.md) - 環境変数の基本設計
- [システムアーキテクチャ](../02-architecture/SYSTEM_ARCHITECTURE.md) - 全体構成

**作成者:** Claude Sonnet 4.5
**レビュー:** 2026-03-19
**次回レビュー:** Phase 4完了時
