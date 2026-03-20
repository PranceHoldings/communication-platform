# 既知の問題リスト

**バージョン:** 1.2
**作成日:** 2026-03-19
**最終更新:** 2026-03-20 (Day 30)

---

## 📋 目的

このドキュメントは、現在発生中の問題と回避策を記録します。
セッション再開時に同じ問題を繰り返さないための参照資料です。

---

## 🔴 Critical Issues（重大な問題）

### Issue #5: E2Eテスト大量失敗 & START_HERE.mdの誤った記載

**発生日:** 2026-03-20 (Day 30)
**発見経緯:** Phase 1.5-1.6再検証を開始する際にE2Eテストを実行して発覚
**状態:** 🔴 調査中
**影響:** Phase 1の完成度が不明確、ドキュメントの信頼性低下

#### 問題詳細

**1. E2Eテスト結果の矛盾:**
- **START_HERE.md記載:** E2Eテスト: 35/35 (100%) ✅
- **実際の結果:** 63/73 **失敗**（86%失敗率）

**2. テスト失敗の原因:**
```
Error: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
```
- Next.js開発サーバーが起動していない状態でテストを実行
- E2Eテストの前提条件（開発サーバー起動）が満たされていない

**3. 失敗したテストカテゴリ:**
```
- Login Authentication: 4/4 失敗
- Stage 0 (Smoke Tests): 5/5 失敗
- Stage 1 (Basic UI Flow): 10/10 失敗
- Stage 2 (Mocked Integration): 10/10 失敗
- Stage 3 (Full E2E): 10/10 失敗
- Stage 4 (Recording): 10/10 失敗
- Stage 5 (Analysis & Report): 10/10 失敗
```

#### 関連する過去の記録

**SESSION_HISTORY.md Day 28 (2026-03-19):**
- E2E Stage 2-3実行結果: **21/50 (42%)** 成功
- Stage 2-3: 0/20 **失敗** ❌
- **発見:** セッション実行機能が未実装または動作していない

#### 矛盾の原因分析

**仮説1: 記録の混同**
- Day 28では「21/50 (42%)」と記録
- しかし、START_HERE.mdには「35/35 (100%)」と記載
- 35個は別のテストセット（WebSocket Voice Conversationなど）の可能性

**仮説2: 開発サーバー起動の有無**
- Day 28: 開発サーバー起動済み → 一部テスト成功
- Day 30: 開発サーバー未起動 → 全テスト失敗

**仮説3: テスト環境の差異**
- Production環境デプロイ後、テスト設定が変更された可能性
- Fixtureやモックの設定が不完全

#### 次のステップ

**Phase 1.5-1.6 再検証計画:**

**Step 1: 環境準備と基本確認**
```bash
# 1. 開発サーバー起動
npm run dev

# 2. サーバー起動待機（20秒）
sleep 20

# 3. E2Eテスト実行
npm run test:e2e
```

**Step 2: 結果分析**
- 開発サーバー起動後の成功率を確認
- どのStageが失敗しているか特定
- Day 28の結果（21/50）と比較

**Step 3: 問題の特定**
- Stage 2-3（セッション実行機能）の詳細調査
- WebSocket接続状態の確認
- セッション状態遷移ロジックの検証

**Step 4: 修正実施**
- 発見された問題の修正
- E2Eテスト全Stage成功を目標

**Step 5: ドキュメント修正**
- START_HERE.mdの誤った記載を修正
- SESSION_HISTORY.mdに正確な記録を追加
- KNOWN_ISSUES.mdを更新（本Issue解決）

#### 回避策

**E2Eテスト実行時:**
```bash
# 必ず開発サーバーを起動してから実行
npm run dev &
sleep 20
npm run test:e2e
```

#### 教訓

1. **ドキュメントの記載は実行結果に基づくこと**
   - 推測や記憶で記載しない
   - テスト実行ログを保存して参照

2. **E2Eテストの前提条件を明記すること**
   - 開発サーバー起動が必須
   - README.mdやtest:e2eスクリプトに注記

3. **矛盾を発見したら即座に調査**
   - 放置すると混乱が拡大
   - 根本原因を特定してから進める

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

### Issue #1: Playwright設定が `apps/web/.env.local` を読み込もうとする

**発生日:** 2026-03-19
**解決日:** 2026-03-19
**状態:** ✅ 修正完了

**問題詳細:**
- `apps/web/playwright.config.ts` が `path.resolve(__dirname, '.env.local')` を使用
- しかし、実際の環境変数ファイルは **ルートディレクトリ** (`../../.env.local`) に配置されている

**修正内容:**
```typescript
// Before (❌ 間違い)
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// After (✅ 正しい)
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
```

**教訓:**
- モノレポ構成では、環境変数は**必ずルートディレクトリ**で一元管理
- `apps/web/.env.local` のような個別ファイルは作成しない

---

### Issue #2: E2E Stage 4-5 テスト失敗（解決済み）

**発生日:** 2026-03-19
**解決日:** 2026-03-19 22:00 JST (Day 27)
**状態:** ✅ 完全解決

**問題1: API Gateway 403エラー**

**根本原因:**
- テストセッション `44040076-ebb5-4579-b019-e81c0ad1713c` が別組織のシナリオを参照
- Session org (`8d4cab88-...`) ≠ Scenario org (`6d532cbc-...`)
- マルチテナント権限違反

**解決方法:**
```sql
-- セッションのscenarioIdを修正
UPDATE sessions
SET scenario_id = 'b1fbec26-957f-46cd-96a4-2b35634564db'
WHERE id = '44040076-ebb5-4579-b019-e81c0ad1713c';
```

**問題2: 動画ファイル不在（404/403エラー）**

**根本原因:**
- データベースには録画情報あり
- しかし、S3に実ファイルが存在しない（404 Not Found）
- CloudFrontも403 Forbiddenエラー

**解決方法:**
```bash
# 1. テスト動画生成（120秒、4.9MB）
ffmpeg -f lavfi -i "color=c=blue:s=1280x720:d=120" \
  -f lavfi -i "sine=frequency=440:duration=120" \
  -c:v libvpx -b:v 320k -c:a libvorbis \
  combined-test.webm

# 2. S3アップロード
aws s3 cp combined-test.webm \
  s3://prance-recordings-dev-010438500933/.../combined-test.webm \
  --content-type video/webm
```

**結果:**
- **Stage 4: 10/10 tests passed (100%)** ✅
- 全ての動画再生機能が正常動作

**教訓:**
- E2Eテスト用データは実ファイルが必要
- データベースレコードだけでは不十分

---

### Issue #5: npm prepare hook 3重実行（解決済み）

**発生日:** 2026-03-10
**解決日:** 2026-03-10
**状態:** ✅ 解決済み

**問題詳細:**
- npm prepare hookが3重に実行されていた
- clean-deploy.sh → npm install → prepare hook → prepare.sh → npm ci → prepare hook（無限ループ）

**根本解決:**
- prepare hookを廃止
- `--ignore-scripts`で明示的制御

**関連ドキュメント:**
- CLAUDE.md「Rule 3: 根本原因分析の原則」

---

### Issue #6: ログインタイムアウト（全Stage 1テスト失敗）

**発生日:** 2026-03-19
**解決日:** 2026-03-19 22:00 JST (Day 27)
**状態:** ✅ 完全解決

**問題詳細:**
- Stage 1 テスト 10/10 全失敗
- ログインAPI呼び出しタイムアウト（10秒超過）
- ログインページで静的アセット（JavaScript/CSS）が404エラー

**エラーログ:**
```
❌ HTTP Error 404: http://localhost:3000/_next/static/chunks/main-app.js
❌ HTTP Error 404: http://localhost:3000/_next/static/chunks/app/layout.js
❌ Login API request failed or timed out: TimeoutError
```

**根本原因:**
- Next.js Webpackキャッシュが破損
- `.next/cache/webpack/server-development/1.pack.gz` のrename失敗
- JavaScript未ロード → フォーム動作せず → APIタイムアウト

**解決方法:**
```bash
# 開発サーバー停止 + キャッシュクリア
ps aux | grep "next dev" | awk '{print $2}' | xargs kill
rm -rf .next
npm run dev
```

**結果:**
- **Stage 1: 10/10 tests passed (100%)** ✅
- 全ログインテストが正常動作

**教訓:**
- Webpack cache エラー時は、`.next`削除で解決
- E2Eテスト失敗時は、開発サーバーログを必ず確認

---

## 📚 関連ドキュメント

- [セッション再開プロトコル](SESSION_RESTART_PROTOCOL.md)
- [トラブルシューティング](../01-getting-started/FAQ.md)
- [環境変数管理](../02-architecture/ENVIRONMENT_ARCHITECTURE.md)

---

**最終更新:** 2026-03-19 22:00 JST (Day 27)
**次回レビュー:** 問題解決時、または新規問題発生時
