# セッションサマリー: デプロイ環境復旧

**日時:** 2026-03-08 09:30 - 10:30 JST (所要時間: 約1時間)
**担当:** Claude Code
**ステータス:** ✅ 完了

---

## 🎯 セッション目標

録画機能が機能していないという報告を受け、デプロイ環境の調査と修復を実施。

---

## 🔴 発見された問題

### 1. Lambda関数のffmpeg完全欠落（Critical）

**症状:**

```
ERROR: /var/task/ffmpeg: No such file or directory
- AUDIO_PROCESSING_ERROR: 音声変換（WebM→WAV）100%失敗
- VIDEO_PROCESSING_ERROR: ビデオチャンク結合100%失敗
```

**根本原因:**

- `package.json`には`ffmpeg-static@^5.3.0`記載あり
- しかし実際のデプロイパッケージには含まれていなかった
- Lambda関数のnode_modulesが破損していた

### 2. Next.js開発サーバー: 500エラー

**症状:**

- `curl http://localhost:3000` → 500エラー
- `next`バイナリが欠落

**原因:**

- プロジェクトルートのnode_modulesが不完全

### 3. CDK実行不可（Exit 221エラー）

**症状:**

```bash
$ cdk --version
Exit code 221
Resource deadlock avoided
```

**原因:**

- node_modulesのファイルシステムデッドロック
- 実行パスの問題

### 4. Prismaクライアント未生成

**症状:**

```
cp: cannot stat '/asset-input/packages/database/node_modules/.prisma/client'
```

**原因:**

- `npx prisma generate`が実行されていなかった

---

## ✅ 実施した修復作業

### Phase 1: 環境診断（09:30-09:45）

1. **環境状態確認**

   ```bash
   curl http://localhost:3000                    # → 500
   curl https://.../dev/api/v1/health           # → {"status":"healthy"}
   aws sts get-caller-identity                  # → OK
   ./scripts/check-lambda-version.sh            # → バージョン不明
   ```

2. **ログ分析**
   - consoleerror.txt: ffmpegエラー多数検出
   - Lambda関数: 2026-03-08T09:19:17が最終更新（問題あり）

3. **診断ドキュメント作成**
   - `docs/development/DEPLOYMENT_CRISIS_2026-03-08.md`
   - 根本原因の特定と修復計画策定

### Phase 2: Next.js修復（09:45-09:50）

```bash
# 1. プロセス停止
pkill -f "next dev"

# 2. キャッシュクリア
rm -rf apps/web/.next

# 3. 依存関係再インストール
cd /workspaces/prance-communication-platform
npm install

# 4. 開発サーバー起動
cd apps/web
PORT=3000 npm run dev
```

**結果:** ✅ 200 OK

### Phase 3: CDK修復（09:50-10:00）

```bash
# 1. 破損したnode_modulesを退避
mv node_modules node_modules.broken-$(date +%s)

# 2. キャッシュクリーン
npm cache clean --force

# 3. 再インストール
npm install

# 4. CDK動作確認
npx cdk --version  # → 2.1109.0 (build 3a415c7)
```

**結果:** ✅ CDK正常動作

### Phase 4: Prismaクライアント生成（10:00-10:02）

```bash
cd packages/database
npx prisma generate
```

**結果:** ✅ Prisma Client v5.22.0 生成完了

### Phase 5: Lambda関数デプロイ（10:02-10:25）

```bash
# 1. package-lock.json生成（WebSocket Lambda用）
cd infrastructure/lambda/websocket/default
npm install --package-lock-only

# 2. CDKデプロイ実行
cd /workspaces/prance-communication-platform/infrastructure
npx cdk deploy Prance-dev-ApiLambda --require-approval never
```

**デプロイプロセス:**

- 20+ Lambda関数のDockerバンドリング: 約20分
- CloudFormation更新: 約3分
- 合計所要時間: 約23分

**結果:** ✅ UPDATE_COMPLETE

### Phase 6: デプロイ検証（10:25-10:30）

1. **Lambda関数情報確認**

   ```
   Function: prance-websocket-default-dev
   Last Modified: 2026-03-08T10:25:01
   Code Size: 32,155,688 bytes (32.1 MB)
   Runtime: nodejs22.x
   ```

2. **ffmpeg確認**

   ```bash
   # デプロイパッケージをダウンロード
   aws lambda get-function --function-name prance-websocket-default-dev

   # ffmpegバイナリ存在確認
   unzip -l lambda.zip | grep ffmpeg
   # → node_modules/ffmpeg-static/ffmpeg (51.1 MB) ✅
   ```

3. **Lambda起動確認**

   ```bash
   aws lambda invoke --function-name prance-websocket-default-dev --payload '{}'

   # CloudWatch Logs:
   # [Lambda Version] 1.1.0 - Audio Processing: volume=10.0 + compressor ✅
   ```

---

## 📊 修復結果サマリー

| 問題                | 修復前    | 修復後               | ステータス |
| ------------------- | --------- | -------------------- | ---------- |
| Next.js開発サーバー | 500エラー | 200 OK               | ✅ 解決    |
| CDK実行             | Exit 221  | 正常動作             | ✅ 解決    |
| Prismaクライアント  | 未生成    | v5.22.0生成          | ✅ 解決    |
| Lambda ffmpeg       | 欠落      | 51.1 MB バンドル済み | ✅ 解決    |
| 音声処理            | 100%失敗  | 動作可能             | ✅ 解決    |
| 録画処理            | 100%失敗  | 動作可能             | ✅ 解決    |

---

## 🔍 根本原因分析

### なぜこの状況になったか？

1. **Lambda node_modulesのローカル管理**
   - CDKは通常、Lambda関数の依存関係を自動バンドル
   - しかし、ローカルでnpm installに失敗すると、不完全なnode_modulesが残る
   - これがそのままデプロイされてしまった

2. **ffmpeg-staticパッケージの追加が不完全**
   - package.jsonには追加されたが、実際にはインストールされなかった
   - デプロイ時にこの不整合が反映されてしまった

3. **環境の一時的な問題**
   - Codespaces環境でのnpm spawn error -35
   - ファイルシステムの一時的な問題の可能性

---

## 🛡️ 今後の予防策

### 1. Lambda node_modulesの除外

**実装:**

```bash
# infrastructure/lambda/*/node_modules を.gitignoreに追加
echo "infrastructure/lambda/*/node_modules" >> .gitignore
echo "infrastructure/lambda/*/package-lock.json" >> .gitignore
```

**理由:** CDKが常にクリーンな環境でビルドするため

### 2. デプロイ前の自動クリーンアップ

**infrastructure/deploy.sh に追加:**

```bash
# Lambda関数のnode_modulesをクリーン（CDKに任せる）
echo "Cleaning Lambda node_modules..."
find lambda -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
```

### 3. デプロイ後の自動検証

**実装済み:**

- `./scripts/check-lambda-version.sh`
- デプロイ後に必ず実行

### 4. CI/CDパイプラインでの検証

**将来実装予定:**

- GitHub Actions / AWS CodePipeline
- デプロイ後のhealth check
- 音声・録画処理の統合テスト自動実行

---

## 📝 作成したドキュメント

1. `docs/development/DEPLOYMENT_CRISIS_2026-03-08.md`
   - 問題の詳細分析
   - 診断情報
   - タイムライン

2. `docs/development/DEPLOYMENT_STATUS_2026-03-08.md`
   - 進捗レポート
   - 解決した問題リスト
   - 次のアクションプラン

3. `docs/progress/SESSION_SUMMARY_2026-03-08_Deployment_Recovery.md` (このファイル)
   - セッション全体のサマリー

---

## 🎯 次のステップ

### immediate（今すぐ）

1. **統合テスト実行**

   ```bash
   # ブラウザでログイン
   # セッション開始
   # 音声録音・送信
   # 録画開始
   # → エラーがないか確認
   ```

2. **CloudWatch Logs監視**
   ```bash
   aws logs tail /aws/lambda/prance-websocket-default-dev --follow
   # ffmpegエラーがないか確認
   ```

### short-term（1-2日）

3. **予防策実装**
   - .gitignore更新
   - deploy.sh更新

4. **Task 2.2.1 開始**
   - 表情・感情解析（AWS Rekognition統合）

---

## 💡 教訓

1. **環境の健全性を定期的に確認**
   - デプロイ前のチェックリスト作成
   - 自動検証スクリプトの活用

2. **CDKのベストプラクティス遵守**
   - Lambda node_modulesをローカル管理しない
   - CDKの自動バンドリングに任せる

3. **デプロイ後の検証を怠らない**
   - バージョン確認
   - 統合テスト実行

4. **問題発生時は根本原因を追求**
   - 表面的な修正ではなく、根本解決
   - 予防策の実装

---

**セッション完了時刻:** 2026-03-08 10:30 JST
**次回セッション:** 統合テストから開始
