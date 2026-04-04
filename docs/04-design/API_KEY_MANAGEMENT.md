# APIキー管理ガイド

**作成日:** 2026-03-06
**重要度:** 🔴 最重要

---

## 🚨 重要原則

### 単一の真実の情報源（Single Source of Truth）

**全てのAPIキーは `/workspaces/prance-communication-platform/.env.local` で一元管理**

```bash
# プロジェクトルート
/workspaces/prance-communication-platform/
  ├── .env.local          ← 唯一のAPIキー保存場所（SSOT）
  ├── .env.example        ← テンプレート（APIキーなし）
  └── infrastructure/
      └── .env            ← .env.localからコピー（デプロイ用）
```

---

## 📋 ルール

### 1. APIキーの保存場所

**✅ 正しい:**

```bash
# プロジェクトルートの.env.localに保存
/workspaces/prance-communication-platform/.env.local
```

**❌ 間違い:**

```bash
# 複数の場所に分散して保存（禁止）
infrastructure/.env
apps/web/.env.local
packages/*/. env
```

### 2. デプロイ時の手順

**自動化されています！** `.env.local`から`infrastructure/.env`へのコピーは自動実行されます。

#### オプションA: deploy.sh を使用（推奨）

```bash
cd /workspaces/prance-communication-platform/infrastructure

# 開発環境にデプロイ（自動的に.env.localをコピー）
./deploy.sh dev

# または
pnpm run deploy:dev
```

#### オプションB: npm scripts を使用

```bash
cd /workspaces/prance-communication-platform/infrastructure

# predeploy フックが自動的に sync-env.js を実行
pnpm run deploy
```

#### オプションC: CDK直接実行

```bash
cd /workspaces/prance-communication-platform/infrastructure

# 手動で同期スクリプトを実行
node scripts/sync-env.js

# その後CDK実行
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

**自動化の仕組み:**

1. `deploy.sh` → 冒頭で自動的に`.env.local`をコピー
2. `pnpm run deploy` → `predeploy`フックで`sync-env.js`を実行
3. `scripts/sync-env.js` → コピー + APIキー検証

### 3. 新しいAPIキーの追加

**手順:**

```bash
# 1. プロジェクトルートの.env.localに追加
echo "NEW_API_KEY=your-key-value" >> .env.local

# 2. .env.exampleにもテンプレート追加（値なし）
echo "NEW_API_KEY=xxxxx" >> .env.example

# 3. （オプション）sync-env.js に検証を追加
# infrastructure/scripts/sync-env.js の requiredKeys 配列に追加
{ key: 'NEW_API_KEY', name: 'New Service' },

# 4. CDKコードで環境変数として設定
# infrastructure/lib/api-lambda-stack.ts
environment: {
  NEW_API_KEY: process.env.NEW_API_KEY || '',
}

# 5. デプロイ（自動的に.env.localがコピーされます）
cd infrastructure
./deploy.sh dev

# または
pnpm run deploy
```

**重要:** `infrastructure/.env`への手動コピーは不要です。デプロイスクリプトが自動的に処理します。

---

## 🔐 管理されるAPIキー一覧

### Azure Speech Services（STT）

```bash
AZURE_SPEECH_KEY=your-azure-speech-key
AZURE_SPEECH_REGION=eastus
```

### ElevenLabs（TTS）

```bash
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=your-voice-id
```

### AWS Bedrock（AI）

```bash
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
# Note: BedrockはIAM認証を使用するため、APIキー不要
```

### データベース

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/prance_dev"
```

### JWT認証

```bash
JWT_SECRET=dev-secret-change-in-production-use-long-random-string
JWT_ACCESS_TOKEN_EXPIRES_IN=24h
JWT_REFRESH_TOKEN_EXPIRES_IN=30d
```

### Ready Player Me（将来）

```bash
READY_PLAYER_ME_APP_ID=your-app-id
```

---

## 🛡️ セキュリティ対策

### 1. Git管理

**`.gitignore`で保護:**

```gitignore
# Environment variables (IMPORTANT: Never commit API keys)
.env
.env.local
.env*.local
infrastructure/.env
```

**確認:**

```bash
# .env.localがgit管理外であることを確認
git status | grep ".env.local"
# → 何も表示されなければOK
```

### 2. ファイルパーミッション

```bash
# .env.localのパーミッションを制限
chmod 600 .env.local
```

### 3. 本番環境

**本番環境ではAWS Secrets Managerを使用:**

```bash
# 開発環境: .env.local
# 本番環境: AWS Secrets Manager

# CDKコードでの切り替え
const apiKey = process.env.NODE_ENV === 'production'
  ? secretsmanager.Secret.fromSecretArn(...)
  : process.env.API_KEY;
```

---

## 📝 チェックリスト

### 新規開発者のセットアップ

- [ ] プロジェクトをクローン
- [ ] `.env.example`を`.env.local`にコピー
- [ ] 必要なAPIキーを取得して`.env.local`に設定
- [ ] `infrastructure/.env`を作成（`.env.local`からコピー）
- [ ] 開発サーバー起動確認
- [ ] CDKデプロイ確認（必要な場合）

### APIキー追加時

- [ ] `.env.local`にキーを追加
- [ ] `.env.example`にテンプレート追加
- [ ] `infrastructure/.env`に同期
- [ ] CDKコードで環境変数設定
- [ ] デプロイ実行
- [ ] Lambda関数で環境変数確認

### デプロイ前

- [ ] `.env.local`が最新
- [ ] `infrastructure/.env`が`.env.local`と同期
- [ ] `.gitignore`で保護確認
- [ ] コミット前に`git status`で`.env`ファイルがないことを確認

---

## 🚫 絶対にやってはいけないこと

### 1. ❌ APIキーのハードコード

```typescript
// ❌ 絶対禁止
const apiKey = 'sk_4f0eeb6873a7e7036470204c686c9abe283aa7e94cad5769';

// ✅ 正しい
const apiKey = process.env.ELEVENLABS_API_KEY;
```

### 2. ❌ APIキーのコミット

```bash
# ❌ 絶対禁止
git add .env.local
git commit -m "Add API keys"

# ✅ 正しい（.gitignoreで自動的にブロックされる）
git status  # .env.localが表示されないことを確認
```

### 3. ❌ 複数の場所での管理

```bash
# ❌ 間違い - 複数ファイルで個別管理
infrastructure/.env          # APIキーA
apps/web/.env.local          # APIキーB
packages/shared/.env         # APIキーC

# ✅ 正しい - 一箇所で一元管理
.env.local                   # 全てのAPIキー
```

### 4. ❌ SlackやメールでのAPIキー送信

```bash
# ❌ 絶対禁止
"ElevenLabs APIキー: sk_4f0e..."

# ✅ 正しい
"ElevenLabs APIキーを取得してください: https://elevenlabs.io/"
".env.localに ELEVENLABS_API_KEY として設定してください"
```

---

## 🔄 ファイル同期スクリプト（将来）

```bash
#!/bin/bash
# scripts/sync-env.sh
# .env.localからinfrastructure/.envに同期

set -e

echo "Syncing .env.local to infrastructure/.env..."

if [ ! -f .env.local ]; then
  echo "Error: .env.local not found"
  exit 1
fi

cp .env.local infrastructure/.env
echo "✅ Synced successfully"
```

---

## 📞 サポート

### APIキーが漏洩した場合

1. **即座にキーを無効化**
   - Azure Portal / ElevenLabs Dashboard でキーを削除
2. **新しいキーを生成**
3. **`.env.local`を更新**
4. **再デプロイ**
5. **チームに通知**

### 困ったときは

- **ドキュメント確認**: このファイル
- **環境変数確認**: `echo $AZURE_SPEECH_KEY`
- **Lambda確認**: `aws lambda get-function-configuration --function-name <name>`
- **ログ確認**: `aws logs tail /aws/lambda/<name> --follow`

---

**最終更新:** 2026-03-06
**次回レビュー:** 本番リリース前

---

## 参考リンク

- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [12 Factor App - Config](https://12factor.net/config)
- [OWASP - Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
