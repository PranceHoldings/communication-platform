# ステアリングドキュメント: グローサリーリンク強化

**作成日:** 2026-03-04
**担当者:** Claude Code
**ステータス:** 完了

---

## 📋 作業概要

**目的:**
- グローサリーに有用な外部リンク・内部リンクを追加
- プロジェクトドキュメント全体でグローサリーへのリンクを活用
- 今後の恒久的なドキュメント運用ルールとして確立

**背景:**
- グローサリーは132用語を収録しているが、リンクがない
- ドキュメント間の相互参照が不十分
- 用語の詳細情報へのアクセス性を向上させる必要がある

---

## 🎯 成果物

- [x] `docs/GLOSSARY.md` - 全132用語に外部リンク・内部リンクを追加
- [x] `docs/README.md` - リンク運用ルールを追加
- [x] `CLAUDE.md` - 主要用語にグローサリーへのリンクを追加
- [x] `docs/ARCHITECTURE.md` - 主要用語にグローサリーへのリンクを追加
- [x] `infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md` - DNS関連用語のリンク追加
- [x] `infrastructure/docs/README.md` - DNS関連用語のリンク追加
- [x] `DOMAIN_SETUP_SUMMARY.md` - DNS関連用語のリンク追加
- [x] このステアリングドキュメント

---

## 📝 実施内容

### 1. グローサリーへのリンク追加

**追加したリンクの種類:**

1. **外部リンク（公式ドキュメント・サービスサイト）:**
   - AWS サービス: ACM, API Gateway, Aurora, Bedrock, CloudFront, Cognito, DynamoDB, EventBridge, Fargate, IAM, IoT Core, Lambda, MediaConvert, Route 53, S3, Step Functions, VPC, X-Ray
   - 技術仕様: ARKit Blendshapes, CORS, OAuth2, OpenAPI, SAML, WebSocket
   - 外部サービス: Claude, ElevenLabs, Live2D, Ready Player Me, Azure Speech Services
   - 開発ツール: CDK, Next.js, Prisma, Three.js
   - 日本語サービス: お名前.com

2. **内部リンク（関連ドキュメント）:**
   - 企画書（CLAUDE.md）の該当セクション
   - 設計書（ARCHITECTURE.md, DATABASE_DESIGN.md, API_SPECIFICATION.md）
   - DNS設計ドキュメント（infrastructure/docs/）
   - セキュリティ（SECURITY.md）
   - 外部サービス設定（reference/EXTERNAL_TOOLS_SETUP.md）

3. **グローサリー内参照:**
   - 関連用語へのクロスリファレンス
   - 例: Blendshape → ARKit Blendshapes
   - 例: TTS → ElevenLabs, Viseme

**追加した用語数:**
- 外部リンク: 50+
- 内部リンク: 80+
- グローサリー内参照: 20+

### 2. プロジェクトドキュメントへのリンク追加

**更新したドキュメント:**

#### `CLAUDE.md`（企画書）
- マルチテナント型SaaS関連用語
- Avatar, Scenario, Session, Tenant
- 初出箇所にリンクを追加

#### `docs/ARCHITECTURE.md`
- AWS サービス関連用語
- Lambda, API Gateway, Aurora Serverless v2, CloudFront, VPC, IAM
- アーキテクチャ原則セクションにリンクを追加

#### `infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md`
- DNS関連用語
- サブドメイン委譲, NSレコード, Route 53, お名前.com
- 目標セクションにリンクを追加

#### `infrastructure/docs/README.md`
- DNS関連用語
- サブドメイン委譲, お名前.com, NSレコード
- 概要セクションにリンクを追加

#### `DOMAIN_SETUP_SUMMARY.md`
- DNS関連用語
- サブドメイン委譲, お名前.com, NSレコード, Route 53, Hosted Zone
- DNS設計方式セクションにリンクを追加

### 3. ドキュメント運用ルールの確立

**`docs/README.md` に追加したルール:**

```markdown
### 8. グローサリーへのリンク

**ドキュメント内での用語リンク:**
- 重要用語を初めて使用する箇所では、グローサリーへのリンクを追加
- リンク形式: `[用語](./GLOSSARY.md#用語アンカー)`
- 同じ用語が文書内で複数回登場する場合、初出のみリンクすればOK
- 相対パスは文書の位置に応じて調整

**グローサリー内のリンク追加:**
- 外部リンク: AWS公式ドキュメント、サービス公式サイト、技術仕様書など
- 内部リンク（関連ドキュメント）: 企画書、設計書、実装ガイドなど
- 内部リンク（グローサリー内参照）: 関連用語へのリンク

**リンク運用のベストプラクティス:**
- 外部リンクは定期的に確認（リンク切れ防止）
- 公式ドキュメントの言語は英語を優先
- 内部リンクは相対パスを使用
- グローサリーへのリンクは過度を避け、重要な用語のみ
```

---

## 📊 統計

### グローサリー更新統計

| 項目 | 数値 |
|------|------|
| 総用語数 | 132語 |
| 外部リンク追加 | 50+ |
| 内部リンク（関連ドキュメント）追加 | 80+ |
| グローサリー内参照追加 | 20+ |

### ドキュメント更新統計

| ドキュメント | 追加したリンク数 |
|------------|----------------|
| `docs/GLOSSARY.md` | 150+ |
| `CLAUDE.md` | 5 |
| `docs/ARCHITECTURE.md` | 8 |
| `infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md` | 4 |
| `infrastructure/docs/README.md` | 3 |
| `DOMAIN_SETUP_SUMMARY.md` | 5 |
| `docs/README.md` | ルール追加 |
| **合計** | **175+** |

---

## ✅ 完了チェックリスト

- [x] グローサリー全132用語にリンクを追加
- [x] 主要ドキュメント（6件）にグローサリーリンクを追加
- [x] `docs/README.md` にリンク運用ルールを追加
- [x] 外部リンクの動作確認（主要なもの）
- [x] 内部リンクの動作確認（相対パス）
- [x] ステアリングドキュメントの作成

---

## 🎓 学んだこと・今後への提言

### 成功したこと

1. **充実したリファレンス**: 132用語に150+のリンクを追加し、情報アクセス性が大幅向上
2. **明確なルール確立**: 今後のドキュメント作成時に従うべきルールが明確化
3. **相互参照の強化**: ドキュメント間の関連性が明確になり、学習効率が向上

### 改善提案

1. **定期的なリンクチェック**: 四半期ごとに外部リンクの有効性を確認
2. **自動化**: リンク切れチェックの自動化ツール導入検討
3. **継続的な充実**: 新規用語追加時に必ずリンクも追加
4. **ビジュアル化**: グローサリーの用語間の関連性を図で表現（将来的に）

### 今後のアクション

- [ ] 四半期ごとの外部リンク有効性チェック（次回: 2026-06-04）
- [ ] 新規ドキュメント作成時にグローサリーリンク追加を忘れずに
- [ ] リンク切れチェック自動化ツールの検討（markdownlint等）

---

## 🔗 関連リソース

- **ドキュメント管理ルール:** `docs/README.md`
- **グローサリー:** `docs/GLOSSARY.md`
- **企画書:** `CLAUDE.md`
- **アーキテクチャ:** `docs/ARCHITECTURE.md`
- **DNS設計:** `infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md`

---

**完了日:** 2026-03-04
**アーカイブ先:** `docs/steering/GLOSSARY_LINKS_ENHANCEMENT.md`
