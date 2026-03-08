# 開発ワークフロー - 完全ガイド

**最終更新:** 2026-03-08

このドキュメントは、Pranceプラットフォーム開発における包括的なワークフローガイドです。
日常的なチェックリストは [CODING_RULES.md](../../CODING_RULES.md) を参照してください。

---

## 📋 目次

1. [Claude Code中心の開発フロー](#claude-code中心の開発フロー)
2. [開発ワークフロー](#開発ワークフロー)
3. [Claude Memory活用](#claude-memory活用)
4. [共通パッケージ開発](#共通パッケージ開発)
5. [ツール・コマンド集](#ツールコマンド集)

---

## 🤖 Claude Code中心の開発フロー

### 基本方針

**Claude Code**を主要開発ツールとし、エンジニアが自立して作業できる環境を構築します。

### Claude Codeの活用シーン

1. **コード生成**: 新機能実装、ボイラープレート作成
2. **リファクタリング**: 共通化、最適化
3. **バグ修正**: エラー解析、修正案提示
4. **ドキュメント生成**: API仕様、設計書
5. **テストコード**: ユニット・統合テスト生成
6. **コードレビュー**: プルリクエストレビュー支援

### エンジニアの作業フロー

```bash
# 1. Claude Codeで作業開始
claude

# 2. タスクを指示（自然言語でOK）
> "ユーザー認証APIエンドポイントを実装して"
> "共通エラーハンドリングを追加"
> "この関数をリファクタリングして共通化"

# 3. 生成されたコードをレビュー
# 4. 必要に応じて修正指示
# 5. テスト実行
# 6. コミット＆プッシュ
```

### 自立作業のガイドライン

- **自己判断**: 小規模な実装判断は自分で行う
- **相談**: アーキテクチャレベルの変更は事前相談
- **ドキュメント参照**: CLAUDE.md、docs/ を常に確認
- **共通化意識**: 既存の共通パッケージを確認してから実装

---

## 🔄 開発ワークフロー

### 新機能開発

```bash
# 1. ブランチ作成
git checkout -b feature/new-feature

# 2. Claude Code起動
claude

# 3. タスク指示
> "新機能XXXを実装して。共通化できる部分はpackages/に配置"

# 4. 生成されたコードをレビュー
# - 共通化されているか？
# - 既存パッケージを利用しているか？
# - [CODING_RULES.md](../../CODING_RULES.md) のチェックリスト確認

# 5. テスト実行
npm test

# 6. ドキュメント更新
# - 必要に応じて CLAUDE.md 更新
# - 重要な変更はClaude Memoryに保存

# 7. コミット前チェック（必須）
# → [CODING_RULES.md](../../CODING_RULES.md) の全チェックリスト実行

# 8. コミット
git add .
git commit -m "feat: add new feature XXX"

# 9. プッシュ＆PR作成
git push origin feature/new-feature
gh pr create
```

**重要な確認ポイント:**
- ✅ 同じロジックが他にないか確認
- ✅ 共通パッケージを利用しているか
- ✅ エラーハンドリングが適切か
- ✅ ログが適切に出力されているか
- ✅ 型安全性が保たれているか
- ✅ 環境変数が適切に管理されているか

---

### バグ修正

```bash
# 1. バグ確認
# - エラーログ確認
# - 再現手順確認

# 2. Claude Codeで解析
> "このエラーを解析して修正案を提示"

# 3. 修正実装
# - 共通エラーハンドリング活用
# - テストケース追加（回帰防止）

# 4. Claude Memoryに記録
> "このバグの原因と対処法をメモリーに保存"

# 5. コミット＆PR
git add .
git commit -m "fix: resolve issue with XXX"
git push origin fix/issue-description
```

**バグ修正時の注意:**
- 🔍 根本原因を特定する
- 📝 同じバグが他にないか確認
- ✅ 回帰テストを追加
- 📚 Claude Memoryに記録（再発防止）

---

### リファクタリング

```bash
# 1. 重複コード特定
# - Grep, Glob で検索
# - Claude Codeで分析依頼

# 2. 共通化実装
# - packages/ に共通パッケージ作成
# - 既存コードを移行

# 3. 影響範囲テスト
# - 全テスト実行
# - 手動確認

# 4. ドキュメント更新
# - CLAUDE.md 更新
# - Claude Memory 更新

# 5. PR作成（大規模な場合は事前相談）
git commit -m "refactor: extract common logic to shared package"
```

**リファクタリングの基準:**
- 10行以上の類似ロジック → 共通関数化を検討
- 30行以上の重複ロジック → **必ず**共通関数化
- 3箇所以上で同じパターン → **必ず**共通関数化

---

## 💾 Claude Memory活用

### 重要な変更は必ずClaude Memoryに保存

次回以降の開発で参照できるようにします。

### 保存すべき情報

#### 1. アーキテクチャ決定

```
例:
- AWS Bedrockを会話AIとして使用（Anthropic直接APIは使用しない）
- TTS: ElevenLabs (Primary) + AWS Polly (Fallback)
- 感情解析: AWS Rekognition (100 facial landmarks)
```

#### 2. 技術スタック選定理由

```
例:
- Monorepo: npm workspaces + Turborepo（コード共有容易）
- ORM: Prisma（型安全、マイグレーション管理）
- Infrastructure: AWS CDK（TypeScript、型安全）
```

#### 3. よくあるバグと対処法

```
例:
- Bedrock呼び出しタイムアウト → リトライロジック実装済み
- Rekognition顔検出失敗 → 画像品質チェック追加
- 音声チャンクソート誤り → chunk-utils.ts の共通関数使用
```

#### 4. 共通パッケージの場所

```
例:
- AWS SDK wrapper: packages/infra/aws/
- エラーハンドリング: packages/utils/errors/
- ログ: packages/utils/logger/
- チャンク処理: infrastructure/lambda/websocket/default/chunk-utils.ts
```

### Memory保存コマンド例

```bash
# Claude Code セッション中
> "今回のBedrockリトライロジック実装をメモリーに保存して"
> "共通エラーハンドリングの場所をメモリーに記録"
> "AWS統合度70%達成の決定事項を保存"
> "DRY原則に基づくリファクタリングの実例を保存"
```

---

## 📦 共通パッケージ開発

### 基本原則

同じロジックを2回以上書かない。共通化可能な機能は必ず共有パッケージに配置。

### 新規共通パッケージ作成

```bash
# 1. ディレクトリ作成
mkdir -p packages/[package-name]/src

# 2. package.json 作成
cd packages/[package-name]
npm init -y

# 3. package.json 編集
{
  "name": "@prance/[package-name]",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}

# 4. tsconfig.json 作成（ルートを継承）
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}

# 5. src/index.ts でエクスポート
export * from './xxx';

# 6. CLAUDE.md 作成（そのパッケージの説明）
```

### 共通パッケージ利用

```typescript
// package.json に依存追加（自動）
// import して使用
import { xxxFunction } from '@prance/package-name';
```

### 共通パッケージのディレクトリ構造例

```
packages/
├── shared/           # 型定義・共通インターフェース
│   └── src/
│       └── types/
│           └── index.ts
├── database/         # Prismaスキーマ・マイグレーション
│   └── prisma/
│       └── schema.prisma
└── plugins/          # プラグインSDK
    └── src/
        └── index.ts
```

---

## 🔧 ツール・コマンド集

### Claude Code指示例

```bash
# 起動
claude

# よくある指示例
> "共通エラーハンドリングを実装"
> "このコードをリファクタリングして共通化"
> "XXXの機能を追加"
> "このバグを解析して修正"
> "テストコードを追加"
> "この重複コードを共通関数化して"
> "Prismaスキーマと整合性があるか確認"
```

### 開発コマンド

```bash
# ルートで全ワークスペースインストール
npm install

# 開発サーバー起動（全アプリ）
npm run dev

# 特定アプリのみ起動
cd apps/web && npm run dev

# テスト実行（全体）
npm test

# Lint
npm run lint

# ビルド
npm run build

# Prisma
cd packages/database
npx prisma generate
npx prisma migrate dev
npx prisma studio
```

### CDKコマンド

```bash
cd infrastructure

# スタック一覧
npx cdk list

# 差分確認
npx cdk diff

# デプロイ
npx cdk deploy --all

# 特定スタックのみ
npx cdk deploy Prance-dev-Network
```

### AWS Lambda操作

```bash
# Lambda関数一覧
aws lambda list-functions --query "Functions[?contains(FunctionName, 'prance')].FunctionName"

# CloudWatch Logs確認
aws logs tail /aws/lambda/prance-auth-login-dev --follow

# Lambda関数呼び出し
aws lambda invoke \
  --function-name prance-sessions-get-dev \
  --payload '{"pathParameters":{"id":"test"}}' \
  /tmp/result.json
cat /tmp/result.json
```

---

## 🤝 チーム共同作業

### 情報共有のルール

1. **Claude Memory活用**
2. **CLAUDE.md更新**: アーキテクチャ変更時
3. **Pull Request**: コードレビューを必ず実施
4. **Daily Sync**: 進捗と課題を共有
5. **ドキュメント更新**: 実装後に必ずドキュメント更新

### PRレビュー観点

詳細は [CODING_RULES.md](../../CODING_RULES.md) の「PRレビュー観点」を参照。

---

## 📚 関連ドキュメント

- **[CODING_RULES.md](../../CODING_RULES.md)** - コミット前チェックリスト（必読）
- **[CLAUDE.md](../../CLAUDE.md)** - プロジェクト全体ガイド
- **[API_DESIGN.md](./API_DESIGN.md)** - API設計
- **[DATABASE_DESIGN.md](./DATABASE_DESIGN.md)** - データベース設計
- **[CHUNK_SORTING_REFACTORING.md](./CHUNK_SORTING_REFACTORING.md)** - DRY原則の実例

---

## ✅ コード品質チェックリスト

### 実装時

- [ ] 同じロジックが他にないか確認
- [ ] 共通パッケージを利用しているか
- [ ] エラーハンドリングが適切か
- [ ] ログが適切に出力されているか
- [ ] 型安全性が保たれているか
- [ ] 環境変数が適切に管理されているか

### コミット前

- [ ] テストが通るか
- [ ] Lintエラーがないか
- [ ] 不要なconsole.logがないか
- [ ] コメントが適切か
- [ ] ドキュメントを更新したか
- [ ] [CODING_RULES.md](../../CODING_RULES.md) の全チェックリスト実行済み

### PR作成前

- [ ] コミットメッセージが適切か
- [ ] PRタイトル・説明が明確か
- [ ] レビュー観点を記載したか
- [ ] テスト結果を記載したか

---

## 🎯 まとめ

### 重要原則

1. **コードは再利用** - 共通化を徹底（DRY原則）
2. **Claude Code活用** - 自立して効率的に開発
3. **チーム共同作業** - 情報共有とレビュー
4. **Memory活用** - 重要な変更を記録
5. **型安全性** - Prismaスキーマ・共有型定義に準拠

### 迷ったら

1. 既存の共通パッケージを確認
2. CLAUDE.md を参照
3. Claude Codeに相談
4. チームに相談

---

**Happy Coding with Claude! 🚀**
