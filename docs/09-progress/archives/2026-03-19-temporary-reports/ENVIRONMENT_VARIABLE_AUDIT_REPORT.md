# Environment Variable Audit Report

**作成日:** 2026-03-19
**監査範囲:** Development/Production環境
**監査者:** Claude Sonnet 4.5

---

## 📊 Executive Summary

**総合評価:** ⚠️ **WARNING - 改善必要**

| カテゴリ | 状態 | 詳細 |
|---------|------|------|
| **重複変数** | ⚠️ 3組の重複を検出 | 統一推奨 |
| **不使用変数** | ⚠️ 9変数が未使用 | 削除またはコメントアウト推奨 |
| **本番環境設定** | ❌ 重大な欠如あり | CloudFront秘密鍵等が未設定 |

---

## 1. 重複変数の分析

### 🔴 検出された重複（3組）

#### 1.1 WebSocket エンドポイント

```bash
NEXT_PUBLIC_WS_URL=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_WS_ENDPOINT=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
```

**使用頻度:**
- `NEXT_PUBLIC_WS_URL`: 0回（実質未使用）
- `NEXT_PUBLIC_WS_ENDPOINT`: 2回使用

**推奨アクション:**
- ✅ `NEXT_PUBLIC_WS_ENDPOINT` を標準として採用
- ❌ `NEXT_PUBLIC_WS_URL` を削除（後方互換性で残すならコメント追加）

**使用箇所:**
- `apps/web/hooks/useWebSocket.ts:151`
- 他のフロントエンドコンポーネント

---

#### 1.2 S3 バケット名

```bash
S3_BUCKET=prance-recordings-dev-010438500933
STORAGE_BUCKET_NAME=prance-recordings-dev-010438500933
```

**使用頻度:**
- `S3_BUCKET`: 2回使用
- `STORAGE_BUCKET_NAME`: 1回使用

**推奨アクション:**
- ✅ `S3_BUCKET` を標準として採用（短い名前）
- ⚠️ `STORAGE_BUCKET_NAME` は本番Lambda関数で使用中のため慎重に削除
- 📝 段階的移行計画を作成

**使用箇所（S3_BUCKET）:**
- WebSocket Lambda関数
- Recording機能

**使用箇所（STORAGE_BUCKET_NAME）:**
- API Lambda関数（scenarios, sessions等）

---

#### 1.3 API Base URL

```bash
NEXT_PUBLIC_API_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
NEXT_PUBLIC_API_BASE_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
```

**使用頻度:**
- `NEXT_PUBLIC_API_URL`: 3回使用
- `NEXT_PUBLIC_API_BASE_URL`: 1回使用

**推奨アクション:**
- ✅ `NEXT_PUBLIC_API_URL` を標準として採用（既存コードの多くが使用）
- ❌ `NEXT_PUBLIC_API_BASE_URL` を削除

**使用箇所（NEXT_PUBLIC_API_URL）:**
- API client初期化
- Fetch requests

---

## 2. 不使用変数の分析

### ⚠️ コードで使用されていない変数（9個）

| 変数名 | 理由 | 推奨アクション |
|--------|------|--------------|
| `AWS_ACCOUNT_ID` | CDK内部で使用、コードでは不要 | 保持（インフラ用） |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | 将来機能 | コメントアウトまたは実装 |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | 将来機能 | コメントアウトまたは実装 |
| `NEXT_PUBLIC_WS_URL` | 重複（上記参照） | 削除推奨 |
| `POLLY_ENGINE` | フォールバックTTS未実装 | コメントアウト |
| `POLLY_REGION` | フォールバックTTS未実装 | コメントアウト |
| `POLLY_VOICE_ID` | フォールバックTTS未実装 | コメントアウト |
| `READY_PLAYER_ME_APP_ID` | アバター生成未実装 | コメントアウト |
| `REKOGNITION_REGION` | 感情解析未実装 | コメントアウト |

**総評:**
- 将来機能用の変数が多い
- 削除せずコメントアウト推奨（将来実装時に再有効化）

---

## 3. 本番環境 Secret Manager 設定状況

### ✅ 正しく設定されているSecret

#### 3.1 `prance/aurora/production`
```json
{
  "dbClusterIdentifier": "...",
  "dbname": "...",
  "engine": "postgres",
  "host": "...",
  "password": "...",
  "port": "5432",
  "username": "..."
}
```
**対応環境変数:** `DATABASE_URL`

---

#### 3.2 `prance/elevenlabs/production`
```json
{
  "apiKey": "...",
  "modelId": "eleven_flash_v2_5",
  "voiceId": "..."
}
```
**対応環境変数:**
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_MODEL_ID`
- `ELEVENLABS_VOICE_ID`

---

#### 3.3 `prance/azure-speech/production`
```json
{
  "region": "eastus",
  "subscriptionKey": "..."
}
```
**対応環境変数:**
- `AZURE_SPEECH_REGION`
- `AZURE_SPEECH_KEY`

---

#### 3.4 `prance/jwt/production`
```json
{
  "secret": "...",
  "accessTokenExpiresIn": "24h",
  "refreshTokenExpiresIn": "30d"
}
```
**対応環境変数:** `JWT_SECRET`

---

### ❌ Secret Managerに設定されていない重要な変数

#### 🔴 CRITICAL: CloudFront署名用秘密鍵

**欠如している変数:**
```bash
CLOUDFRONT_KEY_PAIR_ID=K2XXXXXXXXXXXX
CLOUDFRONT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
CLOUDFRONT_DOMAIN=cdn.app.prance.jp
```

**現状:**
- ✅ WebSocket Lambda関数には環境変数として直接設定済み
- ❌ Secret Managerには未登録
- ⚠️ 秘密鍵がLambda環境変数に平文保存（セキュリティリスク）

**推奨アクション（優先度: HIGH）:**
```bash
# 1. Secret作成
aws secretsmanager create-secret \
  --name prance/cloudfront/production \
  --description "CloudFront private key for signed URLs" \
  --secret-string '{
    "keyPairId": "K2XXXXXXXXXXXX",
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----...",
    "domain": "cdn.app.prance.jp"
  }' \
  --region us-east-1

# 2. CDKコードでSecret参照に変更
# 3. Lambda関数から環境変数を削除
```

---

#### ⚠️ MEDIUM: その他の機密情報

**欠如しているがリスク中程度:**

1. **BEDROCK_MODEL_ID**
   - 現状: Lambda環境変数に直接設定
   - 推奨: Secret Managerまたはパラメータストア
   - 理由: 機密ではないが、統一管理推奨

2. **RATE_LIMIT_***
   - 現状: 一部のLambda関数に設定されていない
   - 推奨: Systems Manager Parameter Storeで統一管理
   - 理由: 設定値であり秘密ではない

3. **STT_AUTO_DETECT_LANGUAGES**
   - 現状: WebSocket Lambda関数に設定されていない
   - 推奨: Parameter Store
   - 理由: 設定値

---

## 4. Lambda関数別 環境変数設定状況

### 4.1 prance-websocket-default-production (27変数)

**✅ 正しく設定:**
- AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
- ELEVENLABS_API_KEY, ELEVENLABS_MODEL_ID, ELEVENLABS_VOICE_ID
- DATABASE_URL
- JWT_SECRET
- CLOUDFRONT_DOMAIN, CLOUDFRONT_KEY_PAIR_ID, CLOUDFRONT_PRIVATE_KEY
- BEDROCK_MODEL_ID, BEDROCK_REGION
- S3_BUCKET
- CONNECTIONS_TABLE_NAME
- WEBSOCKET_ENDPOINT
- FFMPEG_PATH, FFPROBE_PATH
- STT_LANGUAGE, AUDIO_CONTENT_TYPE, VIDEO_CONTENT_TYPE, VIDEO_FORMAT, VIDEO_RESOLUTION
- ENABLE_AUTO_ANALYSIS
- ENVIRONMENT, NODE_ENV, LOG_LEVEL

**❌ 欠如:**
- STT_AUTO_DETECT_LANGUAGES（コードで使用されているが未設定）

---

### 4.2 prance-scenarios-list-production (9変数)

**✅ 正しく設定:**
- DATABASE_URL
- JWT_SECRET
- BEDROCK_REGION
- STORAGE_BUCKET_NAME
- GUEST_RATE_LIMIT_TABLE_NAME
- FRONTEND_URL
- ENVIRONMENT, NODE_ENV, LOG_LEVEL

**⚠️ 懸念:**
- `STORAGE_BUCKET_NAME` 使用（`S3_BUCKET` との重複）

---

### 4.3 prance-sessions-analysis-production (11変数)

**✅ 正しく設定:**
- DATABASE_URL
- JWT_SECRET
- BEDROCK_REGION
- STORAGE_BUCKET_NAME, RECORDINGS_BUCKET_NAME
- GUEST_RATE_LIMIT_TABLE_NAME
- FRONTEND_URL
- ENABLE_AUTO_ANALYSIS
- ENVIRONMENT, NODE_ENV, LOG_LEVEL

**⚠️ 懸念:**
- `RECORDINGS_BUCKET_NAME` と `STORAGE_BUCKET_NAME` の使い分けが不明確

---

### 4.4 prance-nextjs-production (4変数)

**✅ 正しく設定:**
- NEXT_PUBLIC_API_URL
- NEXT_PUBLIC_WS_URL
- NEXT_PUBLIC_CLOUDFRONT_DOMAIN
- NODE_ENV

**⚠️ 懸念:**
- `NEXT_PUBLIC_WS_URL` 使用（推奨は `NEXT_PUBLIC_WS_ENDPOINT`）

---

## 5. 推奨アクションプラン

### 🔴 Phase 1: Critical (即座に対応)

**1.1 CloudFront秘密鍵をSecret Managerへ移行**
```bash
# タスク: CLOUDFRONT_PRIVATE_KEY をSecret Managerに登録
# 期限: 即座
# 担当: DevOps
# リスク: 秘密鍵の平文保存（セキュリティ違反）
```

**1.2 STT_AUTO_DETECT_LANGUAGES を本番WebSocket Lambdaに追加**
```bash
# タスク: CDK設定に追加してデプロイ
# 期限: 1日以内
# リスク: 機能不全（自動言語検出が動作しない）
```

---

### ⚠️ Phase 2: Medium (1週間以内)

**2.1 重複変数の統一**
```bash
# タスク: 以下を統一
# - NEXT_PUBLIC_WS_ENDPOINT に統一（_WS_URL 削除）
# - S3_BUCKET に統一（STORAGE_BUCKET_NAME 削除）
# - NEXT_PUBLIC_API_URL に統一（_API_BASE_URL 削除）

# 手順:
# 1. コードベース全体で統一変数名に書き換え
# 2. 本番Lambdaを再デプロイ
# 3. 動作確認後、旧変数削除
```

**2.2 不使用変数の整理**
```bash
# タスク: .env.example で将来機能変数をコメントアウト
# - POLLY_*
# - READY_PLAYER_ME_APP_ID
# - REKOGNITION_REGION
# - JWT_*_EXPIRES_IN（実装されるまで）
```

---

### 💡 Phase 3: Low (1ヶ月以内)

**3.1 設定値のParameter Store移行**
```bash
# タスク: 機密でない設定値をParameter Storeへ
# - RATE_LIMIT_*
# - STT_LANGUAGE
# - VIDEO_*, AUDIO_*
# - BEDROCK_MODEL_ID
```

**3.2 環境変数管理の自動化**
```bash
# タスク: 環境変数同期チェックをCI/CDに統合
# - GitHub Actions で validate-env-consistency-comprehensive.sh 実行
# - 本番デプロイ前に必須チェック
```

---

## 6. 統計情報

### コードで使用中の環境変数 (41個)

```
使用頻度トップ10:
12回: AWS_REGION
 8回: NODE_ENV
 6回: ENVIRONMENT
 4回: CI
 3回: NEXT_PUBLIC_API_URL
 3回: FRONTEND_URL
 3回: FFPROBE_PATH
 3回: FFMPEG_PATH
 3回: CONNECTIONS_TABLE_NAME
 3回: BEDROCK_REGION
```

### .env.example で定義 (49個)

- 使用中: 41個
- 未使用: 9個（将来機能含む）
- 重複: 6個（3組）

### Secret Manager (4個)

- Aurora Database
- ElevenLabs
- Azure Speech
- JWT Secret

**欠如:** CloudFront (最優先で対応必要)

---

## 7. セキュリティリスク評価

| リスク | 重大度 | 現状 | 推奨対策 |
|--------|--------|------|----------|
| CloudFront秘密鍵の平文保存 | 🔴 CRITICAL | Lambda環境変数に平文 | Secret Manager移行 |
| API Key露出 | 🟢 LOW | Secret Manager使用 | 問題なし |
| Database認証情報 | 🟢 LOW | Secret Manager使用 | 問題なし |
| 重複変数による設定ミス | 🟡 MEDIUM | 3組の重複あり | 統一化 |

---

## 8. 次のステップ

### 即座に実行（今日中）

```bash
# 1. CloudFront Secret作成（優先度: CRITICAL）
bash scripts/create-cloudfront-secret.sh production

# 2. WebSocket Lambda に STT_AUTO_DETECT_LANGUAGES 追加
# infrastructure/lib/stacks/lambda-stack.ts 編集
# pnpm run deploy:websocket -- --env production
```

### 1週間以内

```bash
# 3. 重複変数の統一計画策定
# 4. .env.example 整理（コメントアウト）
# 5. ドキュメント更新
```

### 1ヶ月以内

```bash
# 6. Parameter Store 移行
# 7. CI/CD 自動チェック統合
```

---

**最終更新:** 2026-03-19
**次回監査予定:** 2026-04-19
**担当者:** DevOps Team
