# Deployment Enforcement System

**最終更新:** 2026-03-14
**目的:** デプロイ時のミスを防ぎ、検証スクリプトを確実に実行する仕組み

---

## 🔴 重要原則

**直接CDKコマンドを使用してはいけない理由:**

1. **WebSocket Lambda関数のbundling問題**
   - CDKの通常デプロイでは古いコードがデプロイされる可能性
   - 2026-03-14の障害: JWT_SECRET不一致で全WebSocket接続失敗

2. **検証スクリプトがスキップされる**
   - 環境変数検証
   - Lambda依存関係検証
   - I18nシステム検証
   - デプロイ後テスト

3. **過去の失敗事例**
   - Day 11: Prisma Client欠如 → 500エラー
   - Day 12: Azure Speech SDK欠如 → STTエラー
   - Day 14: CLOUDFRONT_DOMAIN欠如 → 音声再生エラー
   - Day 15: JWT_SECRET不一致 → WebSocket接続エラー

---

## 5層防御システム

### Layer 1: CDKデプロイラッパー（最重要）

**スクリプト:** `scripts/cdk-deploy-wrapper.sh`

**機能:**
- WebSocket Lambda検出 → 手動デプロイスクリプトへ誘導
- デプロイ前検証の強制実行
- デプロイ後テストの自動実行

**使用方法:**
```bash
# WebSocket Lambda関数（推奨）
pnpm run deploy:websocket

# 他のスタック
pnpm run deploy:stack Prance-dev-ApiLambda

# または直接実行
./scripts/cdk-deploy-wrapper.sh Prance-dev-Database
```

---

### Layer 2: Git Hooks

**Pre-Commit Hook:** `.git/hooks/pre-commit`

**検証項目:**
1. I18nシステム検証（next-intl使用禁止）
2. Lambda依存関係検証
3. TypeScript型チェック
4. ESLint
5. コード整合性チェック

**Pre-Push Hook:** `.git/hooks/pre-push`

**検証項目:**
1. Lambda依存関係検証
2. 環境変数検証
3. I18nシステム検証
4. 重要ファイルの未ステージ変更警告

**設定:**
```bash
# Hooksは既にインストール済み
# 無効化する場合（非推奨）
git commit --no-verify

# Hooksの状態確認
ls -la .git/hooks/pre-commit .git/hooks/pre-push
```

---

### Layer 3: npm Scripts統合

**安全なコマンド:**
```bash
# ✅ 推奨: WebSocket Lambda
pnpm run deploy:websocket

# ✅ 推奨: 他のスタック
pnpm run deploy:stack <StackName>

# ✅ 完全ビルド・デプロイ
pnpm run build:deploy

# ❌ 禁止: 直接CDKデプロイ
pnpm run cdk:deploy
# → エラーメッセージが表示されて停止
```

**緊急時のアンセーフモード（非推奨）:**
```bash
# 完全に理解している場合のみ使用
pnpm run cdk:deploy:unsafe
```

---

### Layer 4: デプロイルール強制

**スクリプト:** `scripts/enforce-deployment-rules.sh`

**設定方法:**
```bash
# シェル起動時に自動実行（オプション）
echo "source /workspaces/prance-communication-platform/scripts/enforce-deployment-rules.sh" >> ~/.bashrc
source ~/.bashrc

# 一時的に有効化
source ./scripts/enforce-deployment-rules.sh
```

**効果:**
- `cdk deploy`コマンドをインターセプト
- 正しいデプロイ方法を表示
- デプロイリマインダーを表示

---

### Layer 5: ドキュメント・メモリ統合

**必読ドキュメント:**
- `START_HERE.md` - 次回セッション開始手順
- `CLAUDE.md` - プロジェクト概要・重要方針
- `docs/07-development/LAMBDA_BUILD_DEPLOY_GUIDE.md` - Lambda専用ガイド
- `docs/07-development/DEPLOYMENT_ENFORCEMENT.md` - このファイル

**メモリファイル:**
- `.claude/memory/MEMORY.md` - セッション間で永続化される情報
- `.claude/memory/deployment-rules.md` - デプロイルール（作成予定）

---

## 正しいデプロイフロー

### WebSocket Lambda関数のデプロイ

```bash
# 1. 手動デプロイスクリプト使用（必須）
pnpm run deploy:websocket

# または直接実行
./scripts/deploy-lambda-websocket-manual.sh

# 内部で自動実行される内容:
# - Step 1: Prisma Client生成
# - Step 2: TypeScriptビルド
# - Step 3: 共有モジュールコピー
# - Step 4: 依存関係検証
# - Step 5: ZIPファイル作成
# - Step 6: ZIP構造検証
# - Step 7: AWS Lambda デプロイ
# - Step 8: デプロイ後テスト（5項目）
```

### 他のスタックのデプロイ

```bash
# 1. ラッパースクリプト使用（推奨）
pnpm run deploy:stack Prance-dev-Database

# 内部で自動実行される内容:
# - 事前検証（pre-deploy-lambda-check.sh）
# - 環境変数検証（validate-env.sh）
# - インフラビルド
# - CDKデプロイ
# - 事後検証（post-deploy-lambda-test.sh）
```

### 完全デプロイ

```bash
# 全スタックを順次デプロイ
pnpm run build:deploy

# 内部で実行:
# 1. clean-build.sh - クリーンビルド
# 2. pre-deploy-lambda-check.sh - 事前検証
# 3. cdk deploy --all - 全スタックデプロイ
# 4. post-deploy-lambda-test.sh - 事後検証
```

---

## 検証スクリプト一覧

| スクリプト | 実行タイミング | 検証内容 |
|-----------|---------------|---------|
| `validate-env.sh` | デプロイ前 | 環境変数の存在・形式確認 |
| `validate-i18n-system.sh` | コミット前 | next-intl使用禁止チェック |
| `validate-lambda-dependencies.sh` | デプロイ前・コミット前 | Lambda依存関係の完全性 |
| `validate-lambda-zip.sh` | デプロイ前 | ZIPファイル構造検証 |
| `validate-lambda-env-vars.sh` | デプロイ後 | Lambda環境変数確認 |
| `pre-deploy-lambda-check.sh` | デプロイ前 | 全検証の統合実行 |
| `post-deploy-lambda-test.sh` | デプロイ後 | 動作確認（5項目） |

---

## トラブルシューティング

### 問題: Git Hooksが実行されない

**原因:** Hooksファイルに実行権限がない

**解決策:**
```bash
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push
```

---

### 問題: 「古いコードがデプロイされている」

**原因:** CDKの通常デプロイを使用した

**解決策:**
```bash
# WebSocket Lambda関数を再デプロイ
pnpm run deploy:websocket

# デプロイ後テストで確認
pnpm run lambda:test prance-websocket-default-dev
```

---

### 問題: デプロイがエラーで止まる

**原因1: 環境変数が不正**

**解決策:**
```bash
./scripts/validate-env.sh
# エラーを修正後、再デプロイ
```

**原因2: Lambda依存関係が破損**

**解決策:**
```bash
pnpm run lambda:fix
pnpm run lambda:validate
```

**原因3: Prisma Clientが古い**

**解決策:**
```bash
cd packages/database
pnpm exec prisma generate
cd ../..
```

---

## 緊急時の手順

### 完全に壊れた場合

```bash
# 1. クリーンビルド
pnpm run build:clean

# 2. Lambda依存関係修復
pnpm run lambda:fix

# 3. Prisma Client再生成
pnpm run db:generate

# 4. 環境変数検証
pnpm run env:validate

# 5. 再デプロイ
pnpm run deploy:websocket
```

---

## チェックリスト

### デプロイ前（必須）

- [ ] `pnpm run env:validate` 実行
- [ ] `pnpm run lambda:validate` 実行
- [ ] `pnpm run i18n:validate` 実行
- [ ] コードがコミット済み
- [ ] Prismaスキーマ変更がある場合は`pnpm run db:generate`実行済み

### デプロイ後（推奨）

- [ ] `pnpm run lambda:test <function-name>` 実行
- [ ] CloudWatch Logsでエラー確認
- [ ] ブラウザで動作確認

---

## FAQ

### Q: なぜこんなに複雑な仕組みが必要なのか？

**A:** 過去に複数回、デプロイミスでサービス停止が発生しました。

- Prisma Client欠如 → 500エラー
- Azure Speech SDK欠如 → STTエラー
- CLOUDFRONT_DOMAIN欠如 → 音声再生エラー
- JWT_SECRET不一致 → WebSocket接続エラー

これらは全て、デプロイ前検証をスキップしたことが原因です。

---

### Q: Git Hooksを無効化できるか？

**A:** 可能ですが、**強く非推奨**です。

```bash
# 一時的に無効化（緊急時のみ）
git commit --no-verify
git push --no-verify
```

無効化した場合、手動で全検証を実行してください。

---

### Q: CDKの通常デプロイが完全に禁止されたのか？

**A:** いいえ。WebSocket Lambda以外は通常デプロイも可能です。

ただし、ラッパースクリプト（`cdk-deploy-wrapper.sh`）の使用を推奨します。

---

## まとめ

**デプロイの黄金律:**

1. **WebSocket Lambda → 必ず手動デプロイスクリプト使用**
2. **他のスタック → ラッパースクリプト推奨**
3. **直接CDKコマンド → 避けるべき**
4. **検証スキップ → 厳禁**

**これらのルールを守ることで、デプロイ失敗率を0%に近づけます。**

---

**関連ドキュメント:**
- `docs/07-development/LAMBDA_BUILD_DEPLOY_GUIDE.md`
- `docs/09-progress/PREVENTION_MECHANISMS_2026-03-14.md`
- `docs/09-progress/ROOT_CAUSE_ANALYSIS_2026-03-14_*.md`
