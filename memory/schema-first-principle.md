# Schema-First Development Principle

**最終更新:** 2026-03-22 (Day 36)
**重要度:** 🔴 CRITICAL

---

## 🎯 Three-Layer Architecture Rule

```
┌─────────────────────────────────────────────┐
│  Layer 1: Schema (Single Source of Truth)  │ ← Prismaスキーマ
└────────────────┬────────────────────────────┘
                 │ generates
                 ▼
┌─────────────────────────────────────────────┐
│  Layer 2: Interface (Type Definitions)      │ ← packages/shared
└────────────────┬────────────────────────────┘
                 │ implements
                 ▼
┌─────────────────────────────────────────────┐
│  Layer 3: Implementation (Backend/Frontend) │ ← Lambda/Frontend
└─────────────────────────────────────────────┘
```

**絶対厳守:** スキーマ・ファースト → インターフェース・セカンド → 実装・サード

---

## 🔴 Critical Rule: No Manual Mapping

### ❌ 絶対禁止（今回の失敗例）

```typescript
// Lambda関数で勝手にフィールド名変更
avatar: {
  ...session.avatar,
  imageUrl: session.avatar.thumbnailUrl, // ❌ 手動マッピング禁止
}
```

**問題点:**
1. Prismaスキーマと不一致（`thumbnailUrl` が正しい）
2. packages/shared 型定義と不一致
3. 型安全性が失われる
4. 保守性が低下（複数箇所で同じマッピング）

### ✅ 正しい方法

```typescript
// Lambda関数はPrismaの結果をそのまま返す
avatar: session.avatar, // ✅ スキーマ通り
```

---

## 📋 Development Workflow

### 1. スキーマ変更時の手順

```bash
# Step 1: Prismaスキーマ変更
vim packages/database/prisma/schema.prisma

# Step 2: マイグレーション生成
cd packages/database
npx prisma migrate dev --name add_new_field

# Step 3: Prisma Client再生成
npx prisma generate

# Step 4: packages/shared 型定義更新（手動）
vim packages/shared/src/types/index.ts
# Prismaスキーマと完全一致させる

# Step 5: 検証スクリプト実行（自動化）
bash scripts/validate-schema-interface-implementation.sh

# Step 6: Lambda関数・Frontend実装
# packages/shared から型をimportして使用

# Step 7: デプロイ
cd infrastructure
npm run deploy:dev-migration
```

### 2. 型定義追加時の手順

```bash
# Step 1: Prismaスキーマ確認
cat packages/database/prisma/schema.prisma | grep -A 20 "model Avatar"

# Step 2: packages/shared に型定義追加（Prismaと完全一致）
vim packages/shared/src/types/index.ts

# Step 3: 検証
bash scripts/validate-schema-interface-implementation.sh

# Step 4: Lambda/Frontend で使用
import type { Avatar } from '@prance/shared';
```

---

## 🔍 Validation Rules

### Rule 1: Field Name Consistency

**検証項目:**
- Prismaスキーマのフィールド名（snake_case, camelCase）
- packages/shared の型定義フィールド名（camelCase）
- Lambda レスポンスフィールド名（camelCase）
- Frontend 使用箇所のフィールド名（camelCase）

**例: Avatar model**

```prisma
// packages/database/prisma/schema.prisma
model Avatar {
  thumbnailUrl String? @map("thumbnail_url")  // ← DB: snake_case
}
```

```typescript
// packages/shared/src/types/index.ts
export interface Avatar {
  thumbnailUrl?: string;  // ← TypeScript: camelCase
}
```

```typescript
// infrastructure/lambda/sessions/list/index.ts
avatar: session.avatar,  // ✅ Prismaの結果をそのまま返す（thumbnailUrl）
```

```typescript
// apps/web/app/dashboard/page.tsx
session.avatar?.thumbnailUrl  // ✅ packages/shared の型を使用
```

### Rule 2: No Extra Fields

**禁止事項:**
- Lambda関数で勝手にフィールド追加
- Frontend で存在しないフィールド参照

**検証方法:**
```bash
# Lambda関数で手動マッピング検出
grep -rn "imageUrl:.*thumbnailUrl" infrastructure/lambda --include="*.ts"
# 期待結果: 0件

# Frontend で未定義フィールド使用検出
grep -rn "\.imageUrl" apps/web --include="*.tsx" --include="*.ts" | grep -v "thumbnailUrl"
# 期待結果: 0件（AvatarRenderer等の内部実装を除く）
```

### Rule 3: Type Import from packages/shared

**強制事項:**
- Lambda関数・Frontend は必ず packages/shared から型をimport
- インライン型定義禁止

**検証方法:**
```bash
# インライン型定義検出
grep -rn "interface Avatar {" infrastructure/lambda apps/web --include="*.ts" --exclude="packages/shared"
# 期待結果: 0件

# packages/shared import確認
grep -rn "from '@prance/shared'" infrastructure/lambda --include="*.ts" -c
# 期待結果: 20+ files
```

---

## 🛠️ Automated Validation Script

**スクリプト:** `scripts/validate-schema-interface-implementation.sh`

**検証内容:**
1. Prismaスキーマ解析（フィールド名・型抽出）
2. packages/shared 型定義比較
3. Lambda関数レスポンス検証（手動マッピング検出）
4. Frontend 使用箇所検証（未定義フィールド参照検出）
5. 型import検証（packages/shared から import しているか）

**実行タイミング:**
- ✅ Pre-commit hook（git commit前）
- ✅ CDK deploy前（infrastructure/scripts/cdk-wrapper.sh）
- ✅ CI/CD pipeline（GitHub Actions）

---

## 📊 Validation Report Example

```
============================================
Schema-First Validation Report
============================================

[1/5] Prisma Schema Analysis
  ✓ Avatar model: 13 fields extracted
  ✓ Session model: 11 fields extracted
  ✓ Scenario model: 16 fields extracted

[2/5] Type Definition Comparison
  ✓ Avatar: 13/13 fields match
  ✓ Session: 11/11 fields match
  ✓ Scenario: 16/16 fields match

[3/5] Lambda Response Validation
  ✓ No manual field mapping detected
  ✓ No extra fields in responses

[4/5] Frontend Usage Validation
  ✓ No undefined field references
  ✓ All fields from packages/shared

[5/5] Type Import Validation
  ✓ 44 Lambda functions import from @prance/shared
  ✓ 28 Frontend files import from @prance/shared

============================================
✅ All validations passed
============================================
```

---

## 🚨 Failure Examples (Past Mistakes)

### Mistake 1: Manual Field Mapping (2026-03-22)

**発見:** Lambda関数が `thumbnailUrl` → `imageUrl` に変換
**影響:** Frontend で型エラー、画像表示エラー
**修正:** Lambda関数からマッピング削除、Frontend を `thumbnailUrl` に統一
**教訓:** スキーマに存在しないフィールドは絶対に作らない

### Mistake 2: Inline Type Definition

**発見:** Lambda関数で `type SessionStatus = 'ACTIVE' | 'COMPLETED'` を独自定義
**影響:** Prismaスキーマに `PROCESSING` `ERROR` があるのに使えない
**修正:** packages/shared から import
**教訓:** 型定義は packages/shared のみ

---

## 🔧 Enforcement Tools

### 1. Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running schema-first validation..."
bash scripts/validate-schema-interface-implementation.sh

if [ $? -ne 0 ]; then
  echo "❌ Schema-first validation failed"
  exit 1
fi
```

### 2. CDK Wrapper

```bash
# infrastructure/scripts/cdk-wrapper.sh
echo "[VALIDATION] Running schema-first validation..."
bash ../../scripts/validate-schema-interface-implementation.sh
```

### 3. VSCode Lint Rule

```json
// .eslintrc.json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "TSPropertySignature[key.name=/imageUrl/]",
        "message": "Use 'thumbnailUrl' instead of 'imageUrl' (Prisma schema field name)"
      }
    ]
  }
}
```

---

## 📝 Checklist

### Before Commit

- [ ] Prismaスキーマ変更時は `prisma migrate dev` 実行済み
- [ ] packages/shared 型定義がPrismaと一致している
- [ ] Lambda関数が手動マッピングしていない
- [ ] Frontend が packages/shared から型 import している
- [ ] `bash scripts/validate-schema-interface-implementation.sh` 成功

### Before Deploy

- [ ] Schema-first validation 成功
- [ ] Lambda dependencies validation 成功
- [ ] Environment variables validation 成功

---

## 🎓 Key Principles

1. **Prismaスキーマが唯一の真実の源** - 他の場所で定義しない
2. **packages/shared が型定義の中央管理** - Lambda/Frontend は必ずここから import
3. **Lambda関数は変換しない** - Prismaの結果をそのまま返す
4. **Frontend は型に従う** - packages/shared の型定義通りに使う
5. **自動検証を信頼する** - スクリプトが NG なら必ず修正

---

**最終更新:** 2026-03-22 05:50 UTC
**次回レビュー:** 検証スクリプト実装完了時
