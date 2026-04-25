# デプロイ設定監査レポート

**作成日:** 2026-04-25  
**対象:** 開発環境 (dev.app.prance.jp) / 本番環境 (app.prance.jp)

---

## 概要

本ドキュメントはデプロイ設定の包括的監査結果をまとめたものです。
以下の問題を発見・修正しました。

---

## 発見された問題と修正

### 問題 1: `reports.ts` — `/api/v1` の二重付与 🔴 修正済み

| 項目 | 内容 |
|------|------|
| ファイル | `apps/web/lib/api/reports.ts:34` |
| 問題 | `NEXT_PUBLIC_API_URL` は `/api/v1` を含むのに、パスにも `/api/v1` を付与 |
| 影響 | `https://api.dev.app.prance.jp/api/v1/api/v1/sessions/{id}/report` → 404 |
| 修正前 | `` `${API_BASE_URL}/api/v1/sessions/${sessionId}/report` `` |
| 修正後 | `` `${API_BASE_URL}/sessions/${sessionId}/report` `` |

### 問題 2: `proxy/sessions/route.ts` — 旧 API Gateway URL ハードコード 🔴 修正済み

| 項目 | 内容 |
|------|------|
| ファイル | `apps/web/app/api/proxy/sessions/route.ts:12` |
| 問題 | `NEXT_PUBLIC_API_URL` 未設定時に旧 API Gateway URL にフォールバック。さらに `/api/v1` 含む URL に `/sessions` を付与しても正しいが、フォールバック先が prod に存在しない開発専用 URL |
| 影響 | `NEXT_PUBLIC_API_URL` 未設定時に古い dev 専用エンドポイントにリクエスト → 本番で失敗 |
| 修正前 | `process.env.NEXT_PUBLIC_API_URL \|\| 'https://ffypxkomg1.execute-api...'` |
| 修正後 | `process.env.NEXT_PUBLIC_API_URL ?? ''` |

### 問題 3: `.env.local` — `NEXT_PUBLIC_BYPASS_SPEECH_DETECTION` 二重定義 🔴 修正済み

| 項目 | 内容 |
|------|------|
| ファイル | `.env.local:76` と `.env.local:198` |
| 問題 | 同一変数を 2 箇所で定義。最後の値 (`true`) が有効になり、**デプロイ済みバンドルで音声検出が常時バイパスされる** |
| 影響 | 本番/dev 両環境でセッション中の音声が検出されず、STT が機能しない |
| 修正内容 | 76 行目の `=false` を削除。`deploy.sh` で `NEXT_PUBLIC_BYPASS_SPEECH_DETECTION=false` を明示的にエクスポート |

### 問題 4: `nextjs-lambda-stack.ts` — Lambda 環境変数キー名誤り 🔴 修正済み

| 項目 | 内容 |
|------|------|
| ファイル | `infrastructure/lib/nextjs-lambda-stack.ts:58` |
| 問題 | Lambda 環境変数キーが `NEXT_PUBLIC_WS_URL`（フロントエンドでは `NEXT_PUBLIC_WS_ENDPOINT` を読む） |
| 影響 | Lambda 環境変数の参考値が間違った名前で設定され、参照時に混乱 |
| 問題 2 | `/api/v1` サフィックスなしで `NEXT_PUBLIC_API_URL` が設定されていた |
| 修正内容 | `NEXT_PUBLIC_WS_URL` → `NEXT_PUBLIC_WS_ENDPOINT`、`/api/v1` サフィックス追加 |
| CDK デプロイ | 2026-04-25 11:20 UTC 完了 |

### 問題 5: `client.ts` — 誤ったフォールバック URL 🔴 修正済み

| 項目 | 内容 |
|------|------|
| ファイル | `apps/web/lib/api/client.ts:11` |
| 問題 | `NEXT_PUBLIC_API_URL` 未設定時に `http://localhost:3001/api/v1` にフォールバック（ポート 3001 は使用していない） |
| 修正前 | `process.env.NEXT_PUBLIC_API_URL \|\| 'http://localhost:3001/api/v1'` |
| 修正後 | `process.env.NEXT_PUBLIC_API_URL ?? ''` |

---

## 修正後のアーキテクチャ

### `NEXT_PUBLIC_*` 環境変数の管理規則

```
.env.local                         ← ローカル開発用デフォルト値（参照のみ）
    ↓ (deploy.sh がコピー → infrastructure/.env)
deploy.sh (ビルド前に export)      ← 環境ごとの正規値（これが bundle に焼き込まれる）
    NEXT_PUBLIC_API_URL
    NEXT_PUBLIC_WS_ENDPOINT
    NEXT_PUBLIC_BYPASS_SPEECH_DETECTION=false  ← 必ず false に上書き
    ↓ (next build)
Lambda bundle                      ← 焼き込まれた値（不変）

nextjs-lambda-stack.ts Lambda env  ← 参考値のみ（bundle を上書きしない）
```

### 環境ごとの正規 URL

| 変数 | dev | production |
|------|-----|------------|
| `NEXT_PUBLIC_API_URL` | `https://api.dev.app.prance.jp/api/v1` | `https://api.app.prance.jp/api/v1` |
| `NEXT_PUBLIC_WS_ENDPOINT` | `wss://ws.dev.app.prance.jp` | `wss://ws.app.prance.jp` |
| `NEXT_PUBLIC_BYPASS_SPEECH_DETECTION` | `false` | `false` |
| `WEBSOCKET_ENDPOINT` (Lambda 内部用) | CDK が設定: `https://{rawId}.execute-api.us-east-1.amazonaws.com/dev` | CDK が設定: 同形式 |

### `WEBSOCKET_ENDPOINT` と `NEXT_PUBLIC_WS_ENDPOINT` の区別

| 変数 | 用途 | 形式 | 設定箇所 |
|------|------|------|---------|
| `NEXT_PUBLIC_WS_ENDPOINT` | フロントエンドが WS 接続に使う | `wss://ws.{domain}` | `deploy.sh` → bundle |
| `WEBSOCKET_ENDPOINT` | Lambda が `ApiGatewayManagementApiClient` に使う | `https://{rawId}.execute-api.{region}.amazonaws.com/{stage}` | CDK → Lambda env |

**重要:** これら 2 つは異なるもの。`WEBSOCKET_ENDPOINT` は `wss://` ではなく `https://` で始まる必要がある。

---

## 変数名の整合性マップ

| `.env.local` 変数名 | フロントエンドコードでの参照 | Lambda コードでの参照 | CDK で設定 |
|--------------------|-----------------------|--------------------|-----------|
| `NEXT_PUBLIC_API_URL` | `process.env.NEXT_PUBLIC_API_URL` | N/A | `nextjs-lambda-stack.ts` (参考) |
| `NEXT_PUBLIC_WS_ENDPOINT` | `process.env.NEXT_PUBLIC_WS_ENDPOINT` | N/A | `nextjs-lambda-stack.ts` (参考) |
| `NEXT_PUBLIC_BYPASS_SPEECH_DETECTION` | `process.env.NEXT_PUBLIC_BYPASS_SPEECH_DETECTION` | N/A | N/A |
| `NEXT_PUBLIC_WS_ACK_TIMEOUT_MS` | `process.env.NEXT_PUBLIC_WS_ACK_TIMEOUT_MS` | N/A | N/A |
| `NEXT_PUBLIC_WS_MAX_RETRIES` | `process.env.NEXT_PUBLIC_WS_MAX_RETRIES` | N/A | N/A |
| `NEXT_PUBLIC_WS_AUTH_TIMEOUT_MS` | `process.env.NEXT_PUBLIC_WS_AUTH_TIMEOUT_MS` | N/A | N/A |
| `WEBSOCKET_ENDPOINT` | N/A | `getRequiredEnv('WEBSOCKET_ENDPOINT')` | `api-lambda-stack.ts` |

---

## デプロイフロー（正規手順）

### Dev 環境

```bash
cd infrastructure
bash deploy.sh dev
# 実行内容:
# 1. .env.local → infrastructure/.env をコピー
# 2. NEXT_PUBLIC_API_URL=https://api.dev.app.prance.jp/api/v1 を export
# 3. NEXT_PUBLIC_WS_ENDPOINT=wss://ws.dev.app.prance.jp を export
# 4. NEXT_PUBLIC_BYPASS_SPEECH_DETECTION=false を export  ← 重要: .env.local の true を上書き
# 5. Next.js standalone build
# 6. Lambda パッケージ作成
# 7. CDK deploy
```

### Production 環境

```bash
cd infrastructure
bash deploy.sh production
# NEXT_PUBLIC_API_URL=https://api.app.prance.jp/api/v1
# NEXT_PUBLIC_WS_ENDPOINT=wss://ws.app.prance.jp
# NEXT_PUBLIC_BYPASS_SPEECH_DETECTION=false
```

---

## 禁止事項

```bash
# ❌ .env.local をそのままビルドに使わない（BYPASS_SPEECH_DETECTION=true が混入する）
next build  # deploy.sh 経由でない直接ビルド

# ❌ NEXT_PUBLIC_* を Lambda 環境変数で上書きしようとしない（bundle に焼き込まれているため無効）
aws lambda update-function-configuration --environment "NEXT_PUBLIC_API_URL=..."

# ❌ API パスに /api/v1 を付与しない（NEXT_PUBLIC_API_URL に含まれている）
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sessions`)  # 二重になる
```

---

**最終更新:** 2026-04-25
