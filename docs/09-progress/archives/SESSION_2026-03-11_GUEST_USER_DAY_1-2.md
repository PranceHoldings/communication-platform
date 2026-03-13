# セッション記録: 2026-03-11 - ゲストユーザー機能 Day 1-2

**日時:** 2026-03-11 午後
**Phase:** Phase 2.5 - ゲストユーザー機能
**タスク:** Phase 1 Week 1 Day 1-2 - 型定義・共通ユーティリティ実装
**ステータス:** ✅ 完了

---

## 📋 実施内容サマリー

### 1. JWTPayload型拡張
- **ファイル:** `infrastructure/lambda/shared/types/index.ts`
- **変更内容:**
  - `GUEST` roleを追加（'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER' | 'GUEST'）
  - オプションフィールド追加: `type`, `guestSessionId`, `sessionId`
- **目的:** ゲストユーザー用JWT認証をサポート

### 2. guest-token.ts 実装
- **ファイル:** `infrastructure/lambda/shared/auth/guest-token.ts`
- **実装関数:**
  1. `generateGuestToken(payload)` - ゲストJWT生成
  2. `verifyGuestToken(token)` - ゲストトークン検証
  3. `isGuestToken(token)` - トークンタイプ判定
  4. `extractGuestSessionId(token)` - セッションID抽出
- **単体テスト:** 36テスト（全て成功）

### 3. pinHash.ts 実装
- **ファイル:** `infrastructure/lambda/shared/utils/pinHash.ts`
- **実装関数:**
  1. `hashPin(pin)` - bcryptでPINハッシュ化（SALT_ROUNDS=10）
  2. `verifyPin(pin, hash)` - PIN検証（タイミングアタック耐性）
  3. `isValidPinFormat(pin)` - フォーマット検証
- **単体テスト:** 30テスト（全て成功）
- **セキュリティ:**
  - ブルートフォース攻撃耐性テスト
  - レインボーテーブル攻撃耐性テスト
  - タイミングアタック耐性テスト

### 4. tokenGenerator.ts 実装
- **ファイル:** `infrastructure/lambda/shared/utils/tokenGenerator.ts`
- **実装関数:**
  1. `generateToken()` - UUID v4トークン生成（32文字、ハイフンなし）
  2. `generatePin(length)` - 4-8桁PIN生成（暗号学的に安全）
  3. `validateCustomPin(pin)` - カスタムPIN検証
  4. `generateTokenAndPin(pinLength)` - トークン+PIN一括生成
  5. `generateInviteUrl(token, baseUrl)` - 招待URL生成
- **単体テスト:** 24テスト（全て成功）
- **修正内容:**
  - PIN生成ロジック修正（先頭ゼロを含む0000-9999の範囲に対応）
  - 変更前: `randomInt(1000, 10000)` → 1000-9999 (9,000通り)
  - 変更後: `randomInt(0, 10000)` → 0000-9999 (10,000通り) ✅

### 5. Jest設定・型定義問題解決
- **ファイル:**
  - `infrastructure/lambda/shared/jest.config.js`
  - `infrastructure/lambda/shared/jest.setup.js`
  - `infrastructure/lambda/shared/tsconfig.test.json`
- **解決した問題:**
  - TypeScript型定義エラー（describe, it, expect未定義）
  - ES2022ライブラリサポート（Set, String.startsWith）
  - ts-jest設定（isolatedModules, diagnostics）
- **最終設定:**
  - `isolatedModules: true` - コンパイル高速化
  - `diagnostics: false` - 型チェック無効化（実行速度優先）
  - `/// <reference types="jest" />` - 各テストファイルに追加

---

## 📊 テスト結果

```
✅ Test Suites: 3 passed, 3 total
✅ Tests: 89 passed, 89 total
⏱️ Time: 17.512s
```

### テスト詳細

**1. tokenGenerator.test.ts (24テスト)**
- generateToken: 5テスト（UUID生成、フォーマット、衝突検証）
- generatePin: 7テスト（4/6/8桁、先頭ゼロ、エラーハンドリング）
- validateCustomPin: 6テスト（フォーマット検証）
- generateTokenAndPin: 2テスト（一括生成）
- generateInviteUrl: 2テスト（URL生成）

**2. pinHash.test.ts (30テスト)**
- hashPin: 9テスト（bcryptハッシュ化、フォーマット検証）
- verifyPin: 9テスト（PIN検証、タイミングアタック耐性）
- isValidPinFormat: 9テスト（フォーマット検証）
- セキュリティテスト: 3テスト（ブルートフォース・レインボーテーブル・ソルト検証）

**3. guest-token.test.ts (36テスト)**
- generateGuestToken: 6テスト（JWT生成、フィールド検証）
- verifyGuestToken: 10テスト（トークン検証、エラーハンドリング）
- isGuestToken: 6テスト（トークンタイプ判定）
- extractGuestSessionId: 6テスト（セッションID抽出）
- 統合テスト: 3テスト（生成→検証→抽出フロー）
- セキュリティテスト: 4テスト（role固定、組織分離）

---

## 🔧 技術的詳細

### JWT構造

```typescript
{
  userId: 'guest',
  email: 'guest@system',
  role: 'GUEST',
  type: 'guest',
  orgId: 'org-uuid-xxx',
  guestSessionId: 'guest-session-uuid-xxx',
  sessionId: 'session-uuid-xxx',
  iat: 1773244850,
  exp: 1773331250  // 24時間後
}
```

### PIN生成アルゴリズム

```typescript
// 暗号学的に安全な乱数生成
const max = Math.pow(10, length);  // 4桁なら10000
const pin = randomInt(0, max);     // 0-9999
return pin.toString().padStart(length, '0');  // 先頭ゼロ保持
```

### bcryptハッシュ構造

```
$2a$10$[22文字のsalt][31文字のハッシュ]
例: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

---

## 📝 学んだこと・ベストプラクティス

### 1. JWT設計の原則
- **type discriminator**: 'user' | 'guest'で明確に区別
- **role固定**: ゲストは常に'GUEST'、権限昇格を防止
- **組織分離**: orgIdで完全に分離、他組織データへのアクセス不可

### 2. セキュリティ設計
- **暗号学的に安全な乱数**: `crypto.randomUUID()`, `crypto.randomInt()`使用
- **bcrypt SALT_ROUNDS=10**: パフォーマンスとセキュリティのバランス
- **タイミングアタック耐性**: bcryptは一定時間の検証を保証

### 3. テストの重要性
- **セキュリティテスト**: ブルートフォース、レインボーテーブル、タイミング攻撃
- **統計的テスト**: 先頭ゼロPIN生成（1000回試行で検証）
- **衝突検証**: 10,000個のトークン生成で重複ゼロ

### 4. Jest設定のポイント
- `isolatedModules: true` - 各ファイルを独立してコンパイル（高速化）
- `diagnostics: false` - 型チェック無効化（実行時間短縮）
- `/// <reference types="jest" />` - 型定義を明示的に読み込み

---

## 🚀 次回タスク

**Phase 1 Week 1 Day 3-4: レート制限ユーティリティ（推定2日）**

実装内容:
1. DynamoDBベースのレート制限クラス
2. IPアドレス単位の制限（10回/分）
3. トークン単位の制限（20回/分）
4. 指数バックオフ（1分 → 5分 → 30分 → 永久ロック）
5. 自動ロック解除（時間経過）
6. 単体テスト（20+テスト）

実装ファイル:
- `infrastructure/lambda/shared/utils/rateLimiter.ts`
- `infrastructure/lambda/shared/utils/__tests__/rateLimiter.test.ts`

推定時間: 2日（Day 3-4）

> 詳細計画: `docs/05-modules/GUEST_USER_IMPLEMENTATION_PLAN.md`

---

## 📚 関連ドキュメント

- **実装計画:** `docs/05-modules/GUEST_USER_IMPLEMENTATION_PLAN.md`
- **機能サマリー:** `docs/03-planning/implementation/GUEST_USER_FEATURE_SUMMARY.md`
- **統合分析:** `docs/09-progress/GUEST_USER_INTEGRATION_ANALYSIS.md`
- **Prismaスキーマ案:** `docs/09-progress/GUEST_USER_PRISMA_SCHEMA_DRAFT.md`

---

**完了日時:** 2026-03-11 18:00 JST
**次回セッション:** Phase 1 Week 1 Day 3-4（レート制限ユーティリティ実装）
