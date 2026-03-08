# サブドメイン委譲 クイックスタート

お名前.comのDNS変更を最小限（NSレコード4つのみ）に抑え、`platform.prance.co.jp`をRoute 53で管理する方法の実行手順です。

---

## ⚡ 実行手順（15分）

### ステップ1: Route 53 Hosted Zone作成（2分）

```bash
# platform.prance.co.jp 専用のHosted Zoneを作成
aws route53 create-hosted-zone \
  --name platform.prance.co.jp \
  --caller-reference "prance-platform-$(date +%s)" \
  --hosted-zone-config Comment="Prance Platform subdomain delegation"
```

**出力例:**

```json
{
  "HostedZone": {
    "Id": "/hostedzone/Z1234567890ABC",
    "Name": "platform.prance.co.jp.",
    ...
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

**重要:** 上記の4つのネームサーバーをメモしてください。

### ステップ2: ネームサーバー確認（1分）

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

**保存例:**

```
ns-123.awsdns-45.com
ns-678.awsdns-90.net
ns-1234.awsdns-56.org
ns-5678.awsdns-12.co.uk
```

### ステップ3: お名前.comでNSレコード追加（5分）

#### 3-1. お名前.com Naviにログイン

1. [お名前.com Navi](https://www.onamae.com/navi/login/) にアクセス
2. お名前ID とパスワードでログイン

#### 3-2. DNS設定画面に移動

1. トップページから「ドメイン設定」をクリック
2. 「DNS設定/転送設定」を選択
3. `prance.co.jp` の「内部設定」または「DNSレコード設定」をクリック

#### 3-3. NSレコードを追加

**設定内容:**

| ホスト名   | TYPE | VALUE                     | TTL  |
| ---------- | ---- | ------------------------- | ---- |
| `platform` | NS   | `ns-123.awsdns-45.com`    | 3600 |
| `platform` | NS   | `ns-678.awsdns-90.net`    | 3600 |
| `platform` | NS   | `ns-1234.awsdns-56.org`   | 3600 |
| `platform` | NS   | `ns-5678.awsdns-12.co.uk` | 3600 |

**重要な注意点:**

- ⚠️ ホスト名は `platform` のみ（`platform.prance.co.jp` ではない）
- ⚠️ VALUEの末尾に`.`（ドット）は不要（お名前.comが自動付与）
- ⚠️ 4つのネームサーバーをすべて追加する必要があります

#### 3-4. 設定を保存

1. 入力内容を確認
2. 「追加」または「確認画面へ進む」をクリック
3. 最終確認画面で「設定する」をクリック

### ステップ4: DNS委譲の検証（5分〜）

#### 4-1. NSレコードの確認（5分後）

```bash
# platform.prance.co.jp のネームサーバーを確認
dig NS platform.prance.co.jp +short
```

**期待される出力:**

```
ns-123.awsdns-45.com.
ns-678.awsdns-90.net.
ns-1234.awsdns-56.org.
ns-5678.awsdns-12.co.uk.
```

**結果が表示されない場合:**

- お名前.comの設定が正しいか再確認
- 5〜30分待ってから再度確認
- DNSキャッシュをクリア（後述）

#### 4-2. 権威サーバーの確認

```bash
# platform.prance.co.jp の権威サーバーに直接問い合わせ
dig @ns-123.awsdns-45.com platform.prance.co.jp SOA

# 応答があればOK（委譲成功）
```

#### 4-3. グローバルDNS浸透の確認

```bash
# 複数のDNSサーバーから確認
dig @8.8.8.8 NS platform.prance.co.jp +short        # Google DNS
dig @1.1.1.1 NS platform.prance.co.jp +short        # Cloudflare DNS
dig @208.67.222.222 NS platform.prance.co.jp +short # OpenDNS

# すべてでRoute 53のネームサーバーが返されればOK
```

### ステップ5: インフラデプロイ（5分）

#### 5-1. TypeScriptビルド

```bash
cd infrastructure
npm run build
```

#### 5-2. CDK Synth（確認）

```bash
npm run synth

# 9スタックが生成されることを確認
# ✅ Prance-dev-DNS
# ✅ Prance-dev-Certificate
# ✅ Prance-dev-Storage
# ...
```

#### 5-3. デプロイ実行

```bash
# 開発環境にデプロイ
npm run deploy:dev

# または個別デプロイ
cdk deploy Prance-dev-DNS --require-approval never
cdk deploy Prance-dev-Certificate --require-approval never
cdk deploy Prance-dev-Storage --require-approval never
```

**デプロイ時間:** 約5-10分

### ステップ6: 確認（2分）

#### 6-1. スタック出力確認

```bash
aws cloudformation describe-stacks \
  --stack-name Prance-dev-Storage \
  --query 'Stacks[0].Outputs' \
  --output table
```

**期待される出力:**

| OutputKey        | OutputValue                       | Description                |
| ---------------- | --------------------------------- | -------------------------- |
| ApplicationURL   | https://dev.platform.prance.co.jp | Application URL            |
| CustomDomainName | dev.platform.prance.co.jp         | Custom Domain Name         |
| CDNDomainName    | d1234567890.cloudfront.net        | CloudFront CDN Domain Name |

#### 6-2. DNSレコード確認

```bash
# Aレコードが作成されているか確認
dig dev.platform.prance.co.jp +short

# CloudFrontのIPアドレスが返されればOK
```

#### 6-3. HTTPS接続確認

```bash
# HTTPSで接続可能か確認
curl -I https://dev.platform.prance.co.jp

# 期待されるレスポンス:
# HTTP/2 200
# または HTTP/2 403（S3が空の場合は正常）
```

#### 6-4. SSL証明書確認

```bash
# SSL証明書の詳細を確認
openssl s_client -connect dev.platform.prance.co.jp:443 -servername dev.platform.prance.co.jp < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A 2 "Subject:"

# 証明書のSANs（Subject Alternative Names）を確認
openssl s_client -connect dev.platform.prance.co.jp:443 -servername dev.platform.prance.co.jp < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A 5 "Subject Alternative Name"
```

---

## ✅ 完了チェックリスト

### Phase 1: Route 53 Hosted Zone作成

- [ ] `aws route53 create-hosted-zone` 実行完了
- [ ] Hosted Zone IDを取得済み
- [ ] ネームサーバー4つをメモ済み

### Phase 2: お名前.com設定

- [ ] お名前.com Naviにログイン成功
- [ ] NSレコード4つすべて追加完了
- [ ] 設定内容を確認・保存完了

### Phase 3: DNS検証

- [ ] `dig NS platform.prance.co.jp +short` でRoute 53のNSが表示される
- [ ] 権威サーバーへの直接問い合わせが成功
- [ ] 複数のパブリックDNSから同じNSが返される

### Phase 4: CDKコード更新

- [ ] `config.ts` 更新完了（`PLATFORM_DOMAIN` 追加）
- [ ] `dns-stack.ts` 更新完了（`config.domain.platform` 使用）
- [ ] TypeScriptビルド成功（エラーなし）
- [ ] CDK Synth成功（9スタック生成）

### Phase 5: デプロイ

- [ ] 開発環境デプロイ成功
- [ ] CloudFormationスタックが `CREATE_COMPLETE`
- [ ] `dig dev.platform.prance.co.jp` でIPアドレス取得
- [ ] HTTPS接続成功（`curl -I` でHTTP/2レスポンス）
- [ ] SSL証明書が有効

---

## 🚨 トラブルシューティング

### 問題1: NSレコードが反映されない

**症状:**

```bash
dig NS platform.prance.co.jp +short
# 何も表示されない
```

**対策:**

1. **お名前.comの設定確認**
   - ホスト名が `platform` になっているか（`platform.prance.co.jp` ではない）
   - NSレコードが4つすべて登録されているか
   - TTLが設定されているか（3600推奨）

2. **DNSキャッシュクリア**

   ```bash
   # macOS
   sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder

   # Linux
   sudo systemd-resolve --flush-caches

   # Windows
   ipconfig /flushdns
   ```

3. **権威サーバーで直接確認**

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

**対策:**

```bash
# Hosted Zoneの存在確認
aws route53 list-hosted-zones-by-name --dns-name platform.prance.co.jp

# 存在しない場合はステップ1を実行
aws route53 create-hosted-zone \
  --name platform.prance.co.jp \
  --caller-reference "prance-platform-$(date +%s)"
```

### 問題3: SSL証明書の検証が完了しない

**症状:**

```
Certificate status: PENDING_VALIDATION
```

**対策:**

1. **DNS委譲の確認**

   ```bash
   dig NS platform.prance.co.jp +short
   # Route 53のNSが表示されるか確認
   ```

2. **待機時間**
   - DNS委譲が浸透してから証明書検証が開始される
   - 通常5〜30分で検証完了
   - 最大48時間（DNS浸透が遅い場合）

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

   # "Deployed" になるまで待つ（約5-10分）
   ```

2. **一時的な403は正常**
   - S3バケットが空の場合は403エラーが返る
   - アプリケーションをデプロイ後に解消される

---

## 🔄 次のステップ

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
  `api.${config.domain.fullDomain}`, // api.dev.platform.prance.co.jp
  `ws.${config.domain.fullDomain}`, // ws.dev.platform.prance.co.jp
];
```

---

## 📊 推定時間

| フェーズ              | 推定時間 | 累計    |
| --------------------- | -------- | ------- |
| 1. Hosted Zone作成    | 2分      | 2分     |
| 2. ネームサーバー確認 | 1分      | 3分     |
| 3. お名前.com設定     | 5分      | 8分     |
| 4. DNS検証（最低）    | 5分      | 13分    |
| 5. デプロイ           | 5-10分   | 18-23分 |
| 6. 確認               | 2分      | 20-25分 |

**合計: 約15-25分**（DNS浸透が速い場合）

**注意:** DNS浸透に時間がかかる場合は最大48時間かかることがあります。

---

## 📚 関連ドキュメント

- **設計ドキュメント:** [DNS_DESIGN_SUBDOMAIN_DELEGATION.md](DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- **実装ガイド:** [DNS_IMPLEMENTATION_SUBDOMAIN.md](DNS_IMPLEMENTATION_SUBDOMAIN.md)
- **詳細セットアップ:** [DOMAIN_SETUP.md](DOMAIN_SETUP.md)

---

**作成日:** 2026-03-04
**実装方式:** サブドメイン委譲（platform.prance.co.jp）
**お名前.com変更:** NSレコード4つのみ
