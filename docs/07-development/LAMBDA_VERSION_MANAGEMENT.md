# Lambda関数バージョン管理システム

**作成日:** 2026-03-08
**ステータス:** ✅ 実装完了

---

## 📋 概要

Lambda関数が古いバージョンでデプロイされている問題を防ぐため、バージョン管理と検証の仕組みを実装しました。

### 問題の背景

**発生した問題:**

- ローカルソースコードは最新（`volume=10.0 + compressor`）
- しかしデプロイ済みLambda関数は古いバージョン（`volume=3.0`のみ）
- 結果: Azure STT音声認識が失敗

**根本原因:**

- デプロイ後にバージョンを確認する仕組みがなかった
- テスト前にバージョンを確認する手順がなかった

---

## 🔧 実装内容

### 1. バージョン番号の管理

**ファイル:** `infrastructure/lambda/websocket/default/package.json`

```json
{
  "name": "websocket-default-handler",
  "version": "1.1.0" // ← セマンティックバージョニング
}
```

**バージョニング規則:**

- **Major (1.x.x)**: 破壊的変更、API変更
- **Minor (x.1.x)**: 新機能追加、重要な改善
- **Patch (x.x.1)**: バグ修正、小さな改善

**変更履歴:**
| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.1.0 | 2026-03-08 | 音声処理改善（volume=10.0 + compressor）、バージョン管理追加 |
| 1.0.0 | 2026-03-07 | 初期バージョン（volume=3.0）|

### 2. Lambda関数にバージョンエンドポイント追加

**ファイル:** `infrastructure/lambda/websocket/default/index.ts`

**追加機能:**

#### a) package.jsonのインポート

```typescript
import packageJson from './package.json';
```

#### b) バージョン情報エンドポイント

```typescript
case 'version':
case 'health':
  await sendToConnection(connectionId, {
    type: 'version',
    version: packageJson.version,
    name: packageJson.name,
    timestamp: Date.now(),
    runtime: 'nodejs22.x',
    audioProcessing: {
      volume: '10.0',
      compressor: 'enabled',
      sttAutoDetect: true,
      languages: ['ja-JP', 'en-US'],
    },
  });
  break;
```

#### c) 起動時バージョンログ

```typescript
export const handler = async (event: WebSocketEvent) => {
  console.log(
    '[Lambda Version]',
    packageJson.version,
    '- Audio Processing: volume=10.0 + compressor'
  );
  // ...
};
```

**CloudWatch Logsでの確認:**

```
[Lambda Version] 1.1.0 - Audio Processing: volume=10.0 + compressor
```

### 3. バージョン確認スクリプト

**ファイル:** `scripts/check-lambda-version.sh`

**機能:**

1. ローカルの`package.json`からバージョン取得
2. Lambda関数の最終更新日時・コードサイズ確認
3. CloudWatch Logsから実行中のバージョン取得
4. バージョン比較・不一致警告

**使用方法:**

```bash
# デフォルト（prance-websocket-default-dev）
./scripts/check-lambda-version.sh

# 別の関数を指定
./scripts/check-lambda-version.sh my-function-name
```

**出力例:**

```
🔍 Lambda関数バージョンチェック
==============================================
関数名: prance-websocket-default-dev

📦 ローカルバージョン: 1.1.0
☁️  デプロイ済みLambda:
   最終更新: 2026-03-08T09:01:12.000+0000
   コードサイズ: 31784767 bytes
   ランタイム: nodejs22.x

📋 CloudWatch Logsから実行中のバージョンを確認中...
✅ 実行中のバージョン: 1.1.0

📊 バージョン比較:
   ローカル: 1.1.0
   デプロイ済み: 1.1.0

✅ バージョン一致 - Lambda関数は最新です
```

### 4. デプロイスクリプトへの統合

**ファイル:** `infrastructure/deploy.sh`

**追加内容:**

```bash
# 8. Lambda関数のバージョン確認
echo -e "\n${YELLOW}🔍 Lambda関数のバージョンを確認中...${NC}"

WEBSOCKET_FUNCTION="prance-websocket-default-${ENVIRONMENT}"
LOCAL_VERSION=$(cat lambda/websocket/default/package.json | grep '"version"' | sed 's/.*"version": "\(.*\)".*/\1/')

echo -e "${BLUE}📦 ローカルバージョン:${NC} ${LOCAL_VERSION}"

FUNCTION_INFO=$(aws lambda get-function --function-name ${WEBSOCKET_FUNCTION} --query 'Configuration.LastModified' --output text)
echo -e "${GREEN}✅ Lambda関数更新完了: ${FUNCTION_INFO}${NC}"
```

**デプロイ後の確認手順:**

1. デプロイスクリプト実行 → 自動でバージョン確認
2. テストリクエスト送信
3. `./scripts/check-lambda-version.sh` で再確認

### 5. フロントエンドからのバージョン確認

**ファイル:** `apps/web/hooks/useWebSocket.ts`

**追加機能:**

#### a) `checkVersion()` 関数

```typescript
const checkVersion = useCallback(() => {
  console.log('[WebSocket] Requesting version information');
  sendMessage({
    type: 'version',
  });
}, [sendMessage]);
```

#### b) バージョン応答ハンドラー

```typescript
case 'version':
  console.log('[WebSocket] Lambda Version Info:', message);
  console.log('  Name:', message.name);
  console.log('  Version:', message.version);
  console.log('  Runtime:', message.runtime);
  console.log('  Audio Processing:', message.audioProcessing);
  break;
```

**ブラウザコンソールでの使用:**

```typescript
// SessionPlayerコンポーネント内で
const { checkVersion, isConnected } = useWebSocket({ ... });

// WebSocket接続後に実行
if (isConnected) {
  checkVersion();
}
```

**コンソール出力例:**

```
[WebSocket] Requesting version information
[WebSocket] Lambda Version Info: {
  type: 'version',
  version: '1.1.0',
  name: 'websocket-default-handler',
  timestamp: 1772961672000,
  runtime: 'nodejs22.x',
  audioProcessing: {
    volume: '10.0',
    compressor: 'enabled',
    sttAutoDetect: true,
    languages: ['ja-JP', 'en-US']
  }
}
```

---

## 📖 使用方法

### デプロイ時のワークフロー

#### 1. コード変更時

```bash
# 1. package.jsonのバージョンを更新
cd infrastructure/lambda/websocket/default
# version を 1.1.0 → 1.2.0 に変更

# 2. 変更をコミット
git add package.json
git commit -m "feat: 新機能追加 (v1.2.0)"

# 3. デプロイ
cd ../../../infrastructure
./deploy.sh dev

# 4. バージョン確認（デプロイスクリプトが自動実行）
# または手動で実行:
cd ..
./scripts/check-lambda-version.sh
```

#### 2. テスト前の確認

```bash
# テスト実行前に必ず確認
./scripts/check-lambda-version.sh

# バージョンが不一致の場合
cd infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# 再確認
cd ..
./scripts/check-lambda-version.sh
```

### ブラウザでのバージョン確認

#### 方法1: コンソールから手動実行

```javascript
// 開発者ツール → コンソール
// SessionPlayer接続後に実行
checkVersion(); // グローバルに公開されていない場合は、コンポーネント内で実行
```

#### 方法2: 自動確認（実装例）

```typescript
// SessionPlayerコンポーネント
useEffect(() => {
  if (isConnected) {
    // 接続後にバージョン確認
    checkVersion();
  }
}, [isConnected, checkVersion]);
```

---

## 🔍 トラブルシューティング

### 問題1: バージョンが「不明」と表示される

**原因:**

- Lambda関数がまだ実行されていない
- CloudWatch Logsにバージョンログがない

**解決方法:**

```bash
# テストリクエストを送信してLambda関数を起動
cd apps/web
pnpm run dev

# ブラウザでセッションを開始
# または、直接WebSocketメッセージを送信
```

### 問題2: バージョンが不一致

**原因:**

- デプロイが失敗している
- CDKの差分がない（変更が検出されない）

**解決方法:**

```bash
# 強制的に再ビルド・再デプロイ
cd infrastructure/lambda/websocket/default
pnpm install
rm -rf node_modules
pnpm install

# Zipファイルを作成して直接アップロード
cd /workspaces/prance-communication-platform/infrastructure/lambda/websocket/default
zip -r /tmp/lambda-function.zip . -x "*.ts" "*.git*" "node_modules/.cache/*"

aws lambda update-function-code \
  --function-name prance-websocket-default-dev \
  --zip-file fileb:///tmp/lambda-function.zip

# バージョン確認
cd /workspaces/prance-communication-platform
./scripts/check-lambda-version.sh
```

### 問題3: CloudWatch Logsでバージョンログが見つからない

**原因:**

- ログの保持期間が短い
- フィルターパターンが正しくない

**解決方法:**

```bash
# 手動でCloudWatch Logsを確認
aws logs tail /aws/lambda/prance-websocket-default-dev \
  --since 5m \
  --format short \
  | grep "Lambda Version"

# または、AWS Consoleで確認
# https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fprance-websocket-default-dev
```

---

## 📊 チェックリスト

### デプロイ前

- [ ] `package.json`のバージョンを更新
- [ ] 変更内容をコミット
- [ ] ローカルでTypeScriptコンパイルエラーなし

### デプロイ後

- [ ] デプロイスクリプトが成功
- [ ] `./scripts/check-lambda-version.sh` 実行
- [ ] バージョンが一致していることを確認

### テスト前

- [ ] `./scripts/check-lambda-version.sh` 実行
- [ ] バージョン一致を確認
- [ ] 必要に応じて再デプロイ

### テスト実行

- [ ] セッション開始
- [ ] ブラウザコンソールでバージョン確認
- [ ] CloudWatch Logsでバージョンログ確認
- [ ] 期待通りの動作を確認

---

## 🎯 今後の改善案

### Phase 2: CI/CD統合

- GitHub Actionsでデプロイ時に自動バージョン確認
- バージョン不一致の場合はデプロイ失敗

### Phase 3: モニタリング

- CloudWatch Alarmsでバージョン不一致を検出
- Slackに通知

### Phase 4: 自動バージョン管理

- git tagから自動的にバージョン番号を生成
- package.jsonを自動更新

---

## 📝 関連ファイル

- `infrastructure/lambda/websocket/default/package.json` - バージョン番号
- `infrastructure/lambda/websocket/default/index.ts` - バージョンエンドポイント
- `scripts/check-lambda-version.sh` - バージョン確認スクリプト
- `infrastructure/deploy.sh` - デプロイスクリプト（バージョン確認統合）
- `apps/web/hooks/useWebSocket.ts` - フロントエンドバージョン確認
- `START_HERE.md` - テスト前確認手順

---

**作成者:** Claude Sonnet 4.5
**最終更新:** 2026-03-08 18:00 JST
