# Infrastructure ドキュメント

このディレクトリにはPranceプラットフォームのインフラストラクチャ関連ドキュメントが格納されています。

---

## 📂 ディレクトリ構造

```
infrastructure/docs/
├── README.md                                    # このファイル
│
├── [DNS・ドメイン設定]
│   ├── DNS_DESIGN_SUBDOMAIN_DELEGATION.md       # サブドメイン委譲設計（推奨方式）
│   ├── DNS_IMPLEMENTATION_SUBDOMAIN.md          # サブドメイン委譲実装ガイド
│   ├── QUICKSTART_SUBDOMAIN_DELEGATION.md       # サブドメイン委譲クイックスタート
│   ├── DOMAIN_SETUP.md                          # フルドメイン委譲設定ガイド（従来方式）
│   └── QUICKSTART_DOMAIN.md                     # フルドメイン委譲クイックスタート（従来方式）
```

---

## 📖 ドキュメント分類

### 1. DNS・ドメイン設定ドキュメント

**サブドメイン委譲方式（推奨）:**
- `DNS_DESIGN_SUBDOMAIN_DELEGATION.md`: 設計思想、メリット・デメリット、アーキテクチャ
- `DNS_IMPLEMENTATION_SUBDOMAIN.md`: 詳細な実装手順、トラブルシューティング
- `QUICKSTART_SUBDOMAIN_DELEGATION.md`: 15-25分で完了する最速セットアップ

**フルドメイン委譲方式（従来）:**
- `DOMAIN_SETUP.md`: 詳細設定ガイド
- `QUICKSTART_DOMAIN.md`: クイックスタートガイド

---

## 🎯 目的別の参照先

| 目的 | 参照ドキュメント | 推定時間 |
|------|----------------|----------|
| **DNS設計の背景を理解したい** | `DNS_DESIGN_SUBDOMAIN_DELEGATION.md` | 15分 |
| **最速でドメインをセットアップしたい** | `QUICKSTART_SUBDOMAIN_DELEGATION.md` | 15-25分 |
| **詳細な実装手順を確認したい** | `DNS_IMPLEMENTATION_SUBDOMAIN.md` | 30-45分 |
| **トラブルシューティングが必要** | `DNS_IMPLEMENTATION_SUBDOMAIN.md` の該当セクション | 10-30分 |
| **フルドメイン委譲との比較** | `DNS_DESIGN_SUBDOMAIN_DELEGATION.md` の比較表 | 5分 |

---

## 🚀 はじめてのデプロイ

初めてインフラをデプロイする場合は、以下の順序で実施：

### ステップ1: DNS設計を理解
```bash
# 設計ドキュメントを確認
cat infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md
```

### ステップ2: Route 53 Hosted Zone作成
```bash
# クイックスタートガイドに従って実行
cat infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md
```

### ステップ3: お名前.comでNSレコード追加
- クイックスタートガイドの「ステップ3」を参照
- 5-10分で完了

### ステップ4: インフラデプロイ
```bash
cd infrastructure
npm run build
npm run deploy:dev
```

---

## 📋 [サブドメイン委譲](../../docs/GLOSSARY.md#subdomain-delegation-サブドメイン委譲)方式の概要

### なぜサブドメイン委譲を推奨するのか？

| 項目 | サブドメイン委譲 | フルドメイン委譲 |
|------|----------------|-----------------|
| **[お名前.com](../../docs/GLOSSARY.md#お名前com)での変更** | [NSレコード](../../docs/GLOSSARY.md#ns-record-ネームサーバーレコード)4つのみ追加 | ネームサーバー全変更 |
| **既存サービスへの影響** | なし | 全DNSレコードを移行必要 |
| **ロールバック** | NSレコード削除のみ | 元のネームサーバーに戻す |
| **リスク** | 最小 | 中〜高 |
| **所要時間** | 15-25分 | 1-2時間 |

### DNS構造

```
お名前.com DNS
└── prance.co.jp (ルートドメイン)
    ├── [既存のDNSレコード] ← 影響なし
    └── platform (NSレコード × 4) ← Route 53に委譲

Route 53
└── platform.prance.co.jp (Hosted Zone)
    ├── dev.platform.prance.co.jp
    ├── staging.platform.prance.co.jp
    └── platform.prance.co.jp
```

---

## ⚠️ よくある問題と解決策

### 問題1: NSレコードが反映されない

**症状:**
```bash
dig NS platform.prance.co.jp +short
# 何も表示されない
```

**解決策:**
1. 5-30分待つ（DNS伝播時間）
2. お名前.comの設定を再確認
3. DNSキャッシュをクリア

**詳細:** `DNS_IMPLEMENTATION_SUBDOMAIN.md` の「トラブルシューティング」セクション

---

### 問題2: CDK synth時に「HostedZone not found」

**症状:**
```
Found zones: [] for dns:platform.prance.co.jp
```

**解決策:**
```bash
# Route 53 Hosted Zoneを作成
aws route53 create-hosted-zone \
  --name platform.prance.co.jp \
  --caller-reference "prance-platform-$(date +%s)"
```

---

### 問題3: SSL証明書が検証されない

**症状:**
```
Certificate status: PENDING_VALIDATION
```

**解決策:**
1. DNS委譲が完了しているか確認
2. 5-30分待つ（最大48時間）
3. ACM検証レコードを確認

---

## 📝 ドキュメント更新時の注意

### 更新が必要なケース

- AWS サービスの仕様変更
- お名前.com UIの変更
- 新しいトラブルシューティング事例の発見
- より効率的な手順の発見

### 更新手順

1. 該当ドキュメントを編集
2. 最終更新日を変更
3. 変更内容を簡潔に記録（ドキュメント末尾の更新履歴）
4. コミット＆プッシュ

---

## 🔗 関連リソース

- **プロジェクトルート ドキュメント:** `../docs/`
- **グローサリー（用語集）:** `../docs/GLOSSARY.md`
- **インフラ README:** `../README.md`
- **AWS CDK コード:** `../lib/`, `../bin/`

---

## 📞 サポート

インフラ関連で困ったときは：

1. **まず確認:** このREADMEの「よくある問題と解決策」
2. **詳細確認:** 該当ドキュメントの「トラブルシューティング」セクション
3. **解決しない場合:** Issue作成またはチームに相談

---

**最終更新:** 2026-03-04
**管理者:** インフラチーム
