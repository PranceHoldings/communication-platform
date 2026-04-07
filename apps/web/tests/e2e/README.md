# E2E Test Suite

**最終更新:** 2026-03-20
**フレームワーク:** Playwright
**成功率:** 100% (35/35 tests)
**場所:** `apps/web/tests/e2e/`

---

## 📊 テストレベルとスコープ

このディレクトリには**3つのレベル**のテストが含まれています：

### Level 1: UI Component Tests (Stage 0-1)
**スコープ:** フロントエンドのみ
**スタック:** `Browser → Next.js`
**目的:** UIレンダリング、基本的なインタラクション

| テスト | 内容 |
|--------|------|
| stage0-smoke.spec.ts | 基本ページレンダリング |
| stage1-basic-ui.spec.ts | UIコンポーネント動作 |

---

### Level 2: Integration Tests (Stage 2)
**スコープ:** フロントエンド + モックバックエンド
**スタック:** `Browser → Next.js → Mock WebSocket`
**目的:** WebSocketメッセージフロー、状態管理

| テスト | 内容 |
|--------|------|
| stage2-mocked-integration.spec.ts | WebSocketモック統合 |
| stage2-core.spec.ts | 基本統合テスト |
| stage2-extended.spec.ts | 拡張統合テスト |

---

### Level 3: System E2E Tests (Stage 3-5) ⚠️ **全体テスト**
**スコープ:** システム全体
**スタック:** `Browser → Next.js → API Gateway → Lambda → DynamoDB/RDS → S3`
**目的:** エンドツーエンドの完全なシステム検証

| テスト | 内容 | スコープ |
|--------|------|----------|
| **Stage 3: WebSocket統合** | | |
| stage3-real-websocket.spec.ts | 実WebSocket接続（6テスト） | Browser ⇄ WebSocket API ⇄ Lambda |
| stage3-part2-initial-greeting.spec.ts | 初期グリーティング（3テスト） | Browser ⇄ WebSocket ⇄ Lambda ⇄ RDS |
| **Stage 4: 録画機能** | | |
| stage4-recording.spec.ts | 録画・保存・再生 | Browser ⇄ API ⇄ Lambda ⇄ S3 |
| **Stage 5: 解析・レポート** | | |
| stage5-analysis-report.spec.ts | 解析レポート生成 | Browser ⇄ API ⇄ Lambda ⇄ RDS |

**⚠️ 注意:** Stage 3-5は**システム全体のE2Eテスト**です。フロントエンドだけでなく、バックエンド（Lambda、データベース、ストレージ）も含めた完全なスタックをテストします。

---

## 🚀 実行方法

### 全テスト実行（推奨）
```bash
# 全35テスト実行
pnpm run test:e2e

# UIモード（デバッグ向け）
pnpm run test:e2e:ui
```

### レベル別実行
```bash
# UI Tests only (Stage 0-1)
pnpm run test:e2e -- stage0 stage1

# Integration Tests only (Stage 2)
pnpm run test:e2e -- stage2

# System E2E Tests only (Stage 3-5)
pnpm run test:e2e -- stage3 stage4 stage5
```

### 特定のStage実行
```bash
# Stage 3のみ（WebSocket統合）
pnpm run test:e2e -- stage3-real-websocket.spec.ts

# Stage 3 Part 2のみ（初期グリーティング）
pnpm run test:e2e -- stage3-part2-initial-greeting.spec.ts

# 順次実行（リソース節約）
pnpm run test:e2e -- stage3-part2-initial-greeting.spec.ts --workers=1
```

### ヘッドレスモード切り替え
```bash
# ヘッドレス（CI/CD用）
pnpm run test:e2e

# ブラウザ表示
pnpm run test:e2e:headed
```

---

## 📈 現在のテスト成功率

**最終実行:** 2026-03-20
**結果:** 35/35 tests passing (100%) ✅

| Category | Tests | Status |
|----------|-------|--------|
| Day 12 Browser Tests | 10/10 | ✅ |
| Guest User Flow | 15/15 | ✅ |
| WebSocket Voice Conversation | 10/10 | ✅ |
| **Total** | **35/35** | **✅ 100%** |

**Stage別内訳:**
- Stage 0-1 (UI): ✅ 完了
- Stage 2 (Integration): ✅ 完了
- Stage 3 Part 1 (WebSocket): ✅ 完了 (6/6)
- Stage 3 Part 2 (Greeting): ✅ 完了 (3/3)
- Stage 4 (Recording): ✅ 実装済み
- Stage 5 (Analysis): ✅ 実装済み

---

## 🔧 テスト設定

### Playwright設定
```typescript
// playwright.config.ts
{
  testDir: './tests/e2e',
  baseURL: 'http://localhost:3000',
  timeout: 60000,              // テストタイムアウト: 1分
  use: {
    permissions: ['microphone', 'camera'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
  },
}
```

### 環境変数
```bash
# .env.local（必須）
NEXT_PUBLIC_API_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
NEXT_PUBLIC_WEBSOCKET_URL=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
```

---

## 📝 テストデータ

### 認証情報（auth.fixture.ts）
```typescript
{
  email: 'admin@prance.com',
  password: 'Admin2026!Prance',
}
```

### テストセッション（session.fixture.ts）
- **動的取得:** API経由で最新のセッションを取得
- **初期グリーティング:** 専用セッション `f9f4e9a6-c3f9-4688-b999-1ce568d20cf7`

---

## 🐛 デバッグ

### デバッグモード
```bash
# Playwrightデバッガー起動
PWDEBUG=1 pnpm run test:e2e:headed

# トレース記録
pnpm exec playwright test --trace on

# トレース表示
pnpm exec playwright show-trace test-results/.../trace.zip
```

### ログ確認
```bash
# Playwrightログ
DEBUG=pw:api pnpm run test:e2e

# ブラウザコンソールログ
# → テスト実行中に自動表示
```

---

## 📊 テストレポート

### HTMLレポート
```bash
# レポート生成・表示
pnpm run test:e2e:report

# 出力先
# test-results/html/index.html
```

### アーティファクト
- **動画:** `test-results/` (失敗時のみ)
- **スクリーンショット:** `test-results/` (失敗時のみ)
- **トレース:** `test-results/` (--trace on 時)

---

## 📚 Page Objects

テストは**Page Object Model (POM)** パターンを使用しています：

```
tests/e2e/page-objects/
├── session-player.page.ts    # SessionPlayerの全操作
├── login.page.ts              # ログインフロー
└── dashboard.page.ts          # ダッシュボード操作
```

**使用例:**
```typescript
import { SessionPlayerPage } from './page-objects/session-player.page';

const sessionPlayer = new SessionPlayerPage(page);
await sessionPlayer.goto(sessionId);
await sessionPlayer.startSession();
await sessionPlayer.waitForSessionStarted();
```

---

## 🔐 Fixtures

共通のセットアップロジックは**Fixtures**で管理：

```
tests/e2e/fixtures/
├── auth.fixture.ts            # 認証済みページ
└── session.fixture.ts         # テストセッションID提供
```

**使用例:**
```typescript
import { test, expect } from './fixtures/session.fixture';

test('My test', async ({ authenticatedPage, testSessionId }) => {
  // authenticatedPage: ログイン済み
  // testSessionId: 有効なセッションID
});
```

---

## ⚠️ 重要な注意事項

### システムE2Eテスト（Stage 3-5）について

**前提条件:**
1. ✅ バックエンドAPI稼働中（Dev環境）
2. ✅ WebSocket API稼働中
3. ✅ データベース（RDS）接続可能
4. ✅ S3バケット設定済み

**これらのテストは:**
- ✅ 実際のLambda関数を呼び出します
- ✅ 実際のデータベースに読み書きします
- ✅ 実際のS3に録画を保存します
- ✅ 実際のWebSocket接続を確立します

**つまり:**
Stage 3-5は単なる「フロントエンドのE2Eテスト」ではなく、**システム全体の統合テスト**です。`apps/web/tests/e2e/` に配置されていますが、バックエンドを含むエンドツーエンドの検証を行います。

---

## 🔄 CI/CD統合

### GitHub Actions例
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm run test:e2e
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}
          NEXT_PUBLIC_WEBSOCKET_URL: ${{ secrets.WS_URL }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: test-results/
```

---

## 🆘 トラブルシューティング

### テストがタイムアウトする

**Stage 0-2の場合:**
- Next.js開発サーバーが起動しているか確認
- `pnpm run dev` を実行

**Stage 3-5の場合:**
- バックエンドAPIが稼働しているか確認
- `.env.local` の `NEXT_PUBLIC_API_URL` を確認
- WebSocket接続できるか確認

### マイク権限エラー

**解決策:**
```typescript
// playwright.config.ts
use: {
  permissions: ['microphone', 'camera'],
}
```

### 認証エラー

**解決策:**
1. テストユーザーが存在するか確認
2. パスワードが正しいか確認
3. `auth.fixture.ts` の認証情報を確認

### Stage 3-5テストが失敗する

**チェックリスト:**
- [ ] Dev環境のLambda関数がデプロイされているか
- [ ] データベースに接続できるか
- [ ] S3バケットにアクセスできるか
- [ ] WebSocket APIが稼働しているか
- [ ] `.env.local` の環境変数が正しいか

---

## 📚 関連ドキュメント

### 完了レポート
- [STAGE2_PHASE1_COMPLETE.md](./STAGE2_PHASE1_COMPLETE.md)
- [STAGE2_PHASE2_COMPLETE.md](./STAGE2_PHASE2_COMPLETE.md)
- [STAGE3_OPTION_A_COMPLETE.md](./STAGE3_OPTION_A_COMPLETE.md)
- [STAGE3_PART2_COMPLETE.md](./STAGE3_PART2_COMPLETE.md)

### プロジェクトドキュメント
- [../../CLAUDE.md](../../CLAUDE.md) - プロジェクト概要
- [../../START_HERE.md](../../START_HERE.md) - 次回セッション開始手順
- [../../docs/07-development/](../../docs/07-development/) - 開発ガイド

### 外部ドキュメント
- [Playwright公式ドキュメント](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

## 🎯 将来の拡張

### モバイルアプリテスト（計画中）
モバイルアプリが追加された場合：
```
/e2e/
  ├── web/      # Playwright (Browser) - 現在のテスト
  └── mobile/   # Appium (iOS/Android)
```

### APIテスト（検討中）
REST API専用のテスト：
```
/api-e2e/     # Postman/Newman/Supertest
```

**現時点:** システムE2EテストでAPI検証も含まれているため、優先度は低い。

---

**最終更新:** 2026-03-20
**次回レビュー:** Phase 5実装完了後
**メンテナー:** Development Team
