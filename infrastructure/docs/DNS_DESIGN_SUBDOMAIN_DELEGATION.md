# DNS設計: [サブドメイン委譲](../../docs/GLOSSARY.md#subdomain-delegation-サブドメイン委譲)方式

[お名前.com](../../docs/GLOSSARY.md#お名前com)のDNS変更を最小限にするための設計ドキュメント

## 🎯 目標

- ✅ お名前.comでの変更は **1つの[NSレコード](../../docs/GLOSSARY.md#ns-record-ネームサーバーレコード)追加のみ**
- ✅ ルートドメイン `prance.co.jp` はお名前.comで管理継続
- ✅ メールやその他のサービスは影響なし
- ✅ `platform.prance.co.jp` 配下のみ[Route 53](../../docs/GLOSSARY.md#route-53)で管理

---

## 📊 設計比較

### 方式1: ルートドメイン完全委譲（従来方式）

```
お名前.com での設定:
  prance.co.jp → Route 53のネームサーバー4つに変更

影響範囲: 大
  - prance.co.jp のすべてのDNSレコードをRoute 53に移行する必要あり
  - メール設定（MXレコード）も移行必要
  - 既存のすべてのサブドメインも移行必要
```

**デメリット:**
- ❌ 既存のすべてのDNS設定を移行する必要がある
- ❌ メール設定（MXレコード）の移行リスク
- ❌ 既存サービスへの影響が大きい

### 方式2: サブドメイン委譲（推奨） ✅

```
お名前.com での設定:
  platform.prance.co.jp → Route 53のネームサーバー4つ（NSレコード追加のみ）

影響範囲: 最小
  - platform.prance.co.jp 配下のみRoute 53で管理
  - prance.co.jp のその他のレコードは変更不要
  - メール設定は影響なし
```

**メリット:**
- ✅ お名前.comでの変更は1つのNSレコード追加のみ
- ✅ 既存サービスへの影響ゼロ
- ✅ Route 53の機能を完全活用可能
- ✅ 将来的に他のサブドメインも追加容易

---

## 🏗️ アーキテクチャ設計

### DNSゾーン構成

```
┌─────────────────────────────────────────────────────────────┐
│ お名前.com DNS                                               │
│ ゾーン: prance.co.jp                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ @ (prance.co.jp)                                             │
│   A       → 既存のIPアドレス                                 │
│   MX      → メールサーバー設定                               │
│   TXT     → SPF, DMARC等                                     │
│                                                              │
│ www                                                          │
│   CNAME   → 既存の設定                                       │
│                                                              │
│ mail                                                         │
│   A       → メールサーバーIP                                 │
│                                                              │
│ platform  ★サブドメイン委譲（Route 53へ）                    │
│   NS      → ns-123.awsdns-45.com.                           │
│   NS      → ns-678.awsdns-90.net.                           │
│   NS      → ns-1234.awsdns-56.org.                          │
│   NS      → ns-5678.awsdns-12.co.uk.                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ 委譲
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Route 53                                                     │
│ ゾーン: platform.prance.co.jp                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ @ (platform.prance.co.jp)              ★本番環境             │
│   A       → CloudFront (Alias)                              │
│   AAAA    → CloudFront (Alias, IPv6)                        │
│                                                              │
│ dev                                    ★開発環境             │
│   A       → CloudFront (Alias)                              │
│   AAAA    → CloudFront (Alias, IPv6)                        │
│                                                              │
│ staging                                ★ステージング環境      │
│   A       → CloudFront (Alias)                              │
│   AAAA    → CloudFront (Alias, IPv6)                        │
│                                                              │
│ api (将来)                                                   │
│   A       → API Gateway (Alias)                             │
│                                                              │
│ ws (将来)                                                    │
│   A       → IoT Core Custom Domain                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### URL構造

```
管理場所: お名前.com
  https://prance.co.jp              → 既存サイト（影響なし）
  https://www.prance.co.jp          → 既存サイト（影響なし）
  mail.prance.co.jp                 → メールサーバー（影響なし）

管理場所: Route 53
  https://platform.prance.co.jp     → 本番環境（新規）
  https://dev.platform.prance.co.jp → 開発環境（新規）
  https://staging.platform.prance.co.jp → ステージング環境（新規）
```

---

## 🔍 技術的詳細

### 1. サブドメイン委譲の仕組み

```
ユーザー: https://dev.platform.prance.co.jp にアクセス
   │
   ▼
1. ルートDNSサーバーに問い合わせ
   "prance.co.jp のネームサーバーは？"
   → お名前.comのネームサーバーを返答
   │
   ▼
2. お名前.comのDNSサーバーに問い合わせ
   "dev.platform.prance.co.jp のIPアドレスは？"
   → "platform.prance.co.jp はRoute 53に委譲されています"
   → Route 53のネームサーバー4つを返答
   │
   ▼
3. Route 53のDNSサーバーに問い合わせ
   "dev.platform.prance.co.jp のIPアドレスは？"
   → CloudFrontのIPアドレスを返答
   │
   ▼
4. ユーザーがCloudFrontに接続
```

### 2. DNS伝播の流れ

```
お名前.comでNSレコード設定
   ↓
数分〜1時間で伝播開始
   ↓
グローバルDNSキャッシュが更新（最大48時間）
   ↓
完全に伝播完了

※ 通常は5-15分で利用可能になります
```

### 3. SSL証明書の検証

```
ACM証明書リクエスト
   ↓
DNS検証レコードをRoute 53に自動作成
   ↓
   _acme-challenge.dev.platform.prance.co.jp → CNAME
   ↓
ACMが検証完了（数分）
   ↓
証明書発行完了
```

**重要:** お名前.comでの追加作業は不要！
Route 53で自動的に検証レコードが作成されます。

---

## ✅ メリット・デメリット

### メリット

1. **最小限の変更**
   - お名前.comで追加するのはNSレコード1つのみ
   - 既存のDNS設定は一切変更不要

2. **影響範囲の限定**
   - `platform.prance.co.jp` 配下のみ影響
   - メール設定（MXレコード）は影響なし
   - 既存のサブドメインは影響なし

3. **Route 53の機能活用**
   - ACM証明書の自動DNS検証
   - ヘルスチェック・フェイルオーバー
   - エイリアスレコード（CloudFront統合）
   - トラフィックポリシー

4. **可逆性**
   - いつでもお名前.comに戻せる
   - NSレコードを削除するだけ

5. **拡張性**
   - 将来的に他のサブドメインも容易に追加
   - 環境の追加が簡単（test, qa等）

### デメリット

1. **管理場所の分散**
   - ルートドメイン: お名前.com
   - platformサブドメイン: Route 53
   - ⇒ ただし、通常運用では問題なし

2. **NSレコード追加が必要**
   - お名前.comで1回だけ設定作業が必要
   - ⇒ 約5分で完了

---

## 🛡️ リスク評価

### リスク1: お名前.comでのNSレコード設定ミス

**影響:** `platform.prance.co.jp` にアクセスできなくなる

**対策:**
- 設定前にRoute 53のネームサーバーを正確にメモ
- 設定後にdigコマンドで検証
- 本番環境デプロイ前に開発環境でテスト

**復旧方法:**
- NSレコードを削除すればすぐに元に戻る

### リスク2: DNS伝播の遅延

**影響:** 設定後すぐにアクセスできない可能性

**対策:**
- 営業時間外（深夜・週末）に設定
- 最大48時間の伝播時間を見込む
- TTL値を事前に短く設定（300秒）

**復旧方法:**
- 待つだけ（通常5-15分で解決）

### リスク3: SSL証明書の検証失敗

**影響:** HTTPS接続ができない

**対策:**
- DNS伝播完了後に証明書をリクエスト
- Route 53のホストゾーンが正しく設定されていることを確認

**復旧方法:**
- 証明書を再リクエスト（数分で完了）

---

## 🧪 検証計画

### フェーズ1: Route 53ホストゾーン作成（5分）

```bash
# 1. ホストゾーン作成
aws route53 create-hosted-zone \
  --name platform.prance.co.jp \
  --caller-reference "platform-$(date +%s)"

# 2. ネームサーバー確認
aws route53 list-hosted-zones-by-name \
  --dns-name platform.prance.co.jp

# 期待される出力:
# ns-123.awsdns-45.com
# ns-678.awsdns-90.net
# ns-1234.awsdns-56.org
# ns-5678.awsdns-12.co.uk
```

**検証:**
- ✅ ホストゾーンが作成された
- ✅ ネームサーバー4つが割り当てられた

### フェーズ2: お名前.comでNSレコード追加（5分）

```
お名前.com Navi にログイン
  ↓
ドメイン設定 → DNS設定
  ↓
prance.co.jp を選択
  ↓
DNSレコード設定を開く
  ↓
NSレコードを追加:
  ホスト名: platform
  TYPE: NS
  VALUE:
    ns-123.awsdns-45.com.
    ns-678.awsdns-90.net.
    ns-1234.awsdns-56.org.
    ns-5678.awsdns-12.co.uk.
  TTL: 3600
```

**検証:**
```bash
# NSレコードが設定されたか確認（5分後）
dig NS platform.prance.co.jp +short

# 期待される出力: Route 53のネームサーバー4つ
```

### フェーズ3: テストレコード追加（2分）

```bash
# Route 53にテストレコード追加
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "test.platform.prance.co.jp",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "192.0.2.1"}]
      }
    }]
  }'
```

**検証:**
```bash
# テストレコードが解決できるか確認
dig test.platform.prance.co.jp +short

# 期待される出力: 192.0.2.1
```

### フェーズ4: SSL証明書リクエスト（5分）

```bash
# ACM証明書リクエスト（DNS検証）
aws acm request-certificate \
  --domain-name platform.prance.co.jp \
  --subject-alternative-names \
    "*.platform.prance.co.jp" \
  --validation-method DNS \
  --region us-east-1
```

**検証:**
```bash
# 証明書のステータス確認
aws acm describe-certificate \
  --certificate-arn YOUR_CERTIFICATE_ARN \
  --region us-east-1

# 期待される出力: Status: ISSUED
```

### フェーズ5: CloudFrontデプロイ（10分）

```bash
# インフラをデプロイ
cd infrastructure
npm run deploy:dev
```

**検証:**
```bash
# HTTPS接続確認
curl -I https://dev.platform.prance.co.jp

# 期待される出力: HTTP/2 200
```

---

## 📊 検証結果の記録

### チェックリスト

#### Route 53設定
- [ ] ホストゾーン `platform.prance.co.jp` 作成完了
- [ ] ネームサーバー4つ取得完了
- [ ] ネームサーバーをメモ

#### お名前.com設定
- [ ] NSレコード追加完了
- [ ] TTL設定: 3600秒
- [ ] 設定保存完了

#### DNS伝播確認
- [ ] `dig NS platform.prance.co.jp +short` でRoute 53のNSが返答
- [ ] テストレコード解決確認
- [ ] グローバルDNSチェック: https://www.whatsmydns.net/

#### SSL証明書
- [ ] 証明書リクエスト完了
- [ ] DNS検証レコード自動作成確認
- [ ] 証明書ステータス: ISSUED

#### CloudFrontデプロイ
- [ ] スタックデプロイ完了: CREATE_COMPLETE
- [ ] カスタムドメイン設定確認
- [ ] HTTPS接続成功

#### エンドツーエンドテスト
- [ ] `https://dev.platform.prance.co.jp` アクセス成功
- [ ] SSL証明書有効
- [ ] CloudFront経由での配信確認

---

## 🔄 ロールバック手順

万が一問題が発生した場合:

### ステップ1: お名前.comでNSレコード削除

```
お名前.com Navi にログイン
  ↓
DNS設定
  ↓
platform のNSレコードを削除
  ↓
保存
```

**結果:** `platform.prance.co.jp` は即座に解決不可になりますが、
他のサブドメインやメールは影響なし。

### ステップ2: Route 53リソース削除（オプション）

```bash
# CloudFormationスタック削除
aws cloudformation delete-stack --stack-name Prance-dev-Storage
aws cloudformation delete-stack --stack-name Prance-dev-Certificate
aws cloudformation delete-stack --stack-name Prance-dev-DNS

# ホストゾーン削除
aws route53 delete-hosted-zone --id YOUR_HOSTED_ZONE_ID
```

---

## 💰 コスト影響

### Route 53 コスト

| 項目 | 月額コスト | 備考 |
|-----|-----------|------|
| ホストゾーン（1つ） | $0.50 | `platform.prance.co.jp` |
| クエリ（100万/月） | $0.40 | 最初の10億クエリ |
| エイリアスレコード | $0 | CloudFrontへのエイリアスは無料 |
| **合計** | **約$1/月** | 低トラフィック想定 |

**お名前.comのコスト変動:** なし

---

## 📝 推奨事項

### 1. 段階的な移行

```
Phase 1: 開発環境のみ（1週間運用）
  dev.platform.prance.co.jp

Phase 2: ステージング環境追加（1週間運用）
  staging.platform.prance.co.jp

Phase 3: 本番環境移行
  platform.prance.co.jp
```

### 2. 監視設定

```bash
# Route 53 ヘルスチェック設定（オプション）
aws route53 create-health-check \
  --health-check-config \
    Protocol=HTTPS,\
    ResourcePath=/,\
    FullyQualifiedDomainName=dev.platform.prance.co.jp,\
    Type=HTTPS

# CloudWatch アラーム設定
aws cloudwatch put-metric-alarm \
  --alarm-name dns-health-check \
  --metric-name HealthCheckStatus \
  --namespace AWS/Route53
```

### 3. ドキュメント更新

- 社内ドキュメントにDNS設定を記録
- NSレコードのバックアップ
- 緊急連絡先の明記

---

## 🎯 結論

**サブドメイン委譲方式の採用を推奨します。**

**理由:**
1. ✅ お名前.comでの変更は1つのNSレコード追加のみ
2. ✅ 既存サービスへの影響ゼロ
3. ✅ Route 53の機能を完全活用
4. ✅ 可逆性が高い（いつでも戻せる）
5. ✅ 将来の拡張性が高い

**次のステップ:**
1. [実装ガイド](DNS_IMPLEMENTATION_SUBDOMAIN.md) を参照
2. 開発環境で検証
3. 段階的に本番環境へ展開

---

**作成日:** 2026-03-04
**バージョン:** 1.0.0
**ステータス:** 承認待ち
