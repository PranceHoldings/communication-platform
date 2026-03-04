# Azure Speech Services セットアップチェックリスト

## 📋 リソース作成前の確認

- [ ] Azureアカウントを作成済み
- [ ] クレジットカード登録完了（無料枠でも必要）
- [ ] サブスクリプションがアクティブ

## 🔧 リソース作成時の設定

### 基本設定

- [ ] **Subscription**: 選択済み
- [ ] **Resource Group**: `prance-resources`（新規作成）
- [ ] **Region**: `East US`（推奨）
- [ ] **Name**: グローバルで一意な名前（例: `prance-speech-service-yourname`）
- [ ] **Pricing Tier**: `Free F0`（Alpha版推奨）

### 確認事項

- [ ] Pricing Tierが `Free F0` になっているか確認
- [ ] Regionが `East US` になっているか確認
- [ ] リソース名にタイポがないか確認

## 📝 リソース作成後

### Keys and Endpoint の取得

- [ ] リソースに移動（Go to resource）
- [ ] 左メニューから「Keys and Endpoint」を選択
- [ ] 以下の情報をコピー:
  - [ ] **KEY 1** または **KEY 2**
  - [ ] **Location/Region**（例: eastus）
  - [ ] **Endpoint**（参考用）

### .env.local への設定

- [ ] プロジェクトルートの `.env.local` を開く
- [ ] 以下を設定:
  ```bash
  AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  AZURE_SPEECH_REGION=eastus
  ```
- [ ] ファイルを保存

## 🧪 動作確認（オプション）

### curlでテスト

```bash
# 音声合成（TTS）のテスト
curl -X POST "https://eastus.tts.speech.microsoft.com/cognitiveservices/v1" \
  -H "Ocp-Apim-Subscription-Key: YOUR_AZURE_KEY" \
  -H "Content-Type: application/ssml+xml" \
  -H "X-Microsoft-OutputFormat: audio-16khz-128kbitrate-mono-mp3" \
  -d '<speak version="1.0" xml:lang="en-US"><voice xml:lang="en-US" name="en-US-JennyNeural">Hello, this is a test.</voice></speak>' \
  --output test_azure_audio.mp3
```

- [ ] テストコマンドを実行
- [ ] `test_azure_audio.mp3` が生成されたか確認
- [ ] オーディオファイルを再生して音声を確認

## 💰 コスト管理（Optional）

### Free F0 の場合

- [ ] 使用量を確認: Azureポータル → Cost Management
- [ ] 月次制限を確認:
  - 音声認識: 5時間/月
  - 音声合成: 500万文字/月

### Standard S0 の場合（Free F0が使えない場合）

- [ ] Cost Management + Billing でアラート設定
- [ ] Budget: $10 を設定
- [ ] Alert condition: 80% で通知

## 🔒 セキュリティ

- [ ] APIキーを `.env.local` に保存（`.gitignore` で除外されていることを確認）
- [ ] APIキーをコードに直接書かない
- [ ] KEY 2 を記録（ローテーション用）

## ✅ 完了確認

全てのチェックが完了したら:

- [ ] `.env.local` にAzure設定が完了
- [ ] テストコマンドが成功（オプション）
- [ ] リソースが正常に動作

---

## 🆘 トラブルシューティング

### エラー: "Free tier limit reached"

→ 既にFree F0を使用している
→ 対処: 既存リソースのキーを使用、またはStandard S0を選択

### エラー: "Name is already taken"

→ リソース名が重複している
→ 対処: 名前の末尾に数字や日付を追加

### エラー: "Region not supported"

→ 選択したリージョンでFree F0が利用できない
→ 対処: East US または West US に変更

---

**完了したら、チーム/開発リードに報告してください！**
