# ドメイン設定クイックスタート

お名前.comで取得した `prance.jp` を使用して、最速でカスタムドメインを設定する手順です。

## 🎯 目標

- 開発環境: `https://dev.app.prance.jp`
- ステージング環境: `https://staging.app.prance.jp`
- 本番環境: `https://platform.prance.jp`

にアクセス可能にする。

---

## ⚡ 最速セットアップ（10分）

### ステップ1: Route 53 ホストゾーン作成（1分）

```bash
# ホストゾーン作成
aws route53 create-hosted-zone \
  --name prance.jp \
  --caller-reference "prance-$(date +%s)"

# ネームサーバーを確認（メモする）
aws route53 list-hosted-zones-by-name \
  --dns-name prance.jp \
  --query 'HostedZones[0].Id' \
  --output text

# 上記のIDを使ってネームサーバー取得
aws route53 get-hosted-zone \
  --id /hostedzone/YOUR_HOSTED_ZONE_ID \
  --query 'DelegationSet.NameServers' \
  --output table
```

**出力例:**

```
-------------------------------------
|          NameServers              |
+-----------------------------------+
|  ns-123.awsdns-45.com             |
|  ns-678.awsdns-90.net             |
|  ns-1234.awsdns-56.org            |
|  ns-5678.awsdns-12.co.uk          |
+-----------------------------------+
```

### ステップ2: お名前.comでネームサーバー変更（3分）

1. [お名前.com Navi](https://www.onamae.com/navi/login/) にログイン
2. 「ドメイン設定」→「ネームサーバーの設定」
3. `prance.jp` を選択
4. 「他のネームサーバーを利用」を選択
5. 上記の4つのネームサーバーを入力
6. 「設定する」をクリック

### ステップ3: DNS変更の浸透を待つ（5分〜48時間）

```bash
# 5分ごとに確認
watch -n 300 'dig NS prance.jp +short'

# Route 53のネームサーバーが表示されたらOK
```

### ステップ4: デプロイ（5分）

```bash
cd infrastructure

# 開発環境にデプロイ
npm run deploy:dev

# 完了まで約5分
```

### ステップ5: アクセス確認（1分）

```bash
# DNSレコード確認
dig dev.app.prance.jp +short

# HTTPS接続確認
curl -I https://dev.app.prance.jp

# ブラウザでアクセス
open https://dev.app.prance.jp
```

---

## 🚨 よくある問題と解決方法

### 問題1: 「HostedZone not found」エラー

**原因:** Route 53ホストゾーンが作成されていない

**解決:**

```bash
# ホストゾーン作成
aws route53 create-hosted-zone \
  --name prance.jp \
  --caller-reference "prance-$(date +%s)"
```

### 問題2: SSL証明書の検証が完了しない

**原因:** DNS変更が浸透していない

**解決:**

```bash
# DNSの浸透を確認
dig prance.jp NS +short

# Route 53のネームサーバーが表示されない場合
# → お名前.comの設定を再確認
# → 24-48時間待つ
```

### 問題3: CloudFrontで503エラー

**原因:** CloudFrontの配信が完了していない

**解決:**

```bash
# ステータス確認
aws cloudformation describe-stacks \
  --stack-name Prance-dev-Storage \
  --query 'Stacks[0].StackStatus'

# "CREATE_COMPLETE" になるまで待つ（約5分）
```

---

## 📊 デプロイ状況の確認

```bash
# すべてのスタックの状態を確認
npm run status

# 特定のスタックの詳細を確認
aws cloudformation describe-stack-events \
  --stack-name Prance-dev-Certificate \
  --max-items 10
```

---

## 🔄 他の環境へのデプロイ

### ステージング環境

```bash
npm run deploy:staging
```

**URL:** `https://staging.app.prance.jp`

### 本番環境

```bash
npm run deploy:production
```

**URL:** `https://platform.prance.jp`

---

## ✅ チェックリスト

### 事前準備

- [ ] AWS CLI インストール済み
- [ ] AWS認証設定済み (`aws configure`)
- [ ] お名前.comアカウントにログイン可能

### Route 53 設定

- [ ] ホストゾーン作成完了
- [ ] ネームサーバー4つ取得済み
- [ ] お名前.comでネームサーバー変更完了
- [ ] DNS変更の浸透確認（`dig NS prance.jp +short`）

### デプロイ

- [ ] 開発環境デプロイ完了
- [ ] SSL証明書が ISSUED ステータス
- [ ] CloudFrontが CREATE_COMPLETE
- [ ] `https://dev.app.prance.jp` にアクセス可能

---

## 📞 サポート

問題が解決しない場合は、以下を確認してください：

1. [詳細ガイド](DOMAIN_SETUP.md) を参照
2. [AWSサポート](https://console.aws.amazon.com/support/)
3. [お名前.comサポート](https://www.onamae.com/support/)

---

**所要時間:** 約10分（DNS浸透時間を除く）
**難易度:** ⭐⭐☆☆☆（中級）
