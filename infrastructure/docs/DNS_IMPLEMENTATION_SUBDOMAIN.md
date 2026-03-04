# サブドメイン委譲方式 実装ガイド

**目的:** お名前.comのDNS変更を最小限（NSレコード追加のみ）に抑え、Route 53でPranceプラットフォームのDNSを管理する

**方式:** サブドメイン委譲（`platform.prance.co.jp`のみRoute 53に委譲）

---

## 📋 概要

### 実装方式

```
お名前.com DNS
└── prance.co.jp (ルートドメイン)
    ├── [既存のDNSレコード] ← 影響なし
    └── platform.prance.co.jp (NSレコード) ← Route 53に委譲

Route 53
└── platform.prance.co.jp (Hosted Zone)
    ├── dev.platform.prance.co.jp (A Record → CloudFront)
    ├── staging.platform.prance.co.jp (A Record → CloudFront)
    └── platform.prance.co.jp (A Record → CloudFront)
```

### メリット

✅ お名前.comでの変更が最小限（NSレコード4つのみ追加）
✅ 既存サービス（メール、他のサブドメイン）に影響なし
✅ Route 53のフル機能を活用可能
✅ ロールバックが容易（NSレコード削除のみ）

---

## 🛠️ 実装手順

### Phase 1: Route 53 Hosted Zone作成

#### 1-1. Hosted Zone作成

```bash
# platform.prance.co.jp 専用のホストゾーンを作成
aws route53 create-hosted-zone \
  --name platform.prance.co.jp \
  --caller-reference "prance-platform-$(date +%s)" \
  --hosted-zone-config Comment="Prance Platform subdomain delegation"
```

**期待される出力:**

```json
{
  "HostedZone": {
    "Id": "/hostedzone/Z1234567890ABC",
    "Name": "platform.prance.co.jp.",
    "CallerReference": "prance-platform-1234567890",
    "Config": {
      "Comment": "Prance Platform subdomain delegation",
      "PrivateZone": false
    },
    "ResourceRecordSetCount": 2
  },
  "DelegationSet": {
    "NameServers": [
      "ns-123.awsdns-45.com",
      "ns-678.awsdns-90.net",
      "ns-1234.awsdns-56.org",
      "ns-5678.awsdns-12.co.uk"
    ]
  }
}
```

#### 1-2. Hosted Zone IDとネームサーバーを確認・保存

```bash
# Hosted Zone IDを取得
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name platform.prance.co.jp \
  --query 'HostedZones[0].Id' \
  --output text)

echo "Hosted Zone ID: $HOSTED_ZONE_ID"

# ネームサーバーを取得
aws route53 get-hosted-zone \
  --id "$HOSTED_ZONE_ID" \
  --query 'DelegationSet.NameServers' \
  --output table
```

**重要:** この4つのネームサーバーをメモしてください。次のステップで使用します。

**保存例:**
```
ns-123.awsdns-45.com
ns-678.awsdns-90.net
ns-1234.awsdns-56.org
ns-5678.awsdns-12.co.uk
```

---

### Phase 2: お名前.comでNSレコード追加

#### 2-1. お名前.com Naviにログイン

1. [お名前.com Navi](https://www.onamae.com/navi/login/) にアクセス
2. お名前ID とパスワードでログイン

#### 2-2. DNS設定画面に移動

1. トップページから「ドメイン設定」をクリック
2. 「DNS設定/転送設定」を選択
3. `prance.co.jp` の「内部設定」または「DNSレコード設定」をクリック

#### 2-3. NSレコードを追加

**設定内容:**

| ホスト名 | TYPE | VALUE | TTL |
|---------|------|-------|-----|
| `platform` | NS | `ns-123.awsdns-45.com` | 3600 |
| `platform` | NS | `ns-678.awsdns-90.net` | 3600 |
| `platform` | NS | `ns-1234.awsdns-56.org` | 3600 |
| `platform` | NS | `ns-5678.awsdns-12.co.uk` | 3600 |

**入力方法:**

- **ホスト名:** `platform`（フルドメインではなく、サブドメイン部分のみ）
- **TYPE:** `NS`（ドロップダウンから選択）
- **VALUE:** Route 53から取得したネームサーバー（1つずつ追加）
- **TTL:** `3600`（1時間、デフォルトでOK）

**注意事項:**
- ⚠️ 4つのネームサーバーをすべて追加する必要があります
- ⚠️ ホスト名は `platform` のみ（`platform.prance.co.jp` ではない）
- ⚠️ VALUEの末尾に`.`（ドット）は不要（お名前.comが自動付与）

#### 2-4. 設定を確認して保存

1. 入力内容を確認
2. 「追加」または「確認画面へ進む」をクリック
3. 最終確認画面で「設定する」をクリック

---

### Phase 3: DNS委譲の検証

#### 3-1. NSレコードの確認（5分後）

```bash
# platform.prance.co.jp のネームサーバーを確認
dig NS platform.prance.co.jp +short

# 期待される出力: Route 53のネームサーバー4つ
# ns-123.awsdns-45.com
# ns-678.awsdns-90.net
# ns-1234.awsdns-56.org
# ns-5678.awsdns-12.co.uk
```

**結果が表示されない場合:**
- お名前.comの設定が正しいか再確認
- 5〜30分待ってから再度確認
- DNSキャッシュをクリア（後述）

#### 3-2. 権威サーバーの確認

```bash
# platform.prance.co.jp の権威サーバーに直接問い合わせ
dig @ns-123.awsdns-45.com platform.prance.co.jp SOA

# 応答があればOK（委譲成功）
```

#### 3-3. グローバルDNS浸透の確認

```bash
# 複数のDNSサーバーから確認
dig @8.8.8.8 NS platform.prance.co.jp +short        # Google DNS
dig @1.1.1.1 NS platform.prance.co.jp +short        # Cloudflare DNS
dig @208.67.222.222 NS platform.prance.co.jp +short # OpenDNS

# すべてでRoute 53のネームサーバーが返されればOK
```

---

### Phase 4: CDKコードの更新

#### 4-1. 設定ファイルの更新

`infrastructure/lib/config.ts` を以下のように更新:

```typescript
// サブドメイン委譲用のドメイン定義
export const ROOT_DOMAIN = 'prance.co.jp';           // お名前.comで管理
export const PLATFORM_DOMAIN = 'platform.prance.co.jp'; // Route 53で管理

export interface EnvironmentConfig {
  environment: string;
  domain: {
    root: string;              // prance.co.jp
    platform: string;          // platform.prance.co.jp ← 新規追加
    subdomain: string;         // dev / staging / (empty for prod)
    fullDomain: string;        // dev.platform.prance.co.jp
  };
  // ... 他のフィールド
}

export const getConfig = (environment: string): EnvironmentConfig => {
  const baseConfig = {
    root: ROOT_DOMAIN,
    platform: PLATFORM_DOMAIN, // ← 新規追加
  };

  switch (environment) {
    case 'development':
    case 'dev':
      return {
        environment: 'dev',
        domain: {
          ...baseConfig,
          subdomain: 'dev',
          fullDomain: `dev.${PLATFORM_DOMAIN}`,
        },
        // ... 他の設定
      };
    case 'staging':
      return {
        environment: 'staging',
        domain: {
          ...baseConfig,
          subdomain: 'staging',
          fullDomain: `staging.${PLATFORM_DOMAIN}`,
        },
        // ... 他の設定
      };
    case 'production':
    case 'prod':
      return {
        environment: 'production',
        domain: {
          ...baseConfig,
          subdomain: '',
          fullDomain: PLATFORM_DOMAIN,
        },
        // ... 他の設定
      };
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
};
```

#### 4-2. DNS Stackの更新

`infrastructure/lib/dns-stack.ts` を更新:

```typescript
export class DnsStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const { config } = props;

    // platform.prance.co.jp のHosted Zoneを参照
    // 初回はPhase 1で手動作成したものを参照
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: config.domain.platform, // ← platform.prance.co.jp を参照
    });

    // 環境情報を出力
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route 53 Hosted Zone ID (platform.prance.co.jp)',
      exportName: `${id}-HostedZoneId`,
    });

    new cdk.CfnOutput(this, 'HostedZoneName', {
      value: this.hostedZone.zoneName,
      description: 'Route 53 Hosted Zone Name',
      exportName: `${id}-HostedZoneName`,
    });

    new cdk.CfnOutput(this, 'ApplicationDomain', {
      value: config.domain.fullDomain,
      description: 'Application Domain',
      exportName: `${id}-ApplicationDomain`,
    });
  }
}
```

---

### Phase 5: デプロイ

#### 5-1. 開発環境デプロイ

```bash
cd infrastructure

# TypeScriptビルド
npm run build

# CDK Synth（確認）
npm run synth

# デプロイ
npm run deploy:dev
```

**デプロイされるスタック:**
1. `Prance-dev-DNS` - platform.prance.co.jp の参照
2. `Prance-dev-Certificate` - SSL証明書（us-east-1）
3. `Prance-dev-Storage` - CloudFront + カスタムドメイン

#### 5-2. デプロイ確認

```bash
# スタック出力を確認
aws cloudformation describe-stacks \
  --stack-name Prance-dev-Storage \
  --query 'Stacks[0].Outputs' \
  --output table
```

**期待される出力:**

| OutputKey | OutputValue | Description |
|-----------|-------------|-------------|
| ApplicationURL | https://dev.platform.prance.co.jp | Application URL |
| CustomDomainName | dev.platform.prance.co.jp | Custom Domain Name |
| CDNDomainName | d1234567890.cloudfront.net | CloudFront CDN Domain Name |

#### 5-3. DNSレコード確認

```bash
# Aレコードが作成されているか確認
dig dev.platform.prance.co.jp +short

# CloudFrontのIPアドレスが返されればOK
```

#### 5-4. HTTPS接続確認

```bash
# HTTPSで接続可能か確認
curl -I https://dev.platform.prance.co.jp

# 期待されるレスポンス:
# HTTP/2 200
# または HTTP/2 403（S3が空の場合）
```

#### 5-5. SSL証明書確認

```bash
# SSL証明書の詳細を確認
openssl s_client -connect dev.platform.prance.co.jp:443 -servername dev.platform.prance.co.jp < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A 2 "Subject:"

# 証明書のSANs（Subject Alternative Names）を確認
openssl s_client -connect dev.platform.prance.co.jp:443 -servername dev.platform.prance.co.jp < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A 5 "Subject Alternative Name"
```

---

## ✅ 検証チェックリスト

### Phase 1完了確認
- [ ] Route 53 Hosted Zone作成完了（`platform.prance.co.jp`）
- [ ] Hosted Zone IDを取得済み
- [ ] ネームサーバー4つを記録済み

### Phase 2完了確認
- [ ] お名前.com Naviにログイン成功
- [ ] NSレコード4つすべて追加完了
- [ ] 設定内容を確認・保存完了

### Phase 3完了確認
- [ ] `dig NS platform.prance.co.jp +short` でRoute 53のNSが表示される
- [ ] 権威サーバーへの直接問い合わせが成功
- [ ] 複数のパブリックDNSから同じNSが返される

### Phase 4完了確認
- [ ] `config.ts` 更新完了（`PLATFORM_DOMAIN` 追加）
- [ ] `dns-stack.ts` 更新完了（`config.domain.platform` 使用）
- [ ] TypeScriptビルド成功（エラーなし）
- [ ] CDK Synth成功（9スタック生成）

### Phase 5完了確認
- [ ] 開発環境デプロイ成功
- [ ] CloudFormationスタックが `CREATE_COMPLETE`
- [ ] `dig dev.platform.prance.co.jp` でIPアドレス取得
- [ ] HTTPS接続成功（`curl -I` でHTTP/2レスポンス）
- [ ] SSL証明書が有効

---

## 🔧 トラブルシューティング

### 問題1: NSレコードが反映されない

**症状:**
```bash
dig NS platform.prance.co.jp +short
# 何も表示されない、またはお名前.comのNSが表示される
```

**原因と対策:**

1. **設定直後（5分以内）**
   - 対策: 5〜10分待ってから再度確認

2. **DNSキャッシュ**
   ```bash
   # macOS
   sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder

   # Linux
   sudo systemd-resolve --flush-caches

   # Windows
   ipconfig /flushdns
   ```

3. **お名前.comの設定ミス**
   - ホスト名が `platform` になっているか確認（`platform.prance.co.jp` ではない）
   - NSレコードが4つすべて登録されているか確認
   - TTLが設定されているか確認（3600推奨）

4. **権威サーバーで直接確認**
   ```bash
   # お名前.comの権威サーバーに直接問い合わせ
   dig @dns1.onamae.com NS platform.prance.co.jp +short

   # NSレコードが返されればお名前.com側の設定はOK
   ```

### 問題2: CDKデプロイ時に「HostedZone not found」

**症状:**
```
Error: Cannot retrieve value from context provider hosted-zone since account/region are not specified
```

**原因:** Phase 1のHosted Zone作成がまだ完了していない

**対策:**
```bash
# Hosted Zoneの存在確認
aws route53 list-hosted-zones-by-name --dns-name platform.prance.co.jp

# 存在しない場合はPhase 1を実行
aws route53 create-hosted-zone \
  --name platform.prance.co.jp \
  --caller-reference "prance-platform-$(date +%s)"
```

### 問題3: SSL証明書が検証されない

**症状:**
```
Certificate status: PENDING_VALIDATION
```

**原因:** DNS委譲が完全に浸透していない

**対策:**

1. **DNS委譲の確認**
   ```bash
   dig NS platform.prance.co.jp +short
   # Route 53のNSが表示されるか確認
   ```

2. **ACM検証レコードの確認**
   ```bash
   # ACM証明書のステータス確認
   aws acm describe-certificate \
     --certificate-arn YOUR_CERTIFICATE_ARN \
     --region us-east-1
   ```

3. **待機時間**
   - 通常5〜30分で検証完了
   - DNS委譲が浸透していない場合は最大48時間

### 問題4: CloudFrontで403エラー

**症状:**
```bash
curl -I https://dev.platform.prance.co.jp
HTTP/2 403
```

**原因:** S3バケットが空、またはCloudFrontの配信設定が完了していない

**対策:**

1. **CloudFrontのステータス確認**
   ```bash
   aws cloudfront get-distribution \
     --id YOUR_DISTRIBUTION_ID \
     --query 'Distribution.Status'

   # "Deployed" になるまで待つ（5〜10分）
   ```

2. **一時的な403は正常**
   - S3バケットが空の場合は403エラーが返る
   - アプリケーションをデプロイ後に解消される

### 問題5: DNSの浸透が遅い

**症状:** 数時間経ってもDNSが更新されない

**対策:**

1. **グローバルDNS確認**
   ```bash
   # 複数のDNSサーバーで確認
   for DNS in 8.8.8.8 1.1.1.1 208.67.222.222; do
     echo "Checking $DNS:"
     dig @$DNS NS platform.prance.co.jp +short
   done
   ```

2. **TTL待機**
   - 既存のTTL値だけ待つ必要がある
   - デフォルトは3600秒（1時間）

3. **お名前.comサポート確認**
   - 設定が正しいか再確認
   - [お名前.comサポート](https://www.onamae.com/support/)に問い合わせ

---

## 🔄 ロールバック手順

何か問題が発生した場合、以下の手順で元に戻すことができます。

### ステップ1: お名前.comでNSレコード削除

1. [お名前.com Navi](https://www.onamae.com/navi/login/) にログイン
2. 「ドメイン設定」→「DNS設定/転送設定」
3. `prance.co.jp` の「DNSレコード設定」を開く
4. `platform` のNSレコード4つを削除
5. 設定を保存

### ステップ2: CloudFormationスタック削除

```bash
# 逆順で削除（依存関係に注意）
aws cloudformation delete-stack --stack-name Prance-dev-Lambda
aws cloudformation delete-stack --stack-name Prance-dev-ApiGateway
aws cloudformation delete-stack --stack-name Prance-dev-DynamoDB
aws cloudformation delete-stack --stack-name Prance-dev-Database
aws cloudformation delete-stack --stack-name Prance-dev-Cognito
aws cloudformation delete-stack --stack-name Prance-dev-Network
aws cloudformation delete-stack --stack-name Prance-dev-Storage
aws cloudformation delete-stack --stack-name Prance-dev-Certificate
aws cloudformation delete-stack --stack-name Prance-dev-DNS

# 削除完了まで待機（約10分）
```

### ステップ3: Route 53 Hosted Zone削除

```bash
# Hosted Zone IDを取得
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name platform.prance.co.jp \
  --query 'HostedZones[0].Id' \
  --output text)

# Hosted Zoneを削除
aws route53 delete-hosted-zone --id "$HOSTED_ZONE_ID"
```

### ステップ4: 確認

```bash
# NSレコードが削除されたか確認
dig NS platform.prance.co.jp +short
# 何も表示されなければロールバック成功
```

---

## 📊 コスト分析

### Route 53コスト

| 項目 | 単価 | 数量 | 月額 |
|-----|------|------|------|
| Hosted Zone | $0.50/zone | 1 | $0.50 |
| Standard クエリ | $0.40/100万クエリ | 少量 | $0.10〜0.50 |
| **合計** | - | - | **$0.60〜1.00** |

### その他のコスト（変更なし）

- ACM証明書: **$0（無料）**
- CloudFront: 既存のまま
- S3: 既存のまま

**総追加コスト: 約$1/月**

---

## 🎯 次のステップ

### 1. ステージング・本番環境デプロイ

```bash
# ステージング
npm run deploy:staging

# 本番
npm run deploy:production
```

### 2. アプリケーションの環境変数更新

`apps/web/.env.local`:
```env
NEXT_PUBLIC_APP_URL=https://dev.platform.prance.co.jp
NEXT_PUBLIC_API_URL=https://api.dev.platform.prance.co.jp
NEXT_PUBLIC_WS_URL=wss://ws.dev.platform.prance.co.jp
```

### 3. API Gateway カスタムドメイン設定

将来的に `api.dev.platform.prance.co.jp` を追加する場合:

```typescript
// certificate-stack.ts で既に設定済み
subjectAlternativeNames: [
  `api.${config.domain.fullDomain}`,  // api.dev.platform.prance.co.jp
  `ws.${config.domain.fullDomain}`,   // ws.dev.platform.prance.co.jp
]
```

### 4. モニタリング設定

```bash
# Route 53クエリログの有効化（オプション）
aws route53 create-query-logging-config \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --cloud-watch-logs-log-group-arn "arn:aws:logs:us-east-1:ACCOUNT_ID:log-group:/aws/route53/platform.prance.co.jp"
```

---

## 📚 関連ドキュメント

- [DNS設計ドキュメント](DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- [詳細セットアップガイド](DOMAIN_SETUP.md)
- [クイックスタートガイド](QUICKSTART_DOMAIN.md)
- [プロジェクトサマリー](../../DOMAIN_SETUP_SUMMARY.md)

---

**作成日:** 2026-03-04
**最終更新:** 2026-03-04
**バージョン:** 1.0.0
**実装方式:** サブドメイン委譲（platform.prance.co.jp）
