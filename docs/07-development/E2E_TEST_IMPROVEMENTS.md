# E2E Test Improvements - Analysis & Action Plan

**作成日:** 2026-03-22
**ステータス:** In Progress
**優先度:** 🔴 HIGH

---

## 📊 現状分析

### テスト成功率

| テストスイート | 成功率 | 備考 |
|--------------|--------|------|
| auth-login.spec.ts | 4/4 (100%) | ✅ 完全動作 |
| basic-ui.spec.ts | 5/5 (100%) | ✅ 完全動作（推定） |
| phase1.6.1-integration.spec.ts | 0/16 (0%) | ❌ **全テスト失敗** |
| **Total** | **9/25 (36%)** | ⚠️ **大幅改善必要** |

### 🔴 主要な問題

#### 1. URL/ルート不整合

**問題:**
- テストは `/sessions/new` にナビゲートしているが、実際のURLは `/dashboard/sessions/new`
- テストは認証後 `**/dashboard` へのリダイレクトを期待しているが、タイムアウト発生

**影響:**
- Phase 1.6.1のすべてのテスト（16テスト）
- セッション作成フロー

**修正済み:**
- ✅ `LoginPage.login()` にリダイレクト待機を追加
- ✅ `loginAndWaitForDashboard()` メソッド追加
- ✅ `beforeEach` を修正してより信頼性の高い待機戦略を使用

**修正必要:**
- ❌ すべての `page.goto('/sessions/new')` を `/dashboard/sessions/new` に変更
- ❌ Page Objectパターンを使用してURLをカプセル化

#### 2. UI構造の不整合

**問題:**
- テストは `[data-testid="scenario-select"]` ドロップダウンを期待
- 実際の実装はマルチステップフォーム（Scenario → Avatar → Options）
- セレクタが実装と一致しない

**影響:**
- セッション作成関連のすべてのテスト
- Scenario/Avatar選択ロジック

**修正必要:**
- ❌ 実際の実装に合わせてセレクタを更新
- ❌ マルチステップフォームナビゲーションのPage Objectを作成
- ❌ data-testid属性をフロントエンドに追加（必要に応じて）

#### 3. 固定待機時間（Flaky Tests）

**問題:**
- `await page.waitForTimeout(5000)` などの固定待機を使用
- ネットワーク遅延やシステム負荷で失敗する可能性

**影響:**
- テストの信頼性
- CI/CD環境での成功率

**修正済み:**
- ✅ 4箇所の `waitForTimeout` を動的待機に変更
- ✅ `waitForFunction` を使用して条件ベースの待機を実装
- ✅ `waitForSelector` でUI要素の表示を待機

#### 4. 認証フィクスチャの不整合

**問題:**
- 一部のテストで異なる認証情報を使用
- フォールバック値が古い

**影響:**
- テスト間の一貫性
- デバッグの困難さ

**修正済み:**
- ✅ デフォルト認証情報を `admin@prance.com` に統一

---

## 🎯 修正アクションプラン

### Phase 1: 緊急修正（優先度: HIGH）

#### Task 1.1: URL修正

```typescript
// Before
await page.goto('/sessions/new');

// After
await page.goto('/dashboard/sessions/new');
```

**影響範囲:** 16テスト
**推定時間:** 10分

#### Task 1.2: セレクタ修正

実装を確認して正しいセレクタに更新：

```typescript
// Before
await page.click('[data-testid="scenario-select"]');
await page.click('[data-testid="scenario-option"]:first-child');

// After（推定 - 要確認）
await page.click('[data-testid="scenario-card"]:first-child');
await page.click('[data-testid="next-button"]');
```

**影響範囲:** 16テスト
**推定時間:** 30分

#### Task 1.3: Page Object作成

`NewSessionPage` クラスを作成：

```typescript
export class NewSessionPage {
  async goto() {
    await this.page.goto('/dashboard/sessions/new');
    await this.page.waitForLoadState('networkidle');
  }

  async selectScenario(index = 0) {
    await this.page.click(`[data-testid="scenario-card"]:nth-child(${index + 1})`);
    await this.page.click('[data-testid="next-step"]');
  }

  async selectAvatar(index = 0) {
    await this.page.click(`[data-testid="avatar-card"]:nth-child(${index + 1})`);
    await this.page.click('[data-testid="next-step"]');
  }

  async startSession() {
    await this.page.click('[data-testid="start-session"]');
  }
}
```

**影響範囲:** すべてのセッション関連テスト
**推定時間:** 1時間

### Phase 2: テスト安定性向上（優先度: MEDIUM）

#### Task 2.1: リトライロジック追加

```typescript
// playwright.config.ts
{
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  }
}
```

#### Task 2.2: タイムアウト最適化

```typescript
// テストごとのタイムアウト設定
test('long running test', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes for this specific test
});
```

#### Task 2.3: エラーハンドリング強化

```typescript
try {
  await page.click('[data-testid="button"]');
} catch (error) {
  // Take screenshot on failure
  await page.screenshot({ path: `error-${Date.now()}.png` });
  throw error;
}
```

### Phase 3: テストカバレッジ拡張（優先度: LOW）

#### Task 3.1: Phase 1.6.1機能の完全カバレッジ

- [ ] SessionError logging verification
- [ ] Fallback response testing
- [ ] Turn limit enforcement
- [ ] Scenario cache validation

#### Task 3.2: エッジケーステスト

- [ ] Network failure simulation
- [ ] Concurrent session handling
- [ ] Large file upload/download
- [ ] Browser compatibility (Firefox, WebKit)

---

## 🔧 実装済み改善

### ✅ LoginPage改善

**変更内容:**
```typescript
// 新しいメソッド追加
async loginAndWaitForDashboard(email: string, password: string) {
  await this.login(email, password, true);
  await this.page.waitForSelector('[data-testid="dashboard-header"], h1', { timeout: 10000 });
}

// login() にナビゲーション待機を追加
await this.page.waitForURL('**/dashboard**', { timeout: 30000 });
await this.page.waitForLoadState('networkidle', { timeout: 10000 });
```

**効果:**
- ログイン後のリダイレクト待機の信頼性向上
- タイムアウトの適切な設定
- ネットワークアイドル待機の追加

### ✅ 動的待機戦略

**Before:**
```typescript
await page.waitForTimeout(5000); // 固定5秒待機
```

**After:**
```typescript
// 条件ベースの動的待機
await page.waitForFunction(
  (selector, initial) => {
    const el = document.querySelector(selector);
    return el && el.textContent !== initial;
  },
  selector,
  initialValue,
  { timeout: 15000 }
);
```

**修正箇所:**
- 4箇所の `waitForTimeout` を動的待機に変更
- チャンクカウント変更待機
- 録画統計更新待機
- AI メッセージ待機

---

## 📈 期待される改善効果

### テスト成功率

| 修正フェーズ | 期待成功率 | 備考 |
|------------|----------|------|
| 現状 | 36% (9/25) | ベースライン |
| Phase 1完了後 | 80% (20/25) | URL/セレクタ修正 |
| Phase 2完了後 | 95% (23.75/25) | リトライ・安定性向上 |
| Phase 3完了後 | 100% (25/25) | 完全カバレッジ |

### 実行時間

- **現状:** ~5分（多くのタイムアウト待機）
- **改善後:** ~3分（動的待機、並列実行）

### メンテナンス性

- Page Objectパターンによる保守性向上
- URLのカプセル化
- 再利用可能なヘルパーメソッド

---

## 🚀 次のステップ

### 即座に実行

1. ✅ URL修正（`/sessions/new` → `/dashboard/sessions/new`）
2. ✅ NewSessionPage Page Object作成
3. ✅ セレクタ修正（実装確認後）

### 短期（今週）

4. リトライロジック追加
5. テスト実行・検証
6. ドキュメント更新（README.md）

### 中期（来週）

7. エッジケーステスト追加
8. CI/CD統合
9. テストレポート自動生成

---

## 📚 参考リソース

### プロジェクトドキュメント

- [apps/web/tests/e2e/README.md](../../apps/web/tests/e2e/README.md) - E2Eテストガイド
- [apps/CLAUDE.md](../../apps/CLAUDE.md) - フロントエンド開発ガイド

### Playwright公式

- [Best Practices](https://playwright.dev/docs/best-practices)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Page Object Model](https://playwright.dev/docs/pom)

---

**最終更新:** 2026-03-22
**次回レビュー:** テスト修正完了後
**担当:** Development Team
