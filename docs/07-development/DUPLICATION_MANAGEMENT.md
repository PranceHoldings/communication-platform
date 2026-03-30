# 重複管理ガイドライン（Duplication Management Guidelines）

**作成日:** 2026-03-22
**最終更新:** 2026-03-22
**ステータス:** ✅ アクティブ（自動検証有効）

---

## 📋 目次

1. [概要](#概要)
2. [8段階検証システム](#8段階検証システム)
3. [検証項目詳細](#検証項目詳細)
4. [自動検証の仕組み](#自動検証の仕組み)
5. [エラー対処方法](#エラー対処方法)
6. [ベストプラクティス](#ベストプラクティス)

---

## 概要

### 目的

AIコード生成環境において、複数のファイル間で同じ設定・型・処理が重複することは避けられません。本ガイドラインは：

- **重複を早期検出** - コミット前・デプロイ前に自動チェック
- **一元管理を強制** - Single Source of Truth (SSOT) 原則の徹底
- **保守性向上** - 設定変更が1箇所で完結

### 基本原則

```
❌ 禁止: 同じ設定・型・処理を複数ファイルに記述
✅ 推奨: 1箇所で定義 → 全体で import して使用
```

---

## 8段階検証システム

### 検証フロー

```
Commit/Deploy
    ↓
[1/8] Environment Variable Duplication Check
    ↓
[2/8] Type Definition Duplication Check
    ↓
[3/8] Enum Synchronization Check
    ↓
[4/8] Constants/Configuration Duplication
    ↓
[5/8] Utility Function Duplication
    ↓
[6/8] Validation Logic Duplication
    ↓
[7/8] Frontend API Call Duplication
    ↓
[8/8] Lambda Function Duplicate Implementation
    ↓
✅ Pass → Proceed
❌ Fail → Block (Exit code 1)
```

### 実行方法

```bash
# 手動実行
bash scripts/validate-duplication.sh

# Git pre-commit hook（自動実行）
git commit -m "..."  # 自動的に検証される

# デプロイ前（自動実行）
cd infrastructure && npm run deploy:lambda  # 自動的に検証される
```

---

## 検証項目詳細

### [1/8] Environment Variable Duplication Check

**目的:** 環境変数アクセスを `infrastructure/lambda/shared/config/index.ts` に集約

**許可される例外:**

- `AWS_LAMBDA_FUNCTION_NAME` - Lambda runtime変数
- `NODE_ENV` - Node.js標準変数
- `defaults.ts` 内のアクセス（設定ファイル自体）
- 特定ユーティリティ（prisma.ts, elasticache-client.ts等）

**検出例:**

```typescript
// ❌ 禁止（直接アクセス）
const region = process.env.AWS_REGION || 'us-east-1';

// ✅ 正しい（centralized config経由）
import { getAwsRegion } from '../../shared/config';
const region = getAwsRegion();
```

**エラーメッセージ:**

```
❌ Found 9 direct process.env accesses (should use centralized config)
infrastructure/lambda/websocket/default/index.ts:57
infrastructure/lambda/websocket/connect/index.ts:13
...
```

**対処方法:**

1. `infrastructure/lambda/shared/config/index.ts` に getter 関数追加
2. 該当ファイルで `import { getXxx }` してアクセス

---

### [2/8] Type Definition Duplication Check

**目的:** 型定義の重複を防止、packages/shared → Lambda への一方向参照を維持

**検出対象:**

- `EmotionScore`, `AgeRange`, `Pose` - packages/shared と Lambda で重複定義
- `OrganizationSettings` - packages/shared と Lambda で定義不一致

**検出例:**

```typescript
// ❌ 禁止（Lambda側で再定義）
// infrastructure/lambda/shared/analysis/rekognition.ts
export interface EmotionScore {
  type: string;
  confidence: number;
}

// ✅ 正しい（packages/shared または Lambda shared types から import）
import type { EmotionScore } from '../types';
```

**エラーメッセージ:**

```
❌ EmotionScore defined in rekognition.ts (should import from types/index.ts)
❌ OrganizationSettings inconsistent: initialSilenceTimeout mismatch
```

**対処方法:**

1. Lambda側の重複定義を削除
2. `infrastructure/lambda/shared/types/index.ts` から import
3. フィールド不一致は Prisma schema → packages/shared → Lambda の順で修正

---

### [3/8] Enum Synchronization Check

**目的:** packages/shared と Lambda の Enum 定義を同期

**背景:**

Lambda bundling の制約により、`infrastructure/lambda/shared/types/index.ts` は packages/shared の Enum を**手動で複製**しています。

```typescript
// infrastructure/lambda/shared/types/index.ts
// Note: @prance/shared cannot be imported in Lambda bundling context
export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';
```

**検出例:**

```
❌ UserRole enum mismatch between packages/shared and infrastructure/lambda/shared
```

**対処方法:**

1. packages/shared に新しい Enum 値を追加した場合、Lambda側も更新
2. 両方のファイルで定義が完全一致していることを確認

---

### [4/8] Constants/Configuration Duplication

**目的:** 定数・設定値を `infrastructure/lambda/shared/config/defaults.ts` に集約

**集約対象:**

- AWS サービス設定（BEDROCK_DEFAULTS, REKOGNITION_DEFAULTS等）
- 言語設定（LANGUAGE_DEFAULTS）
- メディア形式（MEDIA_DEFAULTS）
- タイムアウト・リトライ設定

**検出例:**

```
⚠️  Expected 15+ constant groups, found 10
```

**対処方法:**

- ハードコードされた定数を defaults.ts に移動
- 環境変数でオーバーライド可能にする

---

### [5/8] Utility Function Duplication

**目的:** ユーティリティ関数を `infrastructure/lambda/shared/utils/` に集約

**許可される例外:**

- `websocket/default/chunk-utils.ts` - WebSocket専用（S3チャンクアップロード）

**検出例:**

```
⚠️  Found 3 utility files outside shared/utils (verify they're not duplicates)
infrastructure/lambda/sessions/utils.ts
infrastructure/lambda/avatars/helpers.ts
...
```

**対処方法:**

1. 同じ処理が shared/utils/ に存在しないか確認
2. 存在する場合は削除、import に変更
3. 存在しない場合は shared/utils/ に移動

---

### [6/8] Validation Logic Duplication

**目的:** バリデーションロジックを shared/ に集約

**集約ファイル:**

- `shared/utils/validation.ts` - 汎用バリデーション
- `shared/utils/env-validator.ts` - 環境変数バリデーション
- `shared/scenario/validator.ts` - シナリオ特化バリデーション

**検出例:**

```
⚠️  Expected 3 validation files, found 1
```

**対処方法:**

- 各Lambda関数内のバリデーションを shared/ に抽出
- 再利用可能な形に抽象化

---

### [7/8] Frontend API Call Duplication

**目的:** Frontend の API 呼び出しを `apps/web/lib/api/` に集約

**禁止パターン:**

```typescript
// ❌ 禁止（直接 fetch）
const response = await fetch('/api/v1/sessions');
const data = await response.json();

// ✅ 正しい（API client 経由）
import { listSessions } from '@/lib/api/sessions';
const response = await listSessions();
```

**検出例:**

```
❌ Found 5 direct fetch() calls (should use API client)
apps/web/app/dashboard/page.tsx:42
apps/web/components/SessionList.tsx:28
...
```

**対処方法:**

1. `apps/web/lib/api/` 配下に API client 関数を作成
2. 直接 fetch() を使用しているコードを置き換え

---

### [8/8] Lambda Function Duplicate Implementation

**目的:** Lambda関数間で共通処理を shared/ に抽出

**必須ディレクトリ構造:**

```
infrastructure/lambda/shared/
├── config/       # 設定・定数
├── utils/        # ユーティリティ関数
├── types/        # 型定義
├── analysis/     # 解析処理
├── scenario/     # シナリオ処理
└── auth/         # 認証処理
```

**検出例:**

```
❌ Missing shared/config directory
```

**対処方法:**

- 必須ディレクトリを作成
- 各Lambda関数から共通処理を抽出

---

## 自動検証の仕組み

### Pre-commit Hook

**ファイル:** `scripts/git-hooks/pre-commit`

```bash
# Check 6: Duplication Management Validation (2026-03-22)
echo -e "${YELLOW}[6/7]${NC} Validating duplication management..."
if bash scripts/validate-duplication.sh > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Duplication validation passed${NC}"
else
  echo -e "${RED}❌ Duplication validation failed${NC}"
  bash scripts/validate-duplication.sh
  exit 1
fi
```

**動作:**

1. `git commit` 実行
2. Pre-commit hook が自動起動
3. `validate-duplication.sh` 実行
4. エラーがあれば commit をブロック（Exit code 1）

### Deploy Process

**ファイル:** `infrastructure/scripts/deploy.sh`

```bash
# Duplication validation (2026-03-22)
echo "Running duplication validation..."
bash ../../scripts/validate-duplication.sh
if [ $? -ne 0 ]; then
  echo "❌ Duplication validation failed. Deploy aborted."
  exit 1
fi
```

**動作:**

1. `npm run deploy:lambda` 実行
2. デプロイスクリプトが検証実行
3. エラーがあれば deploy をブロック

---

## エラー対処方法

### よくあるエラー

#### Error 1: 環境変数の直接アクセス

**エラー:**

```
❌ Found 9 direct process.env accesses (should use centralized config)
websocket/default/index.ts:57: const BEDROCK_REGION = process.env.BEDROCK_REGION || AWS_REGION;
```

**解決手順:**

1. `infrastructure/lambda/shared/config/index.ts` に追加:

```typescript
export function getBedrockRegion(): string {
  return getRequiredEnv('BEDROCK_REGION');
}
```

2. Lambda関数で使用:

```typescript
import { getBedrockRegion } from '../../shared/config';
const BEDROCK_REGION = getBedrockRegion();
```

#### Error 2: 型定義の重複

**エラー:**

```
❌ EmotionScore defined in rekognition.ts (should import from types/index.ts)
```

**解決手順:**

1. `infrastructure/lambda/shared/analysis/rekognition.ts` から削除:

```typescript
// 削除
// export interface EmotionScore {
//   type: string;
//   confidence: number;
// }
```

2. Import 追加:

```typescript
import type { EmotionScore } from '../types';
```

#### Error 3: Enum 不一致

**エラー:**

```
❌ UserRole enum mismatch between packages/shared and infrastructure/lambda/shared
```

**解決手順:**

1. `packages/shared/src/types/index.ts` の定義を確認
2. `infrastructure/lambda/shared/types/index.ts` を同じ値に更新

```typescript
// Before
export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER';

// After (GUEST 追加)
export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST';
```

---

## ベストプラクティス

### 1. 新規設定値追加時

```typescript
// ❌ 直接ハードコード
const MAX_RETRIES = 3;

// ✅ defaults.ts に追加
// infrastructure/lambda/shared/config/defaults.ts
export const RETRY_DEFAULTS = {
  MAX_RETRIES: 3,
};

// Lambda関数
import { RETRY_DEFAULTS } from '../../shared/config/defaults';
const maxRetries = RETRY_DEFAULTS.MAX_RETRIES;
```

### 2. 新規型定義追加時

```typescript
// ❌ Lambda関数内で定義
interface MyNewType {
  id: string;
  name: string;
}

// ✅ Lambda shared types に追加
// infrastructure/lambda/shared/types/index.ts
export interface MyNewType {
  id: string;
  name: string;
}

// Lambda関数
import type { MyNewType } from '../../shared/types';
```

### 3. 新規ユーティリティ関数追加時

```typescript
// ❌ Lambda関数内で定義
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ✅ shared/utils に追加
// infrastructure/lambda/shared/utils/date-formatter.ts
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Lambda関数
import { formatDate } from '../../shared/utils/date-formatter';
```

### 4. Enum 追加時

**必須手順:**

1. **Prisma schema に追加** (Single Source of Truth)
2. **packages/shared に追加** (Frontend用)
3. **infrastructure/lambda/shared/types に追加** (Lambda用)

```prisma
// packages/database/prisma/schema.prisma
enum MyNewEnum {
  VALUE_A
  VALUE_B
}
```

```typescript
// packages/shared/src/types/index.ts
export type MyNewEnum = 'VALUE_A' | 'VALUE_B';
```

```typescript
// infrastructure/lambda/shared/types/index.ts
export type MyNewEnum = 'VALUE_A' | 'VALUE_B';
```

---

## 関連ドキュメント

- [CODING_RULES.md - Rule 10](../../CODING_RULES.md#rule-10-重複管理原則) - 重複管理原則
- [ENV_VAR_SINGLE_SOURCE_OF_TRUTH.md](ENV_VAR_SINGLE_SOURCE_OF_TRUTH.md) - 環境変数SSOT
- [HARDCODE_ELIMINATION_REPORT.md](HARDCODE_ELIMINATION_REPORT.md) - ハードコード削除記録
- [memory/duplication-management.md](../../memory/duplication-management.md) - AI用メモリ

---

**最終更新:** 2026-03-22
**次回レビュー:** Phase 1.6.1完了後
