# デプロイ環境クライシス - 現状認識と修復計画

**日時:** 2026-03-08 09:40 JST
**ステータス:** 🔴 CRITICAL - 音声・録画処理が完全停止

---

## 🔴 発見された重大問題

### 1. Lambda関数のffmpeg完全欠落（Critical）

**症状:**
```
ERROR: /var/task/ffmpeg: No such file or directory
- AUDIO_PROCESSING_ERROR: 音声変換（WebM→WAV）失敗
- VIDEO_PROCESSING_ERROR: ビデオチャンク結合失敗
```

**根本原因:**
- `infrastructure/lambda/websocket/default/package.json`に`ffmpeg-static@^5.3.0`が記載されている
- しかし実際には`node_modules`にインストールされていない
- `npm list ffmpeg-static` → `(empty)`

**影響範囲:**
- 音声処理パイプライン: 100%失敗
- 録画機能: 100%失敗
- すべてのセッションで音声・録画が使用不可

**コンソールエラーログ（consoleerror.txt）:**
```
AUDIO_PROCESSING_ERROR: Command failed: /var/task/ffmpeg -i /tmp/input-6cb...
  /bin/sh: line 1: /var/task/ffmpeg: No such file or directory

VIDEO_PROCESSING_ERROR: Failed to process video recording
  ffmpeg failed: Command failed: /var/task/ffmpeg -f concat...
  /bin/sh: line 1: /var/task/ffmpeg: No such file or directory
```

---

### 2. Lambda関数のnode_modules破損（Critical）

**症状:**
```bash
$ npm install
npm error code Unknown system error -35
npm error syscall spawn
npm error errno -35
```

**詳細:**
- `microsoft-cognitiveservices-speech-sdk`ディレクトリが部分的に破損
- `ENOTEMPTY: directory not empty`エラーが繰り返し発生
- npm cache cleanも効果なし

**試行した対策（すべて失敗）:**
```bash
# 1. 通常の再インストール
npm install → spawn error -35

# 2. キャッシュクリーン + 再インストール
npm cache clean --force && npm install → spawn error -35

# 3. node_modules削除 + 再インストール
rm -rf node_modules && npm install → spawn error -35
```

**環境情報:**
- Node.js: v24.14.0
- npm: v11.9.0
- Platform: Linux (Codespaces)

---

### 3. Next.js開発サーバー: 500エラー（High）

**症状:**
```bash
$ curl http://localhost:3000
500
```

**プロセス状態:**
```bash
$ ps aux | grep "next dev"
vscode   41084  PORT=3000 next dev
vscode   41085  node .../next dev
```
→ プロセスは実行中だが機能不全

---

### 4. Lambda関数バージョン不明（Medium）

**症状:**
```bash
$ ./scripts/check-lambda-version.sh
ローカル: 1.1.0
デプロイ済み: 不明
最近のログが見つかりません
```

**原因:**
- Lambda関数が最近呼び出されていない
- CloudWatch Logsにログがない

---

## 📋 修復計画

### Phase 1: Lambda関数の再デプロイ（最優先）

**方針:**
- ローカルのnpm installは諦める
- CDKの自動バンドリング機能を使用
- CDKは内部でDocker/esbuildを使ってクリーンな環境で依存関係をインストールしてバンドル

**手順:**
```bash
# 1. CDK出力をクリーンアップ
cd /workspaces/prance-communication-platform/infrastructure
rm -rf cdk.out

# 2. Lambda関数のnode_modulesを削除（CDKが再生成）
rm -rf lambda/websocket/default/node_modules

# 3. Lambda関数を再デプロイ
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

**期待される結果:**
- CDKがクリーンな環境でffmpeg-staticを含む全依存関係をインストール
- Lambda関数に正しくバンドル
- `/var/task/node_modules/ffmpeg-static/ffmpeg` が利用可能になる

---

### Phase 2: Next.js開発サーバーの再起動

**手順:**
```bash
# 1. 既存プロセスを停止
pkill -f "next dev"

# 2. Next.jsキャッシュをクリーン
cd /workspaces/prance-communication-platform/apps/web
rm -rf .next

# 3. 開発サーバーを再起動
npm run dev
```

---

### Phase 3: 動作確認

**確認項目:**

1. **Lambda関数バージョン確認**
   ```bash
   ./scripts/check-lambda-version.sh
   ```
   → デプロイ済みバージョンが1.1.0であることを確認

2. **Next.js開発サーバー**
   ```bash
   curl http://localhost:3000
   ```
   → 200 OKを確認

3. **Lambda API Health Check**
   ```bash
   curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health
   ```
   → `{"status":"healthy"}`を確認

4. **音声処理テスト**
   - ブラウザでログイン
   - セッションを開始
   - 音声録音・送信
   - CloudWatch Logsで成功ログ確認

5. **録画処理テスト**
   - セッションで録画開始
   - ビデオチャンクが送信される
   - DynamoDBでCOMPLETEDステータス確認
   - S3に`recording.webm`が保存されている

---

## 🔍 根本原因分析

### なぜこの状況になったか？

1. **Lambda関数のnode_modulesがローカルで管理されていた**
   - CDKは通常、Lambda関数の依存関係を自動バンドルする
   - しかし、既存のnode_modulesが存在すると、それを使用してしまう可能性
   - ローカルのnpm installが失敗すると、古い/不完全なnode_modulesが残る

2. **ffmpeg-staticパッケージの追加が不完全だった**
   - package.jsonには追加されたが、実際にはインストールされなかった
   - デプロイ時にこの不整合が反映されてしまった

3. **環境の一時的な問題**
   - Codespaces環境でのnpm spawn error -35
   - ファイルシステムの一時的な問題の可能性

---

## 🛡️ 今後の予防策

### 1. Lambda関数のnode_modulesを.gitignoreに追加（必須）

```bash
# infrastructure/lambda/websocket/default/.gitignore
node_modules/
package-lock.json
```

**理由:**
- CDKが常にクリーンな環境でビルド
- ローカルの不完全なnode_modulesが混入しない

### 2. デプロイ前の必須チェック追加

```bash
# infrastructure/deploy.sh に追加
# Lambda関数のnode_modulesをクリーン（CDKに任せる）
rm -rf lambda/*/node_modules
```

### 3. Lambda関数バージョン確認の自動化

```bash
# デプロイ後に必ず実行
./scripts/check-lambda-version.sh

# バージョン不一致があればエラー
```

### 4. CI/CDパイプラインでの検証

- デプロイ後にhealth check
- 音声処理の統合テスト
- 録画処理の統合テスト

---

## 📊 タイムライン

| 時刻 | イベント | ステータス |
|------|---------|-----------|
| 2026-03-08 00:28 | Next.js開発サーバー起動 | 稼働中だが500エラー |
| 2026-03-08 09:19 | Lambda関数最終デプロイ | v1.1.0（しかしffmpeg欠落） |
| 2026-03-08 09:37 | 現状確認開始 | ffmpeg欠落を発見 |
| 2026-03-08 09:38 | npm install試行 | spawn error -35で失敗 |
| 2026-03-08 09:39 | node_modules削除＋再試行 | 同じエラー |
| 2026-03-08 09:40 | 現状ドキュメント作成 | このファイル |
| **次:** | **CDK再デプロイ** | **修復開始** |

---

## ✅ 次のアクション

1. **immediate（今すぐ）:**
   - CDKでLambda関数を再デプロイ
   - Next.js開発サーバーを再起動

2. **short-term（1時間以内）:**
   - 動作確認（音声・録画テスト）
   - Lambda関数バージョン確認

3. **medium-term（1日以内）:**
   - .gitignore追加
   - deploy.shにクリーンアップ追加
   - START_HERE.md更新

---

**次のコマンド:**
```bash
cd /workspaces/prance-communication-platform/infrastructure
rm -rf cdk.out lambda/websocket/default/node_modules
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```
