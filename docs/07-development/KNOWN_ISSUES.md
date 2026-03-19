# 既知の問題リスト

**バージョン:** 1.0
**作成日:** 2026-03-19
**最終更新:** 2026-03-19

---

## 📋 目的

このドキュメントは、現在発生中の問題と回避策を記録します。
セッション再開時に同じ問題を繰り返さないための参照資料です。

---

## 🔴 Critical Issues（重大な問題）

### Issue #1: Playwright設定が `apps/web/.env.local` を読み込もうとする

**発生日:** 2026-03-19
**状態:** ✅ 修正完了
**影響:** E2Eテストが環境変数を読み込めず、CORSエラーが発生

**問題詳細:**
- `apps/web/playwright.config.ts` が `path.resolve(__dirname, '.env.local')` を使用
- しかし、実際の環境変数ファイルは **ルートディレクトリ** (`../../.env.local`) に配置されている
- モノレポ構成では、ルートディレクトリで環境変数を一元管理する設計

**修正内容:**
```typescript
// Before (❌ 間違い)
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// After (✅ 正しい)
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
```

**影響ファイル:**
- `apps/web/playwright.config.ts` - 修正完了 ✅
- `apps/web/next.config.js` - 修正完了 ✅

**関連コミット:**
- TBD（次回コミット時に記録）

**教訓:**
- モノレポ構成では、環境変数は**必ずルートディレクトリ**で一元管理
- `apps/web/.env.local` のような個別ファイルは作成しない
- 設定ファイルは相対パス (`../../.env.local`) でルートを参照

---

### Issue #2: API Gateway 403エラー（調査中）

**発生日:** 2026-03-19
**状態:** 🔄 調査中
**影響:** E2E Stage 4-5 テストが全失敗

**問題詳細:**
- ログイン認証は成功（HTTP 200）
- ダッシュボードへのリダイレクトも成功
- しかし、セッション一覧取得等のAPI呼び出しで HTTP 403 エラー

**エラーメッセージ:**
```
❌ HTTP Error 403: https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/sessions
```

**環境変数設定:**
```bash
# .env.local (ルートディレクトリ)
NEXT_PUBLIC_API_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1
NEXT_PUBLIC_WS_URL=wss://bu179h4agh.execute-api.us-east-1.amazonaws.com/dev
```

**過去の成功事例:**
- Day 21: E2E Stage 1-3 が 97.1% (34/35) 成功
- その時の環境設定は同じはず（要確認）

**調査項目:**
- [ ] Lambda Authorizerのログ確認
- [ ] JWTトークンの内容確認
- [ ] CORS設定確認
- [ ] API Gateway ログ確認
- [ ] Day 21のコミット時点の環境変数を確認

**回避策:**
- なし（現在調査中）

**次のアクション:**
1. Day 21のコミット (`d436baf`) をチェックアウトして、同じ環境でテスト実行
2. 動作する環境と現在の環境の差分を特定
3. 差分を解消

---

## ⚠️ Warning Issues（警告レベルの問題）

### Issue #3: Next.js開発サーバーの初回起動が遅い

**発生日:** 常時
**状態:** 🔄 既知の動作
**影響:** セッション開始時に1-2分待機が必要

**問題詳細:**
- Next.js開発サーバーの初回起動時、middlewareのコンパイルに時間がかかる
- 特に `.next` ディレクトリをクリアした後は顕著

**回避策:**
```bash
# 開発サーバー起動後、20秒待機してからテスト実行
npm run dev &
sleep 20
npm run test:e2e
```

**根本解決:**
- なし（Next.js 15の仕様）

---

## 📝 Info Issues（情報レベル）

### Issue #4: TypeScript診断警告（next.config.js）

**発生日:** 2026-03-19
**状態:** ✅ 無視可能
**影響:** なし（動作に問題なし）

**警告内容:**
```
next.config.js:
  ★ [Line 4:14] File is a CommonJS module; it may be converted to an ES module. [80001] (ts)
```

**理由:**
- Next.js設定ファイルは CommonJS (`.js`) で記述するのが標準
- TypeScript ESLintが ES Module への変換を提案しているだけ

**対応:**
- 不要（現在の形式で問題なし）

---

## 🔧 解決済み Issues（参考）

### Issue #5: npm prepare hook 3重実行（解決済み）

**発生日:** 2026-03-10
**状態:** ✅ 解決済み
**影響:** clean-deploy.sh実行時にENOTEMPTYエラー頻発

**問題詳細:**
- npm prepare hookが3重に実行されていた
- clean-deploy.sh → npm install → prepare hook → prepare.sh → npm ci → prepare hook（無限ループ）

**根本解決:**
- prepare hookを廃止
- `--ignore-scripts`で明示的制御

**関連ドキュメント:**
- CLAUDE.md「Rule 3: 根本原因分析の原則」

---

## 📚 関連ドキュメント

- [セッション再開プロトコル](SESSION_RESTART_PROTOCOL.md)
- [トラブルシューティング](../01-getting-started/FAQ.md)
- [環境変数管理](../02-architecture/ENVIRONMENT_ARCHITECTURE.md)

---

**最終更新:** 2026-03-19
**次回レビュー:** 問題解決時、または新規問題発生時
