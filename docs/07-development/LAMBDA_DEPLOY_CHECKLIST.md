# Lambda デプロイ前必須チェックリスト

**🔴 このチェックリストを全て完了するまでデプロイ禁止**

---

## ⚠️ 重要な教訓

### 過去の失敗（同じミスを2回繰り返した）

**2026-03-11 (Day 12):** Azure Speech SDK欠如 → 検証プロセス確立
**2026-03-14 (Day 15):** Prisma Client欠如 → 確立されたプロセスを無視 ❌

**教訓:**
- ❌ 手動デプロイは禁止
- ❌ エラー抑制（`2>/dev/null`）の使用禁止
- ❌ 検証スクリプトのスキップ禁止
- ✅ 確立されたプロセスを必ず守る

---

## 📋 デプロイ前チェックリスト

### Phase 0: 心構え（必読）

- [ ] **急いでいますか？** → はい → **一度立ち止まってこのチェックリストを読む**
- [ ] **CDKエラーが出ましたか？** → はい → **手動デプロイに逃げない、根本原因を解決する**
- [ ] **前回のデプロイ方法を覚えていますか？** → いいえ → **このドキュメントを最後まで読む**

### Phase 1: 環境確認（5分）

```bash
# 1. Prisma Client生成
npm run db:generate

# 2. 環境変数確認
./scripts/validate-env.sh

# 3. Lambda依存関係確認
npm run lambda:validate
```

**チェック項目:**
- [ ] Prisma Client生成成功（`packages/database/node_modules/.prisma/client` 存在確認）
- [ ] 環境変数検証成功（DATABASE_URL, AWS_REGION等）
- [ ] Lambda依存関係検証成功（@prisma/client, @aws-sdk/*, shared modules）

### Phase 2: ビルド（2-5分）

```bash
# 4. TypeScriptビルド
npm run build:infra

# 5. Lambda関数ビルド
npm run lambda:build
```

**チェック項目:**
- [ ] TypeScriptコンパイル成功（0エラー）
- [ ] Lambda関数ビルド成功（全関数）

### Phase 3: デプロイ前検証（1-2分）⚡ 最重要

```bash
# 6. デプロイ前全検証（6項目）
npm run lambda:predeploy
```

**検証項目（自動）:**
- [ ] CHECK 0/7: 空白ディレクトリチェック
- [ ] CHECK 1/7: 環境変数
- [ ] CHECK 2/7: Lambda依存関係（**Prisma Client含む**）
- [ ] CHECK 3/7: i18nシステム
- [ ] CHECK 4/7: TypeScriptビルド
- [ ] CHECK 5/7: Prisma Client
- [ ] CHECK 6/7: CDK Synthesize

**⚠️ 1つでも失敗したら、デプロイ禁止！**

### Phase 4: デプロイ（5-10分）

```bash
# 7. Lambda関数デプロイ
npm run deploy:lambda

# または個別スタック
cd infrastructure
npx cdk deploy Prance-dev-ApiLambda --require-approval never
npx cdk deploy Prance-dev-WebSocketLambda --require-approval never
```

**チェック項目:**
- [ ] デプロイコマンド実行成功
- [ ] CloudFormation: UPDATE_COMPLETE
- [ ] Lambda関数: State = Active, LastUpdateStatus = Successful

### Phase 5: デプロイ後確認（2-3分）

```bash
# 8. Lambda関数状態確認
aws lambda get-function --function-name prance-websocket-default-dev \
  --query 'Configuration.[State,LastUpdateStatus,LastModified]' --output table

# 9. CloudWatch Logs確認
aws logs tail /aws/lambda/prance-websocket-default-dev --since 1m

# 10. エラーログ確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/prance-websocket-default-dev \
  --start-time $(($(date +%s) - 300))000 \
  --filter-pattern "ERROR"

# 11. Lambda環境変数検証（🆕 2026-03-14追加）⚡ 最重要
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev

# 12. CLOUDFRONT_DOMAIN確認（音声再生に必須）
aws lambda get-function-configuration \
  --function-name prance-websocket-default-dev \
  --query 'Environment.Variables.CLOUDFRONT_DOMAIN' \
  --output text

# 期待: d3mx0sug5s3a6x.cloudfront.net
```

**確認項目:**
- [ ] Lambda State: Active
- [ ] LastUpdateStatus: Successful
- [ ] CloudWatch Logs: エラーなし
- [ ] **Lambda環境変数: 全13項目が設定されている** 🆕
- [ ] **CLOUDFRONT_DOMAIN: *.cloudfront.net 形式** 🆕
- [ ] テスト実行: 正常動作

---

## 🚫 やってはいけないこと

### ❌ 絶対禁止

1. **手動デプロイ（esbuild + zip + aws lambda update-function-code）**
   - 理由: Prisma Client等の依存関係が欠落する
   - 例外: なし

2. **エラー抑制（`2>/dev/null`, `|| true`）**
   - 理由: エラーを見逃す
   - 例外: なし

3. **検証スクリプトのスキップ**
   - 理由: 本番環境で500エラー発生
   - 例外: なし

4. **CDKエラーを手動デプロイで回避**
   - 理由: 根本解決にならない
   - 正解: CDKエラーの根本原因を解決する

### ⚠️ 注意

5. **急いでデプロイ**
   - 理由: ミスを誘発する
   - 対策: このチェックリストを読む（5分）

6. **「前回はうまくいった」という思い込み**
   - 理由: 環境が変わっている可能性
   - 対策: 毎回このチェックリストを使う

---

## 🛠️ トラブルシューティング

### Issue 1: CDK Synthesize失敗

**エラー:** `cp: cannot stat '/asset-input/packages/database/node_modules/.prisma/client'`

**原因:** Prisma Client未生成

**解決策:**
```bash
npm run db:generate
npm run lambda:predeploy  # 再検証
```

### Issue 2: Lambda依存関係欠如

**エラー:** `Cannot find module '@prisma/client'`

**原因:** node_modules破損またはコピー失敗

**解決策:**
```bash
npm run lambda:fix        # 自動修復
npm run lambda:validate   # 確認
npm run lambda:predeploy  # 再検証
```

### Issue 3: デプロイ後に500エラー

**原因:** Lambda関数のモジュール欠如

**確認:**
```bash
# CloudWatch Logs確認
aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m

# エラーログ確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/prance-websocket-default-dev \
  --start-time $(($(date +%s) - 300))000 \
  --filter-pattern "ERROR"
```

**解決策:**
```bash
# 依存関係を修復してデプロイし直す
npm run lambda:fix
npm run lambda:predeploy
npm run deploy:lambda
```

---

## 📊 デプロイ履歴（失敗から学ぶ）

### ❌ 2026-03-14 17:16 JST - 失敗

**方法:** 手動デプロイ（esbuild + zip）
**結果:** Prisma Client欠如 → Runtime.ImportModuleError
**原因:** 検証スクリプトを使わなかった
**教訓:** 確立されたプロセスを守る

### ❌ 2026-03-11 - 失敗

**方法:** CDK deployのみ
**結果:** Azure Speech SDK欠如
**原因:** node_modules破損、検証プロセスなし
**教訓:** デプロイ前検証スクリプト作成

### ✅ 正しいデプロイフロー

```bash
npm run lambda:predeploy    # 必須
npm run deploy:lambda       # 推奨
```

---

## 📚 関連ドキュメント

- `docs/07-development/LAMBDA_BUILD_DEPLOY_GUIDE.md` - 完全ガイド
- `docs/09-progress/ROOT_CAUSE_ANALYSIS_2026-03-11_lambda_sdk_missing.md` - 前回の失敗分析
- `scripts/pre-deploy-lambda-check.sh` - デプロイ前検証スクリプト
- `scripts/validate-lambda-dependencies.sh` - 依存関係検証
- `scripts/fix-lambda-node-modules.sh` - 自動修復

---

## ✅ デプロイ完了確認

デプロイ後、以下を全て確認してください：

- [ ] CloudFormation: UPDATE_COMPLETE
- [ ] Lambda State: Active
- [ ] LastUpdateStatus: Successful
- [ ] **Lambda環境変数: 全13項目が設定されている** 🆕
- [ ] **CLOUDFRONT_DOMAIN: 有効な *.cloudfront.net 形式** 🆕
- [ ] CloudWatch Logs: エラーなし
- [ ] ブラウザテスト: 正常動作
- [ ] WebSocket接続: 成功
- [ ] セッション開始: エラーなし
- [ ] **音声再生: 正常に再生される** 🆕

---

## 🆕 追加された再発防止メカニズム（2026-03-14）

### Lambda環境変数検証

**過去の失敗:**
- **2026-03-11:** AZURE_SPEECH_KEY欠如 → STTエラー
- **2026-03-14:** CLOUDFRONT_DOMAIN欠如 → 音声再生エラー（複数回）

**新規スクリプト:**
```bash
# Lambda環境変数検証（13項目検証）
bash scripts/validate-lambda-env-vars.sh prance-websocket-default-dev

# 検証内容:
# - AWS Configuration (6項目): AWS_REGION, BUCKET_NAME, CLOUDFRONT_DOMAIN, DDB_*
# - API Keys (5項目): ELEVENLABS_API_KEY, AZURE_SPEECH_KEY, BEDROCK_*
# - Database & Security (2項目): DATABASE_URL, JWT_SECRET
# - CLOUDFRONT_DOMAIN形式検証: *.cloudfront.net
```

**効果:**
- ✅ 環境変数欠如を100%検出
- ✅ 音声再生エラーを予防
- ✅ デプロイ後即座に問題発見

> 詳細: `docs/07-development/ENVIRONMENT_VARIABLES_CHECKLIST.md`
> 詳細: `docs/09-progress/PREVENTION_MECHANISMS_2026-03-14.md`

---

**このチェックリストを守ることで、同じミスを繰り返さない！**

**最終更新:** 2026-03-14 18:45 JST
**作成理由:**
- Prisma Client欠如を2回繰り返したため（2026-03-14 Day 15）
- CLOUDFRONT_DOMAIN欠如で音声再生エラー（2026-03-14 Day 15）
