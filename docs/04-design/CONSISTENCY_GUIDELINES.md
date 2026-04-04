# コード整合性ガイドライン

**バージョン:** 1.0
**作成日:** 2026-03-07
**目的:** Claude Code自身が生成したコード間での不整合を防ぐ

---

## 🎯 このガイドラインの目的

Claude Code（AI）が生成したコードは、セッションをまたぐと以下の不整合が発生しやすい：

1. **型の不整合:** 出力の型と入力の型が一致しない
2. **スキーマの不整合:** Prismaスキーマと実装が一致しない
3. **命名の不整合:** 作成時の名称と使用時の名称が異なる
4. **設定値の重複:** ハードコードされた設定値が複数箇所に存在

このガイドラインは、これらの不整合を**予防**し、**検出**し、**修正**するための具体的な手順を提供します。

---

## 📚 目次

1. [基本原則](#基本原則)
2. [型定義の管理](#型定義の管理)
3. [Prismaスキーマとの整合性](#prismaスキーマとの整合性)
4. [設定値の一元管理](#設定値の一元管理)
5. [開発ワークフロー](#開発ワークフロー)
6. [自動検証ツール](#自動検証ツール)
7. [トラブルシューティング](#トラブルシューティング)

---

## 🔐 基本原則

### 原則1: 単一の真実の源（Single Source of Truth）

**すべての重要な定義は1箇所にのみ存在すべき**

- ✅ **正しい:** 共有型を1箇所で定義し、他の場所からimport
- ❌ **間違い:** 同じ型を複数のファイルで重複定義

### 原則2: 型安全性の最大化

**TypeScriptの型システムを最大限活用**

- ✅ **正しい:** すべてのAPIで型定義を使用
- ❌ **間違い:** `any` や型アサーション `as string` の乱用

### 原則3: 自動検証の徹底

**人間の目視に依存しない**

- ✅ **正しい:** CI/CDパイプラインで自動チェック
- ❌ **間違い:** コミット後に手動でレビュー

---

## 🔧 型定義の管理

### 共有型パッケージの使用

**すべてのEntity型とEnum型は `packages/shared/src/types/index.ts` で定義**

```typescript
// ✅ 正しい - 共有型を使用
import type { User, Avatar, Visibility } from '@prance/shared';

export interface AvatarListResponse {
  avatars: Avatar[]; // 共有型
  pagination: PaginationMeta; // 共有型
}

export interface CreateAvatarRequest {
  name: string;
  visibility?: Visibility; // 共有Enum
}
```

```typescript
// ❌ 間違い - 重複定義
export interface Avatar {
  id: string;
  name: string;
  type: 'TWO_D' | 'THREE_D'; // インラインEnum
  // ...
}

export interface AvatarListResponse {
  avatars: Avatar[];
  pagination: {
    // PaginationMetaがあるのに再定義
    total: number;
    limit: number;
    // ...
  };
}
```

### Lambda関数での型使用

```typescript
// Lambda関数内 - shared/types から re-export された型を使用
import { User, Avatar, ValidationError } from '../shared/types';
```

### 型定義チェックリスト

**新しい型を追加する前に確認:**

- [ ] `packages/shared/src/types/index.ts` に同じ型が既に存在しないか？
- [ ] Prismaスキーマと一致しているか？
- [ ] 他のファイルで重複定義していないか？

---

## 📊 Prismaスキーマとの整合性

### 命名規則の厳守

**Prismaスキーマのフィールド名と完全に一致させる**

| Prismaフィールド名 | 使用箇所              | ❌ 間違いやすい例               |
| ------------------ | --------------------- | ------------------------------- |
| `orgId`            | User, Session, Avatar | organizationId, organization_id |
| `userId`           | Session, Avatar       | user_id, creator_id             |
| `scenarioId`       | Session               | scenario_id                     |
| `avatarId`         | Session               | avatar_id                       |
| `startedAt`        | Session               | started_at, startTime           |
| `endedAt`          | Session               | ended_at, endTime               |
| `durationSec`      | Session               | duration_sec, duration          |

### Enum値の完全一致

**大文字・アンダースコアを含め完全一致させる**

```typescript
// ✅ 正しい - Prismaと完全一致
type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER';
type SessionStatus = 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
type AvatarType = 'TWO_D' | 'THREE_D'; // アンダースコアあり
```

```typescript
// ❌ 間違い
type UserRole = 'superAdmin' | 'clientAdmin' | 'clientUser'; // camelCase
type SessionStatus = 'active' | 'processing' | 'completed'; // 小文字
type AvatarType = '2D' | '3D'; // 数字のみ
```

### Prismaスキーマ変更時の必須手順

**スキーマを変更したら即座に以下を実行:**

```bash
# Step 1: マイグレーション生成
cd packages/database
pnpm exec prisma migrate dev --name <変更内容>

# Step 2: Prisma Client再生成
pnpm exec prisma generate

# Step 3: 共有型パッケージのビルド
cd ../../packages/shared
pnpm run build

# Step 4: Lambda関数デプロイ
cd ../../infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# Step 5: データベースマイグレーション実行
aws lambda invoke --function-name prance-db-migration-dev \
  --payload '{}' /tmp/migration-result.json
```

---

## ⚙️ 設定値の一元管理

### ハードコード禁止

**言語・リージョン・メディアフォーマット・その他すべての設定値をハードコードしない**

```typescript
// ❌ 禁止 - ハードコード
const language = 'en-US';
const region = 'us-east-1';
const format = 'webm';
const resolution = '1280x720';
```

```typescript
// ✅ 正しい - 一元管理からimport
import { LANGUAGE_DEFAULTS, MEDIA_DEFAULTS } from '../../shared/config/defaults';

const language = process.env.STT_LANGUAGE || LANGUAGE_DEFAULTS.STT_LANGUAGE;
const region = process.env.AWS_REGION || AWS_DEFAULTS.REGION;
const format = process.env.VIDEO_FORMAT || MEDIA_DEFAULTS.VIDEO_FORMAT;
const resolution = process.env.VIDEO_RESOLUTION || MEDIA_DEFAULTS.VIDEO_RESOLUTION;
```

### 一元管理ファイル

```
infrastructure/lambda/shared/config/defaults.ts  # すべてのデフォルト値
infrastructure/lambda/shared/config/index.ts     # 環境変数ヘルパー
```

### 検証コマンド

```bash
# ハードコード検出（コミット前必須）
grep -rn "'en-US'\|'ja-JP'\|'us-east-1'\|'webm'\|'1280x720'" \
  infrastructure/lambda --include="*.ts" --exclude="defaults.ts"
```

---

## 🔄 開発ワークフロー

### 日常的な開発フロー

```bash
# 1. 朝一番（または新しいブランチで作業開始時）
pnpm run consistency:validate  # 整合性検証

# 2. コード変更後
pnpm run lint                 # Lint
pnpm run typecheck            # 型チェック

# 3. コミット前（必須）
pnpm run pre-commit           # 全チェック（整合性・lint・型）

# 4. コミット
git add .
git commit -m "feat: ..."

# 5. プッシュ前
pnpm run build                # ビルド確認
pnpm run test                 # テスト実行
git push origin <branch>
```

### Prismaスキーマ変更時のフロー

```bash
# 1. スキーマ変更
vim packages/database/prisma/schema.prisma

# 2. マイグレーション生成・実行
cd packages/database
pnpm exec prisma migrate dev --name <変更内容>
pnpm exec prisma generate

# 3. 整合性チェック
cd ../..
pnpm run consistency:validate

# 4. Lambda関数デプロイ
cd infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never

# 5. DBマイグレーション実行
aws lambda invoke --function-name prance-db-migration-dev \
  --payload '{}' /tmp/migration-result.json

# 6. 動作確認
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health
```

---

## 🛠️ 自動検証ツール

### 1. 不整合検出スクリプト

```bash
pnpm run consistency:check
```

**検出内容:**

- ContentType と ファイル拡張子の不整合
- Prismaスキーマ と 実装の不整合
- ハードコードされた設定値
- 型定義の重複
- 多言語対応の不整合
- 環境変数の不整合

**出力:** `docs/development/INCONSISTENCY_REPORT.md`

### 2. 自動修正スクリプト

```bash
pnpm run consistency:fix
```

**修正内容:**

- Prismaスキーマ不整合の自動修正
- 型定義の重複削除（共有型に置換）
- ハードコード設定値の一元管理への置換

**バックアップ:** `/tmp/prance-backup-<timestamp>`

### 3. 型整合性検証

```bash
pnpm run consistency:validate
```

**検証項目:**

- Prisma Client生成状態
- 共有型パッケージビルド状態
- TypeScriptコンパイルエラー
- 環境変数の整合性
- 依存関係の整合性
- Git状態（スキーマ変更検出）

### 4. 環境変数検証

```bash
pnpm run env:validate
```

**検証項目:**

- DATABASE_URLがAWS RDS接続か
- 必須環境変数の存在確認
- フロントエンド設定の整合性

---

## 🚨 トラブルシューティング

### Q1: 「Prisma Clientが古い」エラー

```bash
# 解決方法
cd packages/database
pnpm exec prisma generate
cd ../..
pnpm run build
```

### Q2: 「共有型がimportできない」エラー

```bash
# 解決方法
cd packages/shared
pnpm run build
cd ../..
pnpm install
```

### Q3: 「型定義が重複している」警告

```bash
# 自動修正
pnpm run consistency:fix

# または手動で修正
# 1. 重複定義を削除
# 2. import type { ... } from '@prance/shared'; を追加
```

### Q4: Lambda関数で「500エラー」が発生

```bash
# 原因1: マイグレーション未実行
aws lambda invoke --function-name prance-db-migration-dev \
  --payload '{}' /tmp/migration-result.json

# 原因2: 環境変数が未設定
./scripts/validate-env.sh
cd infrastructure
./deploy.sh dev

# 原因3: Prisma Client再生成が必要
cd packages/database
pnpm exec prisma generate
cd ../../infrastructure
pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
```

---

## 📝 チェックリスト

### 新機能実装時

- [ ] 共有型パッケージの既存型を確認
- [ ] Prismaスキーマと命名を一致
- [ ] ハードコードを避け、デフォルト値を使用
- [ ] `pnpm run consistency:validate` を実行
- [ ] `pnpm run typecheck` を実行
- [ ] `pnpm run lint` を実行

### コミット前

- [ ] `pnpm run pre-commit` を実行
- [ ] git diff で変更内容を確認
- [ ] コミットメッセージに変更内容を明記

### デプロイ前

- [ ] `pnpm run build` を実行
- [ ] `pnpm run test` を実行
- [ ] Lambda関数をデプロイ
- [ ] DBマイグレーションを実行
- [ ] 動作確認（health check）

---

## 🎓 まとめ

**このガイドラインを守ることで:**

1. ✅ **型の不整合を予防** - 単一の真実の源
2. ✅ **スキーマの不整合を予防** - Prismaスキーマ準拠
3. ✅ **命名の不整合を予防** - 命名規則の厳守
4. ✅ **設定値の重複を予防** - 一元管理
5. ✅ **自動検証で早期発見** - CI/CD統合

**覚えておくべき3つのコマンド:**

```bash
pnpm run consistency:validate  # 整合性検証
pnpm run consistency:check     # 不整合検出
pnpm run consistency:fix       # 自動修正
```

---

**最終更新:** 2026-03-07
**次回レビュー:** Phase 2完了時
