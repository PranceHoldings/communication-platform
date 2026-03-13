# ドメイン設定サマリー

Pranceプラットフォームのカスタムドメイン設定が完了しました。

**重要更新（2026-03-04）:** サブドメイン委譲方式を採用し、お名前.comのDNS変更を最小限（NSレコード4つのみ）に抑える設計に変更しました。

## 🌐 環境別ドメイン

| 環境             | ドメイン                        | 用途         |
| ---------------- | ------------------------------- | ------------ |
| **開発**         | `dev.app.prance.jp`     | 開発・テスト |
| **ステージング** | `staging.app.prance.jp` | 本番前検証   |
| **本番**         | `app.prance.jp`         | 本番環境     |

**ルートドメイン:** `prance.jp`（お名前.comで管理）

---

## 🔧 DNS設計方式

### [サブドメイン委譲](docs/GLOSSARY.md#subdomain-delegation-サブドメイン委譲)方式（推奨） ★NEW

**概要:**

- [お名前.com](docs/GLOSSARY.md#お名前com)での変更を最小限（[NSレコード](docs/GLOSSARY.md#ns-record-ネームサーバーレコード)4つのみ）に抑える
- `app.prance.jp` のみを[Route 53](docs/GLOSSARY.md#route-53)に委譲
- ルートドメイン `prance.jp` はお名前.comで継続管理

**メリット:**

- ✅ お名前.comの変更が最小限（NSレコード4つのみ追加）
- ✅ 既存サービス（メール、他のサブドメイン）に影響なし
- ✅ Route 53のフル機能を活用可能
- ✅ ロールバックが容易（NSレコード削除のみ）
- ✅ コスト最適化（[Route 53 Hosted Zone](docs/GLOSSARY.md#hosted-zone) 1つのみ）

**DNS構造:**

```
お名前.com DNS
└── prance.jp (ルートドメイン)
    ├── [既存のDNSレコード] ← 影響なし
    └── platform (NSレコード) ← Route 53に委譲

Route 53
└── app.prance.jp (Hosted Zone)
    ├── dev.app.prance.jp (A Record → CloudFront)
    ├── staging.app.prance.jp (A Record → CloudFront)
    └── app.prance.jp (A Record → CloudFront)
```

**必要な作業:**

1. Route 53で `app.prance.jp` のHosted Zoneを作成
2. お名前.comで `platform` のNSレコードを4つ追加
3. インフラをデプロイ

**詳細:** [infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md](infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md)

---

## 📁 実装されたファイル

### 1. インフラコード

```
infrastructure/
├── lib/
│   ├── config.ts                    ★NEW - 環境別設定
│   ├── dns-stack.ts                 ★NEW - Route 53 DNS設定
│   ├── certificate-stack.ts         ★NEW - ACM SSL証明書
│   └── storage-stack.ts             ★UPDATED - CloudFront + カスタムドメイン
├── bin/
│   └── app.ts                       ★UPDATED - スタック統合
├── docs/
│   ├── DOMAIN_SETUP.md              ★NEW - 詳細設定ガイド
│   └── QUICKSTART_DOMAIN.md         ★NEW - クイックスタート
└── deploy.sh                        ★UPDATED - ドメイン確認追加
```

### 2. 設定ファイル

#### `lib/config.ts` - 環境別設定

```typescript
// 環境ごとのドメイン設定を一元管理
export const getConfig = (environment: string) => {
  // dev: dev.app.prance.jp
  // staging: staging.app.prance.jp
  // production: app.prance.jp
};
```

#### `lib/dns-stack.ts` - Route 53設定

- Route 53 Hosted Zoneの参照
- ネームサーバー情報の出力
- 環境別DNSレコード管理

#### `lib/certificate-stack.ts` - SSL証明書

- ACM証明書の自動発行（us-east-1）
- DNS検証（Route 53連携）
- ワイルドカード証明書対応

#### `lib/storage-stack.ts` - CloudFront統合

- カスタムドメインの設定
- SSL証明書の適用
- Route 53 Aliasレコード自動作成

---

## 🚀 デプロイ方法

### サブドメイン委譲方式（推奨） ★NEW

**クイックスタート:** [infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md](infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md)

```bash
# 1. Route 53 Hosted Zone作成（app.prance.jp）
aws route53 create-hosted-zone \
  --name app.prance.jp \
  --caller-reference "prance-platform-$(date +%s)"

# 2. ネームサーバー確認
aws route53 list-hosted-zones-by-name --dns-name app.prance.jp

# 3. お名前.comでNSレコード追加（4つ）
# ホスト名: platform
# TYPE: NS
# VALUE: Route 53のネームサーバー（4つ）

# 4. DNS委譲の検証（5分後）
dig NS app.prance.jp +short
```

### フルドメイン委譲方式（従来方式）

```bash
# 1. Route 53 ホストゾーン作成
aws route53 create-hosted-zone \
  --name prance.jp \
  --caller-reference "prance-$(date +%s)"

# 2. ネームサーバー確認
aws route53 list-hosted-zones-by-name --dns-name prance.jp

# 3. お名前.comでネームサーバー変更
# → お名前.com Navi でRoute 53のネームサーバーを設定

# 4. DNS変更の浸透を確認（5分〜48時間）
dig NS prance.jp +short
```

### 環境別デプロイ

```bash
cd infrastructure

# 開発環境
npm run deploy:dev

# ステージング環境
npm run deploy:staging

# 本番環境
npm run deploy:production
```

### デプロイされるスタック

1. **Prance-{env}-DNS** - Route 53設定
2. **Prance-{env}-Certificate** - SSL証明書（us-east-1）
3. **Prance-{env}-Storage** - CloudFront + カスタムドメイン
4. **Prance-{env}-Network** - VPC
5. **Prance-{env}-Cognito** - 認証
6. **Prance-{env}-Database** - Aurora
7. **Prance-{env}-DynamoDB** - DynamoDB
8. **Prance-{env}-ApiGateway** - API Gateway
9. **Prance-{env}-Lambda** - Lambda関数

---

## ✅ 設定確認

### DNS設定の確認

```bash
# ネームサーバー確認
dig NS prance.jp +short

# Aレコード確認
dig dev.app.prance.jp +short

# HTTPS接続確認
curl -I https://dev.app.prance.jp
```

### SSL証明書の確認

```bash
# 証明書一覧
aws acm list-certificates --region us-east-1

# 証明書詳細
aws acm describe-certificate \
  --certificate-arn YOUR_CERTIFICATE_ARN \
  --region us-east-1

# ブラウザで証明書確認
openssl s_client -connect dev.app.prance.jp:443 -servername dev.app.prance.jp
```

### CloudFront確認

```bash
# ディストリビューション一覧
aws cloudfront list-distributions \
  --query 'DistributionList.Items[*].[Id,DomainName,Status]' \
  --output table

# スタック出力確認
aws cloudformation describe-stacks \
  --stack-name Prance-dev-Storage \
  --query 'Stacks[0].Outputs'
```

---

## 🔐 セキュリティ

### SSL/TLS証明書

- **プロバイダー:** AWS Certificate Manager (ACM)
- **検証方法:** DNS検証（自動）
- **更新:** 自動更新（有効期限60日前）
- **プロトコル:** TLS 1.2, TLS 1.3
- **対応ドメイン:**
  - メインドメイン: `*.app.prance.jp`
  - API: `api.*.app.prance.jp`
  - WebSocket: `ws.*.app.prance.jp`

### CORS設定

環境別ドメインのみ許可:

```typescript
allowedOrigins: [
  'https://dev.app.prance.jp', // 開発
  'https://staging.app.prance.jp', // ステージング
  'https://app.prance.jp', // 本番
];
```

### CloudFront署名付きURL

機密ファイルへのアクセス制御（将来実装）:

- 録画ファイル: 1時間有効
- レポート: 7日間有効
- アバター: 公開アクセス可

---

## 📊 コスト

### 追加コスト（カスタムドメイン対応）

| サービス             | 月額コスト        | 備考                       |
| -------------------- | ----------------- | -------------------------- |
| Route 53 Hosted Zone | $0.50             | 1ゾーン                    |
| Route 53 クエリ      | $0.40/100万クエリ | 最初の10億クエリ           |
| ACM証明書            | $0                | 無料                       |
| CloudFront（追加分） | $0                | カスタムドメイン自体は無料 |
| **合計**             | **約$1〜2/月**    | 低トラフィック想定         |

**Note:** ドメイン取得費用（お名前.com）は別途。

---

## 🛠️ トラブルシューティング

### 「HostedZone not found」エラー

```bash
# ホストゾーン作成
aws route53 create-hosted-zone \
  --name prance.jp \
  --caller-reference "prance-$(date +%s)"
```

### SSL証明書が検証されない

```bash
# DNS変更の浸透を確認
dig prance.jp NS +short

# Route 53のネームサーバーが表示されない場合
# → お名前.comの設定を再確認
# → 24-48時間待つ
```

### CloudFrontで403/502エラー

```bash
# スタックのステータス確認
aws cloudformation describe-stacks \
  --stack-name Prance-dev-Storage \
  --query 'Stacks[0].StackStatus'

# CREATE_COMPLETEになるまで待つ（約5-10分）
```

### DNSキャッシュをクリア

```bash
# macOS
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder

# Windows
ipconfig /flushdns

# Linux
sudo systemd-resolve --flush-caches
```

---

## 📚 ドキュメント

### サブドメイン委譲方式（推奨） ★NEW

- **DNS設計:** [infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md](infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- **実装ガイド:** [infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md](infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md)
- **クイックスタート:** [infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md](infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md)

### フルドメイン委譲方式（従来）

- **詳細ガイド:** [infrastructure/docs/DOMAIN_SETUP.md](infrastructure/docs/DOMAIN_SETUP.md)
- **クイックスタート:** [infrastructure/docs/QUICKSTART_DOMAIN.md](infrastructure/docs/QUICKSTART_DOMAIN.md)

### 共通

- **インフラREADME:** [infrastructure/README.md](infrastructure/README.md)

---

## 🔄 次のステップ

1. ✅ ドメイン設定完了
2. ⏭️ Next.js (apps/web) の環境変数設定
   ```env
   NEXT_PUBLIC_APP_URL=https://dev.app.prance.jp
   NEXT_PUBLIC_API_URL=https://api.dev.app.prance.jp
   ```
3. ⏭️ API Gateway カスタムドメイン設定
4. ⏭️ Cognito カスタムUIドメイン設定

---

**作成日:** 2026-03-04
**最終更新:** 2026-03-04
**バージョン:** 2.0.0

---

## 📝 更新履歴

### Version 2.0.0 (2026-03-04)

- ✨ サブドメイン委譲方式を追加（お名前.comの変更を最小限に抑える）
- 📄 DNS設計ドキュメント作成 (DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- 📄 実装ガイド作成 (DNS_IMPLEMENTATION_SUBDOMAIN.md)
- 📄 クイックスタート作成 (QUICKSTART_SUBDOMAIN_DELEGATION.md)
- 🔧 CDKコード更新（config.ts, dns-stack.ts）
- 📊 推定時間: 15-25分（DNS浸透が速い場合）

### Version 1.0.0 (2026-03-04)

- 🎉 初版リリース
- 📄 基本的なドメイン設定ガイド作成
- 🏗️ インフラコード実装（CDK）
- 🌐 CloudFront + Route 53 + ACM統合
