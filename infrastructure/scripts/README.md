# Infrastructure Scripts

このディレクトリには、インフラ管理の自動化スクリプトが含まれています。

---

## 📋 スクリプト一覧

### sync-env.js

**目的:** `.env.local`を`infrastructure/.env`に自動同期

**自動実行されるタイミング:**

- `npm run deploy` の前（`predeploy`フック）
- `./deploy.sh` の実行時

**手動実行:**

```bash
node scripts/sync-env.js
```

**機能:**

1. プロジェクトルートの`.env.local`を`infrastructure/.env`にコピー
2. 必須APIキーの存在確認
   - `AZURE_SPEECH_KEY`
   - `ELEVENLABS_API_KEY`
   - `JWT_SECRET`
3. エラーがある場合はプロセスを終了（exit code 1）

**エラー例:**

```bash
❌ エラー: .env.local が見つかりません
   場所: /workspaces/prance-communication-platform/.env.local

   以下の手順で作成してください:
   1. cp /workspaces/prance-communication-platform/.env.example /workspaces/prance-communication-platform/.env.local
   2. .env.local にAPIキーを設定
   3. 詳細: docs/development/API_KEY_MANAGEMENT.md
```

**成功例:**

```bash
🔐 環境変数ファイルを同期中...
✅ 環境変数ファイル同期完了
   コピー元: /workspaces/prance-communication-platform/.env.local
   コピー先: /workspaces/prance-communication-platform/infrastructure/.env

🔍 必須APIキーの確認中...
✅ 必須APIキー確認完了
   デプロイを続行します...
```

---

## 🔧 カスタマイズ

### 必須APIキーの追加

`sync-env.js`の`requiredKeys`配列に追加:

```javascript
const requiredKeys = [
  { key: 'AZURE_SPEECH_KEY', name: 'Azure Speech Services' },
  { key: 'ELEVENLABS_API_KEY', name: 'ElevenLabs' },
  { key: 'JWT_SECRET', name: 'JWT Secret' },
  { key: 'YOUR_NEW_KEY', name: 'Your New Service' }, // ← 追加
];
```

---

## 🚨 トラブルシューティング

### .env.local が見つからない

```bash
# 解決方法
cd /workspaces/prance-communication-platform
cp .env.example .env.local
# .env.local を編集してAPIキーを設定
```

### APIキーが未設定

```bash
# エラー: AZURE_SPEECH_KEY が設定されていません

# 解決方法
# .env.local を編集
AZURE_SPEECH_KEY=your-actual-key
```

### スクリプトの実行権限エラー

```bash
# エラー: permission denied: ./scripts/sync-env.js

# 解決方法
chmod +x scripts/sync-env.js
```

---

## 📚 関連ドキュメント

- **APIキー管理ガイド**: `docs/development/API_KEY_MANAGEMENT.md`
- **デプロイガイド**: `../deploy.sh` の冒頭コメント
- **MEMORY.md**: `/home/vscode/.claude/projects/-workspaces-prance-communication-platform/memory/MEMORY.md`

---

## 🔄 動作フロー

```
npm run deploy
    ↓
predeploy フック実行
    ↓
node scripts/sync-env.js
    ↓
.env.local 存在確認
    ↓
.env.local → infrastructure/.env コピー
    ↓
必須APIキー検証
    ↓
成功 → CDKデプロイ続行
失敗 → プロセス終了（exit 1）
```

---

**最終更新:** 2026-03-06
