# ドメイン設定ガイド

お名前.comで取得したドメイン `prance.jp` を使用して、Pranceプラットフォームにカスタムドメインを設定します。

## 📋 ドメイン構成

| 環境             | ドメイン                        | 説明             |
| ---------------- | ------------------------------- | ---------------- |
| **開発**         | `dev.app.prance.jp`     | 開発環境         |
| **ステージング** | `staging.app.prance.jp` | ステージング環境 |
| **本番**         | `platform.prance.jp`         | 本番環境         |

**補足:**

- ルートドメイン: `prance.jp`（お名前.comで管理）
- すべての環境が同じRoute 53ホストゾーンを共有
- 各環境ごとに個別のSSL証明書を発行

---

## 🚀 初回セットアップ（1回のみ）

### ステップ1: Route 53 ホストゾーンの作成

```bash
cd infrastructure

# AWS CLIでホストゾーン作成
aws route53 create-hosted-zone \
  --name prance.jp \
  --caller-reference "prance-$(date +%s)"
```

**または AWS Console で作成:**

1. [Route 53 Console](https://console.aws.amazon.com/route53) を開く
2. 「ホストゾーンの作成」をクリック
3. ドメイン名: `prance.jp` を入力
4. タイプ: 「パブリックホストゾーン」を選択
5. 作成ボタンをクリック

### ステップ2: ネームサーバーの確認

ホストゾーン作成後、4つのネームサーバーが割り当てられます:

```
例:
ns-123.awsdns-45.com
ns-678.awsdns-90.net
ns-1234.awsdns-56.org
ns-5678.awsdns-12.co.uk
```

**確認方法（AWS CLI）:**

```bash
aws route53 get-hosted-zone --id /hostedzone/YOUR_HOSTED_ZONE_ID
```

### ステップ3: お名前.comでネームサーバーを変更

1. [お名前.com Navi](https://www.onamae.com/navi/login/) にログイン
2. 「ドメイン設定」→「ネームサーバーの設定」をクリック
3. `prance.jp` を選択
4. 「他のネームサーバーを利用」を選択
5. Route 53から取得した4つのネームサーバーを入力:
   ```
   プライマリネームサーバー: ns-123.awsdns-45.com
   セカンダリネームサーバー: ns-678.awsdns-90.net
   （3つ目）: ns-1234.awsdns-56.org
   （4つ目）: ns-5678.awsdns-12.co.uk
   ```
6. 「確認画面へ進む」→「設定する」をクリック

**⚠️ 注意:**

- ネームサーバー変更の反映には **24-48時間** かかる場合があります
- 変更が反映されるまで、既存のDNS設定が継続して使用されます

### ステップ4: ネームサーバー変更の確認

```bash
# DNSが浸透したか確認（数分〜48時間後）
dig NS prance.jp +short

# 期待される出力: Route 53のネームサーバーが表示される
# ns-123.awsdns-45.com.
# ns-678.awsdns-90.net.
# ns-1234.awsdns-56.org.
# ns-5678.awsdns-12.co.uk.
```

---

## 🏗️ 環境別デプロイ

### 開発環境 (dev.app.prance.jp)

```bash
cd infrastructure

# デプロイ（ネームサーバー変更後）
npm run deploy:dev
```

**デプロイされるスタック:**

1. `Prance-dev-DNS` - Route 53ホストゾーン参照
2. `Prance-dev-Certificate` - SSL証明書発行（us-east-1）
3. `Prance-dev-Storage` - CloudFront + カスタムドメイン設定
4. その他のスタック（Network, Cognito, Database等）

**デプロイ完了後の確認:**

```bash
# 証明書のステータス確認
aws acm list-certificates --region us-east-1

# CloudFrontディストリビューション確認
aws cloudformation describe-stacks \
  --stack-name Prance-dev-Storage \
  --query 'Stacks[0].Outputs'
```

**アクセステスト:**

```bash
# DNS解決確認
dig dev.app.prance.jp +short

# HTTPS接続確認
curl -I https://dev.app.prance.jp
```

### ステージング環境 (staging.app.prance.jp)

```bash
npm run deploy:staging
```

### 本番環境 (platform.prance.jp)

```bash
npm run deploy:production
```

**⚠️ 本番環境の注意事項:**

- デプロイ前に必ずステージング環境でテストしてください
- 削除保護が有効化されます（データ保持）
- バックアップ保持期間が7日間に設定されます

---

## 🔍 トラブルシューティング

### 1. SSL証明書の検証が完了しない

**原因:** DNS変更が浸透していない

**解決方法:**

```bash
# DNSの浸透を確認
dig prance.jp NS +short

# Route 53のネームサーバーが表示されればOK
# 表示されない場合は、お名前.comの設定を再確認
```

**手動検証:**

1. [ACM Console](https://console.aws.amazon.com/acm/home?region=us-east-1) を開く
2. 証明書のステータスが「検証保留中」の場合
3. 「CNAME レコードを Route 53 に作成」ボタンをクリック（自動追加）

### 2. CloudFrontで「無効な証明書」エラー

**原因:** 証明書がus-east-1リージョンにない

**解決方法:**

```bash
# 証明書がus-east-1に存在するか確認
aws acm list-certificates --region us-east-1

# 存在しない場合は、Certificate Stackを再デプロイ
npm run cdk -- deploy Prance-dev-Certificate --context environment=dev
```

### 3. 「HostedZone not found」エラー

**原因:** Route 53ホストゾーンが作成されていない

**解決方法:**

```bash
# ホストゾーンを手動作成
aws route53 create-hosted-zone \
  --name prance.jp \
  --caller-reference "prance-$(date +%s)"

# 再デプロイ
npm run deploy:dev
```

### 4. DNSの変更が反映されない

**確認手順:**

```bash
# 1. お名前.comのネームサーバー設定を確認
# お名前.com Navi → ドメイン設定 → ネームサーバーの設定

# 2. 現在のネームサーバーを確認
dig NS prance.jp +short

# 3. Route 53の設定を確認
aws route53 list-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID
```

**DNS キャッシュをクリア:**

```bash
# macOS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Windows
ipconfig /flushdns

# Linux
sudo systemd-resolve --flush-caches
```

### 5. CloudFrontの配信が遅い

**原因:** 初回デプロイ後、CloudFrontの配信が全世界に伝播するまで15-30分かかります

**確認方法:**

```bash
# CloudFrontディストリビューションのステータス確認
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID \
  --query 'Distribution.Status'

# "Deployed" と表示されれば完了
```

---

## 📊 デプロイ後の確認

### 各環境のURLにアクセス

```bash
# 開発環境
curl -I https://dev.app.prance.jp

# ステージング環境
curl -I https://staging.app.prance.jp

# 本番環境
curl -I https://platform.prance.jp
```

**期待されるレスポンス:**

```
HTTP/2 200
content-type: text/html
x-amz-cf-pop: NRT57-P1
x-cache: Miss from cloudfront
```

### SSL証明書の確認

```bash
# SSL証明書の詳細を確認
openssl s_client -connect dev.app.prance.jp:443 -servername dev.app.prance.jp < /dev/null | openssl x509 -text

# 有効期限を確認
echo | openssl s_client -connect dev.app.prance.jp:443 2>/dev/null | openssl x509 -noout -dates
```

### DNS レコードの確認

```bash
# Aレコード（IPv4）の確認
dig dev.app.prance.jp A +short

# AAAAレコード（IPv6）の確認
dig dev.app.prance.jp AAAA +short

# 詳細情報
dig dev.app.prance.jp ANY
```

---

## 🔐 セキュリティ

### SSL/TLS証明書

- **自動更新:** ACMが証明書を自動更新（有効期限の60日前）
- **暗号化:** TLS 1.2以上のみサポート
- **検証方法:** DNS検証（Route 53で自動設定）

### CORS設定

S3バケットのCORS設定を環境別ドメインに制限:

```typescript
// lib/storage-stack.ts で設定
allowedOrigins: [
  `https://${config.domain.fullDomain}`, // 環境別ドメイン
];
```

### CloudFront署名付きURL

機密ファイルへのアクセスは署名付きURLで制御（将来実装）:

```typescript
// 録画ファイルへの一時アクセス
const signedUrl = cloudfront.getSignedUrl({
  url: 'https://dev.app.prance.jp/recordings/session_123.mp4',
  dateLessThan: new Date(Date.now() + 3600 * 1000), // 1時間有効
});
```

---

## 📚 参考資料

### AWS公式ドキュメント

- [Route 53 入門](https://docs.aws.amazon.com/ja_jp/Route53/latest/DeveloperGuide/Welcome.html)
- [ACM ユーザーガイド](https://docs.aws.amazon.com/ja_jp/acm/latest/userguide/acm-overview.html)
- [CloudFront カスタムドメイン](https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html)

### お名前.com

- [ネームサーバー変更方法](https://www.onamae.com/guide/p/64)
- [DNS設定](https://www.onamae.com/guide/p/62)

---

## 🔄 メンテナンス

### 証明書の更新

ACMが自動更新するため、通常は操作不要です。

**手動確認:**

```bash
# 証明書のステータス確認
aws acm describe-certificate \
  --certificate-arn YOUR_CERTIFICATE_ARN \
  --region us-east-1
```

### ドメインの変更

ドメインを変更する場合:

1. `lib/config.ts` でドメイン設定を更新
2. 新しいホストゾーンを作成
3. お名前.comでネームサーバーを変更
4. 再デプロイ

### 環境の削除

```bash
# 開発環境を削除
npm run cdk -- destroy Prance-dev-* --context environment=dev

# 確認プロンプトで "y" を入力
```

**⚠️ 注意:**

- 本番環境は削除保護が有効化されているため、手動で無効化が必要
- S3バケット内のデータは `autoDeleteObjects` 設定に従って削除されます

---

## ✅ チェックリスト

### 初回セットアップ

- [ ] Route 53でホストゾーン作成
- [ ] ネームサーバーをメモ
- [ ] お名前.comでネームサーバー変更
- [ ] DNS変更の浸透を確認（24-48時間待機）
- [ ] 開発環境をデプロイ
- [ ] SSL証明書の検証完了を確認
- [ ] https://dev.app.prance.jp にアクセス確認

### 各環境デプロイ前

- [ ] AWS認証確認 (`aws sts get-caller-identity`)
- [ ] 正しい環境名を指定
- [ ] 本番環境の場合、ステージングでテスト済み
- [ ] バックアップ確認（本番のみ）

### デプロイ後

- [ ] CloudFormation スタックがすべて CREATE_COMPLETE
- [ ] SSL証明書が ISSUED ステータス
- [ ] DNSレコードが作成されている
- [ ] HTTPSでアクセス可能
- [ ] CloudFrontが正常に配信

---

**最終更新:** 2026-03-04
**バージョン:** 1.0.0
