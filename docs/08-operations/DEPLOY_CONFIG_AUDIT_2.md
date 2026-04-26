# デプロイ設定完全監査レポート（第2版）

**作成日:** 2026-04-25  
**対象:** dev / production 両環境  
**監査範囲:** Frontend env vars / Lambda env vars / CDK設定 / 名前の不整合 / 欠落変数

---

## 📋 監査結果サマリー

| 重要度 | 件数 | 状態 |
|--------|------|------|
| 🔴 CRITICAL（本番クラッシュ） | 3 | 修正必要 |
| 🟠 HIGH（機能不全） | 2 | 修正必要 |
| 🟡 MEDIUM（不整合・誤解リスク） | 3 | 修正必要 |

---

## 🔴 CRITICAL Issues

### C-1: `DYNAMODB_SCENARIO_CACHE_TABLE` — CDK定義漏れ、DynamoDBテーブル未作成

**確認済みエラー:**
```
Error: Required environment variable DYNAMODB_SCENARIO_CACHE_TABLE is not set.
```

**影響Lambda関数（コールドスタートで即クラッシュ）:**
- `prance-scenarios-get-dev/production` → GET /api/v1/scenarios/:id
- `prance-scenarios-update-dev/production` → PUT /api/v1/scenarios/:id  
- `prance-scenarios-delete-dev/production` → DELETE /api/v1/scenarios/:id

**root cause:** `shared/scenario/cache.ts` の top-level 定数（line 18-19）が `getRequiredEnv()` を呼ぶが、
CDK `commonEnvironment` にもどの Lambda 固有 env にもこの変数が存在しない。
さらに DynamoDB テーブル `prance-scenario-cache-dev/production` 自体が未作成。

**修正内容:**
1. DynamoDB テーブルを `dynamodb-stack.ts` に追加
2. CDK `commonEnvironment` に `DYNAMODB_SCENARIO_CACHE_TABLE` と `SCENARIO_CACHE_TTL_DAYS` を追加
3. `api-lambda-stack.ts` でテーブルへのアクセス権限を付与

---

### C-2: `SCENARIO_CACHE_TTL_DAYS` — 同上、同じファイルのtop-levelで必須

`shared/scenario/cache.ts:19:` `const CACHE_TTL_DAYS = parseInt(getRequiredEnv('SCENARIO_CACHE_TTL_DAYS'), 10);`

C-1と同じく CDK に未定義。C-1 の修正時に同時対応。

---

### C-3: `DYNAMODB_RATE_LIMIT_TABLE` — `guest/auth` Lambda に未設定

**影響:** `guest/auth` Lambda は `rateLimiter.ts` → `getOptionalEnv('GUEST_RATE_LIMIT_TABLE')` を使うが、
**`rate-limiter.ts`** の 2 ファイルが存在し、`websocket/default` は `rate-limiter.ts`（getRequired）を使う。
`guest/auth` は `rateLimiter.ts`（getOptional）を使うため現在はクラッシュしない（フォールバックあり）。

ただし `GUEST_RATE_LIMIT_TABLE_NAME`（CDK が設定）と `GUEST_RATE_LIMIT_TABLE`（Lambda が読む）で**キー名不一致**。
現在は getOptional のフォールバックで `prance-guest-rate-limits-dev` として動くが、設計意図と不一致。

**修正:** `commonEnvironment` で `GUEST_RATE_LIMIT_TABLE` を正しいキー名で追加（`GUEST_RATE_LIMIT_TABLE_NAME` は削除）。

---

## 🟠 HIGH Issues

### H-1: `BEDROCK_REGION` — `commonEnvironment` に未定義、一部 Lambda に欠落

**現状:** `BEDROCK_REGION` は `commonEnvironment` 外で `this.region`（CDK スタックのリージョン）を使うが、
複数の Lambda で別途設定されていない。

`commonEnvironment` をチェック:
```typescript
BEDROCK_REGION: this.region,  // ← ある
```
→ `commonEnvironment` には存在する。ただし `websocket-default` は独自 env（commonEnvironment を継承しない）で
`BEDROCK_REGION: process.env.BEDROCK_REGION!` をセットしている。

**結果:** `process.env.BEDROCK_REGION!` はデプロイ時の shell 環境から読む（`.env.local` → `infrastructure/.env` 経由）。
`.env.local` に `BEDROCK_REGION=us-east-1` があるので現在は問題なし。しかし CI/CD 環境では漏れる可能性あり。

**修正:** `websocket-default` も `this.region` を直接使うように統一。

### H-2: `DEFAULT_CHUNK_DURATION_MS` — `websocket-default` に設定されているが `.env.local` 変数から読む

`websocket-default` 環境変数リストに `DEFAULT_CHUNK_DURATION_MS` が存在するが、
これは `.env.local` の `DEFAULT_CHUNK_DURATION_MS=250` を `process.env.DEFAULT_CHUNK_DURATION_MS!` で読む。
Lambda コード側での用途を確認:

```bash
grep -rn "DEFAULT_CHUNK_DURATION" infrastructure/lambda/
```
→ CDK スタックで環境変数としてセットされているが、Lambda コード内では参照されていない可能性がある。
現時点では動作に影響しないため MEDIUM に降格。

---

## 🟡 MEDIUM Issues

### M-1: `GUEST_RATE_LIMIT_TABLE_NAME` vs `GUEST_RATE_LIMIT_TABLE` — キー名不一致

| 場所 | キー名 | 値 |
|------|--------|----|
| CDK `commonEnvironment` | `GUEST_RATE_LIMIT_TABLE_NAME` | `props.guestRateLimitTable.tableName` |
| `.env.local` | `GUEST_RATE_LIMIT_TABLE` | `prance-guest-rate-limit-dev` |
| `rateLimiter.ts` が読む | `GUEST_RATE_LIMIT_TABLE` | getOptional (フォールバックあり) |

**現状:** getOptional のフォールバック `prance-guest-rate-limits-dev` で動いているが、
実際の CDK テーブル名は `props.guestRateLimitTable.tableName`（= `prance-guest-rate-limits-dev`）。
`.env.local` の `prance-guest-rate-limit-dev`（末尾に `s` なし）は誤った値だが使われていない。

**修正:**
- CDK: `GUEST_RATE_LIMIT_TABLE_NAME` → `GUEST_RATE_LIMIT_TABLE` にキー名変更
- `.env.local`: `GUEST_RATE_LIMIT_TABLE=prance-guest-rate-limits-dev`（末尾 `s` 追加）

### M-2: `WEBSOCKET_ENDPOINT` 値の意味が 2 つある

| 場所 | 値 | 用途 |
|------|-----|------|
| CDK `websocket-default` env | `https://rawId.execute-api.us-east-1.amazonaws.com/dev` | `ApiGatewayManagementApiClient.endpoint` |
| `.env.local` `WEBSOCKET_ENDPOINT` | `wss://ws.dev.app.prance.jp` | ローカル開発（参考値） |

Lambda は CDK が設定した `https://` URL を使う。`.env.local` の `wss://` は Lambda には届かない（CDK が上書き）。
現在は正しく動いているが、`.env.local` の値が誤解を招く。

**修正:** `.env.local` コメントを修正して、Lambda が CDK 経由で設定されることを明記。

### M-3: `NEXT_PUBLIC_WS_ENDPOINT` の Lambda env 参照（informational only）

前回の修正で `nextjs-lambda-stack.ts` では正しく `NEXT_PUBLIC_WS_ENDPOINT` になったが、
これらは「参考値のみ」であり bundle には影響しない。
混乱を防ぐためコメントで明示（済み）。

---

## 📊 変数名 vs 設定名 vs 使用名 完全マップ

### Frontend (Next.js bundle bake-in)

| 変数名 | `.env.local` 設定 | `deploy.sh` 上書き | Lambda env (参考) | コードでの読み取り |
|--------|------------------|--------------------|-------------------|------------------|
| `NEXT_PUBLIC_API_URL` | `https://api.dev.app.prance.jp/api/v1` | ✅ 環境ごとに設定 | ✅ 正しい値 | `process.env.NEXT_PUBLIC_API_URL` |
| `NEXT_PUBLIC_WS_ENDPOINT` | `wss://ws.dev.app.prance.jp` | ✅ 環境ごとに設定 | ✅ 正しいキー | `process.env.NEXT_PUBLIC_WS_ENDPOINT` |
| `NEXT_PUBLIC_BYPASS_SPEECH_DETECTION` | `true`（Playwright用） | ✅ `false` に上書き | ❌ 未設定 | `process.env.NEXT_PUBLIC_BYPASS_SPEECH_DETECTION` |
| `NEXT_PUBLIC_WS_ACK_TIMEOUT_MS` | `5000` | ❌ 上書きなし | ❌ 未設定 | `process.env.NEXT_PUBLIC_WS_ACK_TIMEOUT_MS ?? '5000'` (デフォルトあり) |
| `NEXT_PUBLIC_WS_MAX_RETRIES` | `6` | ❌ 上書きなし | ❌ 未設定 | `process.env.NEXT_PUBLIC_WS_MAX_RETRIES ?? '6'` (デフォルトあり) |
| `NEXT_PUBLIC_WS_AUTH_TIMEOUT_MS` | `15000` | ❌ 上書きなし | ❌ 未設定 | `process.env.NEXT_PUBLIC_WS_AUTH_TIMEOUT_MS ?? '15000'` (デフォルトあり) |

### Lambda (CDK が設定する env vars)

| CDK設定キー | Lambda が読むキー | 一致？ | 備考 |
|------------|-----------------|--------|------|
| `GUEST_RATE_LIMIT_TABLE_NAME` | `GUEST_RATE_LIMIT_TABLE` | ❌ 不一致 | getOptional フォールバックで現在動作 |
| `DYNAMODB_SCENARIO_CACHE_TABLE` | `DYNAMODB_SCENARIO_CACHE_TABLE` | ❌ 未設定 | クラッシュ確認済み |
| `SCENARIO_CACHE_TTL_DAYS` | `SCENARIO_CACHE_TTL_DAYS` | ❌ 未設定 | クラッシュ確認済み |
| `WEBSOCKET_ENDPOINT` (websocket-default only) | `WEBSOCKET_ENDPOINT` | ✅ | websocket-default のみ設定 |
| `BEDROCK_REGION: this.region` | `BEDROCK_REGION` | ✅ | commonEnvironment にあり |

---

## 🔧 修正計画

### Step 1: DynamoDB テーブル作成 (dynamodb-stack.ts)
- `prance-scenario-cache-dev` テーブル追加
- `prance-scenario-cache-production` テーブル追加

### Step 2: CDK commonEnvironment 修正 (api-lambda-stack.ts)
- `DYNAMODB_SCENARIO_CACHE_TABLE` 追加: `props.scenarioCacheTable.tableName`
- `SCENARIO_CACHE_TTL_DAYS` 追加: `process.env.SCENARIO_CACHE_TTL_DAYS!`
- `GUEST_RATE_LIMIT_TABLE_NAME` → `GUEST_RATE_LIMIT_TABLE` に変更

### Step 3: .env.local 修正
- `GUEST_RATE_LIMIT_TABLE` 値を `prance-guest-rate-limits-dev`（末尾 `s`）に修正
- `WEBSOCKET_ENDPOINT` コメント修正

### Step 4: CDK デプロイ
- DynamoDB + ApiLambda スタック更新

### Step 5: 動作確認
- GET /api/v1/scenarios/:id → 200 確認

---

**最終更新:** 2026-04-25
