# Prance Platform - コーディング規約

**作成日**: 2026-03-04
**対象**: 全エンジニア、Claude Code開発

---

## 基本方針

### 1. コード再利用とバグ低減

**共通機能の一括管理化**を徹底し、コードの重複を排除します。

#### 原則

- 同じロジックを2回以上書かない
- 共通化可能な機能は必ず共有パッケージに配置
- ビジネスロジックとインフラストラクチャコードを分離

#### 実装ルール

```
packages/
├── core/              # ビジネスロジック共通処理
│   ├── conversation/  # 会話エンジン
│   ├── emotion/       # 感情解析
│   └── avatar/        # アバター制御
├── infra/             # インフラ共通処理
│   ├── aws/           # AWS SDK ラッパー
│   ├── database/      # DB操作
│   └── cache/         # キャッシュ
└── utils/             # 汎用ユーティリティ
    ├── logger/        # ロギング
    ├── validation/    # バリデーション
    └── errors/        # エラーハンドリング
```

**良い例**:

```typescript
// packages/infra/aws/bedrock.ts
export class BedrockClient {
  private client: BedrockRuntimeClient;

  async invokeClaude(prompt: string): Promise<string> {
    // 共通化されたBedrock呼び出しロジック
  }
}

// apps/web/api/chat.ts
import { BedrockClient } from '@prance/infra/aws';
const bedrock = new BedrockClient();
```

**悪い例**:

```typescript
// apps/web/api/chat.ts
// ❌ BedrockRuntimeClientを直接使用（共通化されていない）
const client = new BedrockRuntimeClient({ region: 'us-east-1' });
```

---

### 2. Claude Code中心の開発フロー

**Claude Code**を主要開発ツールとし、エンジニアが自立して作業できる環境を構築します。

#### Claude Codeの活用シーン

1. **コード生成**: 新機能実装、ボイラープレート作成
2. **リファクタリング**: 共通化、最適化
3. **バグ修正**: エラー解析、修正案提示
4. **ドキュメント生成**: API仕様、設計書
5. **テストコード**: ユニット・統合テスト生成
6. **コードレビュー**: プルリクエストレビュー支援

#### エンジニアの作業フロー

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

#### 自立作業のガイドライン

- **自己判断**: 小規模な実装判断は自分で行う
- **相談**: アーキテクチャレベルの変更は事前相談
- **ドキュメント参照**: CLAUDE.md、docs/ を常に確認
- **共通化意識**: 既存の共通パッケージを確認してから実装

---

### 3. チーム共同作業の前提

自立作業を基本としつつ、チームでの情報共有とコラボレーションを重視します。

#### 情報共有のルール

1. **Claude Memory活用** (後述)
2. **CLAUDE.md更新**: アーキテクチャ変更時
3. **Pull Request**: コードレビューを必ず実施
4. **Daily Sync**: 進捗と課題を共有
5. **ドキュメント更新**: 実装後に必ずドキュメント更新

#### PRレビュー観点

- [ ] 共通化可能なコードがないか
- [ ] 既存の共通パッケージを利用しているか
- [ ] エラーハンドリングが適切か
- [ ] ログが適切に出力されているか
- [ ] テストが追加されているか
- [ ] ドキュメントが更新されているか

---

## Claude Memoryの活用

**重要な変更は必ずClaude Memoryに保存**し、次回以降の開発で参照できるようにします。

### 保存すべき情報

#### 1. アーキテクチャ決定

```
- AWS Bedrockを会話AIとして使用（Anthropic直接APIは使用しない）
- TTS: ElevenLabs (Primary) + AWS Polly (Fallback)
- 感情解析: AWS Rekognition (100 facial landmarks)
```

#### 2. 技術スタック選定理由

```
- Monorepo: npm workspaces + Turborepo（コード共有容易）
- ORM: Prisma（型安全、マイグレーション管理）
- Infrastructure: AWS CDK（TypeScript、型安全）
```

#### 3. よくあるバグと対処法

```
- Bedrock呼び出しタイムアウト → リトライロジック実装済み
- Rekognition顔検出失敗 → 画像品質チェック追加
```

#### 4. 共通パッケージの場所

```
- AWS SDK wrapper: packages/infra/aws/
- エラーハンドリング: packages/utils/errors/
- ログ: packages/utils/logger/
```

### Memory保存コマンド例

```bash
# Claude Code セッション中
> "今回のBedrockリトライロジック実装をメモリーに保存して"
> "共通エラーハンドリングの場所をメモリーに記録"
> "AWS統合度70%達成の決定事項を保存"
```

---

## ディレクトリ別CLAUDE.md

各作業ディレクトリに**個別のCLAUDE.md**を配置し、ディレクトリ固有のコンテキストを記載します。

### CLAUDE.md配置場所

```
/
├── CLAUDE.md                    # プロジェクト全体（既存）
├── apps/
│   ├── web/
│   │   └── CLAUDE.md           # Next.js フロントエンド固有
│   └── api/
│       └── CLAUDE.md           # バックエンドAPI固有
├── packages/
│   ├── core/
│   │   └── CLAUDE.md           # コアロジック固有
│   └── infra/
│       └── CLAUDE.md           # インフラ共通処理固有
└── infrastructure/
    └── CLAUDE.md               # AWS CDK固有
```

### CLAUDE.md記載内容

各ディレクトリの CLAUDE.md には以下を記載：

````markdown
# [ディレクトリ名] - Claude開発ガイド

## このディレクトリの役割

[簡潔な説明]

## 主要ファイル

- `xxx.ts`: [役割]
- `yyy.ts`: [役割]

## 依存関係

- 依存パッケージ: [@prance/xxx, @prance/yyy]
- 外部依存: [AWS SDK, Prisma等]

## よくあるタスク

### タスク1: XXXの実装

```bash
# コマンド例
```
````

### タスク2: YYYの修正

```bash
# コマンド例
```

## 注意事項

- [このディレクトリ固有の注意点]

````

### 例: apps/web/CLAUDE.md

```markdown
# Next.js フロントエンド - Claude開発ガイド

## このディレクトリの役割
Pranceプラットフォームのフロントエンド（Next.js 14 App Router）

## 主要ファイル
- `app/api/`: API Routes
- `app/(dashboard)/`: ダッシュボード画面
- `components/`: 共通UIコンポーネント
- `lib/`: フロントエンド固有のユーティリティ

## 依存関係
- 共通パッケージ: @prance/core, @prance/infra, @prance/database
- UI: shadcn/ui, Three.js, Framer Motion

## よくあるタスク

### API Routeの追加
```bash
# apps/web/app/api/[new-endpoint]/route.ts を作成
# @prance/core のビジネスロジックを呼び出す
````

### UIコンポーネント追加

```bash
# components/ に追加
# shadcn/ui をベースに実装
```

## 注意事項

- API呼び出しは必ず @prance/infra の共通クライアントを使用
- エラーハンドリングは packages/utils/errors を使用
- 環境変数は NEXT*PUBLIC* プレフィックス必須（ブラウザ公開時）

````

---

## 開発ワークフロー

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

# 5. テスト実行
npm test

# 6. ドキュメント更新
# - 必要に応じて CLAUDE.md 更新
# - 重要な変更はClaude Memoryに保存

# 7. コミット
git add .
git commit -m "feat: add new feature XXX"

# 8. プッシュ＆PR作成
git push origin feature/new-feature
gh pr create
````

### バグ修正

```bash
# 1. バグ確認
# - エラーログ確認
# - 再現手順確認

# 2. Claude Codeで解析
> "このエラーを解析して修正案を提示"

# 3. 修正実装
# - 共通エラーハンドリング活用
# - テストケース追加

# 4. Claude Memoryに記録
> "このバグの原因と対処法をメモリーに保存"

# 5. コミット＆PR
```

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
```

---

## コード品質チェックリスト

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

### PR作成前

- [ ] コミットメッセージが適切か
- [ ] PRタイトル・説明が明確か
- [ ] レビュー観点を記載したか
- [ ] テスト結果を記載したか

---

## ツール・コマンド

### Claude Code

```bash
# 起動
claude

# よくある指示例
> "共通エラーハンドリングを実装"
> "このコードをリファクタリングして共通化"
> "XXXの機能を追加"
> "このバグを解析して修正"
> "テストコードを追加"
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

---

## 共通パッケージ開発ガイド

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

# 6. CLAUDE.md 作成
```

### 共通パッケージ利用

```typescript
// package.json に依存追加（自動）
// import して使用
import { xxxFunction } from '@prance/package-name';
```

---

## 参考ドキュメント

- [CLAUDE.md](../CLAUDE.md) - プロジェクト全体ガイド
- [ALPHA_DEVELOPMENT.md](./ALPHA_DEVELOPMENT.md) - Alpha版開発計画
- [ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ詳細
- [AWS_MIGRATION_ANALYSIS.md](./AWS_MIGRATION_ANALYSIS.md) - AWS統合分析
- [EXTERNAL_TOOLS_SETUP.md](./EXTERNAL_TOOLS_SETUP.md) - 外部ツールセットアップ

---

## まとめ

### 重要原則

1. **コードは再利用** - 共通化を徹底
2. **Claude Code活用** - 自立して効率的に開発
3. **チーム共同作業** - 情報共有とレビュー
4. **Memory活用** - 重要な変更を記録
5. **ディレクトリ別ガイド** - CLAUDE.md を整備

### 迷ったら

1. 既存の共通パッケージを確認
2. CLAUDE.md を参照
3. Claude Codeに相談
4. チームに相談

---

**Happy Coding with Claude! 🚀**
