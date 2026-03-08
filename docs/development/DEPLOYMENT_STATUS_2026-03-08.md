# デプロイ環境整備 - 進捗レポート

**日時:** 2026-03-08 10:15 JST
**セッション時間:** 約1時間

---

## ✅ 解決した問題

### 1. Next.js開発サーバー復旧

**問題:** 500エラー、`next`バイナリ欠落
**解決策:** プロジェクトルートで`npm install`実行
**結果:** ✅ 200 OK - 正常動作中

### 2. CDK実行問題

**問題:**

- `cdk --version` → Exit 221エラー
- Resource deadlock avoided
- node_modules破損

**解決策:**

1. 破損したnode_modulesを退避
2. プロジェクトルートから`npx cdk`で実行
3. 正しいパス: `/workspaces/prance-communication-platform/node_modules/.bin/cdk`

**結果:** ✅ CDK 2.1109.0 正常動作

### 3. Prismaクライアント未生成

**問題:** `cp: cannot stat packages/database/node_modules/.prisma/client`
**解決策:** `cd packages/database && npx prisma generate`
**結果:** ✅ Prisma Client v5.22.0 生成完了

---

## 🔄 進行中の問題

### Lambda関数デプロイ（長時間プロセス）

**現状:**

- CDKデプロイは技術的に可能
- 20+ Lambda関数のDockerバンドリングに20-30分必要
- タイムアウト制限で完全な出力を取得困難

**進捗:**

- Authorizer Function: バンドル完了
- HealthCheck Function: バンドル完了
- Register Function: バンドル完了
- その他: 進行中

---

## 🔴 未解決の根本問題

### ffmpeg欠落（Critical）

**問題:**

```
ERROR: /var/task/ffmpeg: No such file or directory
- AUDIO_PROCESSING_ERROR
- VIDEO_PROCESSING_ERROR
```

**原因分析:**

1. `infrastructure/lambda/websocket/default/package.json`に`ffmpeg-static@^5.3.0`記載あり
2. しかし実際にデプロイされたLambda関数には含まれていない
3. 最終更新: 2026-03-08T09:19:17（現在の問題あるバージョン）

**影響:**

- 音声処理: 100%失敗（WebM→WAV変換不可）
- 録画処理: 100%失敗（チャンク結合不可）

---

## 📋 次のアクションプラン

### Option A: CDKデプロイ完了を待つ（推奨）

**所要時間:** 20-30分
**利点:** 全Lambda関数を一括更新、確実
**欠点:** 時間がかかる

**実行コマンド:**

```bash
cd /workspaces/prance-communication-platform/infrastructure
npx cdk deploy Prance-dev-ApiLambda --require-approval never
# バックグラウンドで実行し、完了を待機
```

### Option B: WebSocket Lambda関数のみ直接更新（高速）

**所要時間:** 5-10分
**利点:** 高速、ffmpeg問題を即座に解決
**欠点:** 1つの関数のみ更新

**実行手順:**

```bash
# 1. WebSocket Lambda関数のコードをzip
cd /workspaces/prance-communication-platform
zip -r lambda-websocket.zip infrastructure/lambda/websocket/default/ \
  -x "*/node_modules/*" -x "*/.DS_Store"

# 2. AWS CLIで直接更新
aws lambda update-function-code \
  --function-name prance-websocket-default-dev \
  --zip-file fileb://lambda-websocket.zip

# 3. 環境変数更新（ffmpegパス設定）
aws lambda update-function-configuration \
  --function-name prance-websocket-default-dev \
  --environment Variables="{...既存の環境変数...,FFMPEG_PATH=/opt/bin/ffmpeg}"
```

### Option C: Lambda Layerでffmpeg追加（最適解）

**所要時間:** 15-20分
**利点:** 全Lambda関数で再利用可能、パッケージサイズ削減
**欠点:** 初回設定が必要

**実行手順:**

```bash
# 1. ffmpeg-staticバイナリを取得
mkdir -p /tmp/lambda-layer/nodejs/node_modules
cd /tmp/lambda-layer/nodejs/node_modules
npm install ffmpeg-static@5.3.0

# 2. Layerをzip
cd /tmp/lambda-layer
zip -r ffmpeg-layer.zip .

# 3. Lambda Layerを作成
aws lambda publish-layer-version \
  --layer-name ffmpeg-layer \
  --description "ffmpeg-static 5.3.0 for ARM64" \
  --zip-file fileb://ffmpeg-layer.zip \
  --compatible-runtimes nodejs22.x \
  --compatible-architectures arm64

# 4. Lambda関数にLayerをアタッチ（CDKで設定）
```

---

## 🔍 診断情報

### 現在のLambda関数状態

```
Function: prance-websocket-default-dev
Runtime: nodejs22.x
Last Modified: 2026-03-08T09:19:17.000+0000
Code Size: 29821369 bytes (28.4 MB)
Handler: index.handler
```

### CDKバージョン

```
CDK: 2.1109.0 (build 3a415c7)
Node.js: v24.14.0
npm: 11.9.0
```

### 環境変数同期

✅ `.env.local` → `infrastructure/.env` 同期済み
✅ APIキー検証済み（Azure, ElevenLabs）

---

## 💡 推奨アクション

**immediate（今すぐ）:**

1. Option Aを選択: CDKデプロイを完了させる
2. バックグラウンドで実行し、他の作業を並行

**short-term（完了後）:**

1. ffmpegが正しくバンドルされているか確認
2. 音声・録画機能の統合テスト
3. Lambda関数バージョン確認

**medium-term（今後）:**

1. Option Cを実装: Lambda Layerでffmpeg管理
2. デプロイ時間短縮
3. .gitignoreにLambda node_modules追加

---

**次のコマンド（CDKデプロイ完了まで待機）:**

```bash
# 別ターミナルで実行
cd /workspaces/prance-communication-platform/infrastructure
npx cdk deploy Prance-dev-ApiLambda --require-approval never

# 進捗確認
watch -n 30 "aws cloudformation describe-stack-events \
  --stack-name Prance-dev-ApiLambda --max-items 5 \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,LogicalResourceId]' \
  --output table"
```
