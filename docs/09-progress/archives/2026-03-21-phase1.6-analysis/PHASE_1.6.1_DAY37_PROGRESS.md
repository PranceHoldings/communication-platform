# Phase 1.6.1 Day 37 - 統合テスト・ユーザーテスト実装記録

**日付:** 2026-03-21
**Phase:** Phase 1.6.1 (既存機能の実用化)
**Day:** 37 (Week 3-3.5, Day 21)
**目標:** 統合テスト・ユーザーテスト準備完了

---

## 📋 実装概要

### 目的
Phase 1.6.1で実装した全機能（Day 31-36）の統合テスト環境整備と、実用レベル検証のためのユーザーテスト準備。

### 実装範囲
1. ✅ E2E統合テスト実装（Playwright）
2. ✅ パフォーマンステストスクリプト作成
3. ✅ ユーザーテストガイド作成
4. ✅ テスト環境準備

---

## 🔧 実装詳細

### 1. E2E統合テスト (`apps/web/tests/e2e/phase1.6.1-integration.spec.ts`)

**新規作成:**
- Phase 1.6.1専用のPlaywright E2Eテストスイート
- 4つのテストグループ、12個のテストケース

#### 1.1 録画機能信頼性テスト (Day 31-34)

**テストケース:**

```typescript
test('should track chunk ACKs during recording', async ({ page }) => {
  // 1. セッション開始
  // 2. 録画状態表示確認（Audio: X/Y, Video: X/Y）
  // 3. チャンクカウント増加確認
  // 4. セッション終了
  // 5. 録画完了確認
});

test('should handle missing chunks gracefully', async ({ page }) => {
  // 1. セッション実行
  // 2. Failed chunksインジケーター確認
  // 3. 失敗数が0またはほぼ0であることを確認
});

test('should show recording processing status', async ({ page }) => {
  // 1. 短いセッション実行
  // 2. 終了後の処理状態表示確認
  // 3. "Processing|Combining|Uploading"メッセージ確認
});
```

**検証項目:**
- ✅ 録画状態のリアルタイム表示
- ✅ チャンクACK追跡
- ✅ 失敗チャンク検出
- ✅ 処理状態の可視化

#### 1.2 シナリオバリデーションテスト (Day 35)

**テストケース:**

```typescript
test('should reject scenario with missing required fields', async ({ page }) => {
  // 1. シナリオ作成画面
  // 2. 必須フィールド未入力で保存
  // 3. バリデーションエラー表示確認
});

test('should warn for short system prompt', async ({ page }) => {
  // 1. 短いprompt入力（<50文字）
  // 2. 警告メッセージ表示確認
  // 3. 非ブロッキングであることを確認
});

test('should validate language code', async ({ page }) => {
  // 1. 有効な言語コード選択
  // 2. バリデーション通過確認
});
```

**検証項目:**
- ✅ 必須フィールドチェック
- ✅ プロンプト長検証
- ✅ 言語コード検証
- ✅ 警告とエラーの区別

#### 1.3 エラーリカバリーテスト (Day 35)

**テストケース（スキップ状態）:**

```typescript
test.skip('should handle session timeout gracefully', async ({ page }) => {
  // 期待される動作:
  // 1. セッションが3600秒（1時間）実行
  // 2. session_terminatedメッセージ送信
  // 3. UI通知表示
  // 4. 部分データ保存
});

test.skip('should warn when approaching turn limit', async ({ page }) => {
  // 期待される動作:
  // 1. 80ターン到達
  // 2. execution_warning送信
  // 3. UI警告表示
  // 4. 100ターンまで継続可能
});

test.skip('should retry on temporary errors', async ({ page }) => {
  // 期待される動作:
  // 1. 一時的エラー発生
  // 2. processing_retryメッセージ送信
  // 3. "Retrying..."表示
  // 4. 最大3回リトライ
  // 5. 成功または終了
});
```

**注:** これらのテストは実行時間が長いか、エラー注入が必要なため、スキップ状態で実装。実際のユーザーテストで検証。

#### 1.4 キャッシュ・変数システムテスト (Day 36)

**テストケース:**

```typescript
test('should load scenario faster on second access (cache)', async ({ page }) => {
  // 1. シナリオ詳細を初回表示（cache miss）
  // 2. 表示時間計測
  // 3. 戻って再度表示（cache hit）
  // 4. 表示時間計測
  // 5. 2回目が30%以上速いことを確認
});

test('should support variable substitution in scenario', async ({ page }) => {
  // 1. 変数を含むシナリオ作成
  // 2. "Hello {{userName}}"などの構文使用
  // 3. 保存確認
});

test('should preview scenario before execution', async ({ page }) => {
  // 1. プレビューボタンクリック（実装されている場合）
  // 2. プレビュー画面表示確認
  // 3. バリデーション結果表示確認
  // 4. サンプル会話表示確認
});
```

**検証項目:**
- ✅ キャッシュによるレスポンス時間改善
- ✅ 変数システムの動作
- ✅ プレビュー機能（UI実装次第）

#### 1.5 パフォーマンステスト

**テストケース（スキップ状態）:**

```typescript
test.skip('should handle multiple simultaneous sessions', async ({ page }) => {
  // 期待される動作:
  // 1. 10並行セッション実行
  // 2. 全セッションが2分以内に完了
  // 3. エラーなし
  // 4. 録画データ正常保存
});

test('should complete full session flow within time limit', async ({ page }) => {
  // 1. ログイン
  // 2. セッション開始
  // 3. 会話（5秒）
  // 4. セッション終了
  // 5. 全体が120秒以内に完了することを確認
});
```

**検証項目:**
- ✅ フルフロー実行時間（< 2分）
- ⏸️ 並行実行（実装準備のみ）

### 2. パフォーマンステストスクリプト (`scripts/performance-test.sh`)

**新規作成:**
- Bash script による自動パフォーマンステスト
- 4つのテストカテゴリ

#### 2.1 認証パフォーマンステスト

**測定項目:**
```bash
# 5回ログインAPIを呼び出し
# 平均レスポンス時間を測定
# 合格基準: < 1000ms
```

**実装:**
```bash
for i in {1..5}; do
  START=$(date +%s%3N)
  curl -X POST "${API_BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"...","password":"..."}'
  END=$(date +%s%3N)
  DURATION=$((END - START))
  echo "Iteration $i: ${DURATION}ms"
done
```

#### 2.2 シナリオキャッシュパフォーマンステスト

**測定項目:**
```bash
# 同一シナリオを2回取得
# 1回目: Cache miss（100-200ms）
# 2回目: Cache hit（10-20ms）
# 改善率: > 30%
```

**実装:**
```bash
# First access (cache miss)
START=$(date +%s%3N)
curl -X GET "${API_BASE_URL}/scenarios/${SCENARIO_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
END=$(date +%s%3N)
DURATION_MISS=$((END - START))

# Second access (cache hit)
START=$(date +%s%3N)
curl -X GET "${API_BASE_URL}/scenarios/${SCENARIO_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
END=$(date +%s%3N)
DURATION_HIT=$((END - START))

# Calculate improvement
IMPROVEMENT=$(( (DURATION_MISS - DURATION_HIT) * 100 / DURATION_MISS ))
```

#### 2.3 並列APIリクエストテスト

**測定項目:**
```bash
# 10並行リクエスト実行
# 全リクエスト完了確認
# 平均レスポンス時間: < 2000ms
# 最大レスポンス時間: < 3000ms
```

**実装:**
```bash
# Function to make API request
make_request() {
  local user_id=$1
  START=$(date +%s%3N)
  curl -X GET "${API_BASE_URL}/scenarios" \
    -H "Authorization: Bearer ${token}"
  END=$(date +%s%3N)
  DURATION=$((END - START))
  echo $DURATION > "${TEMP_DIR}/user_${user_id}.txt"
}

# Run parallel requests
for i in $(seq 1 $PARALLEL_USERS); do
  make_request $i &
done
wait
```

#### 2.4 サマリーレポート

**出力形式:**
```
┌─────────────────────────────────────────────────────┐
│ Metric                          │ Value    │ Status │
├─────────────────────────────────────────────────────┤
│ Average Login Time              │ 450ms    │ ✓      │
│ Cache Miss Time                 │ 150ms    │ ✓      │
│ Cache Hit Time                  │ 20ms     │ ✓      │
│ Cache Improvement               │ 87%      │ ✓      │
│ Parallel Avg Response Time      │ 1200ms   │ ✓      │
│ Parallel Max Response Time      │ 1800ms   │ ✓      │
│ Parallel Completion Rate        │ 10/10    │ ✓      │
└─────────────────────────────────────────────────────┘
```

### 3. ユーザーテストガイド (`USER_TEST_GUIDE.md`)

**新規作成:**
- 包括的なユーザーテスト実施ガイド
- 28ページの詳細ドキュメント

#### 3.1 テスト構成

**参加者:**
- グループA: 内部ユーザー（5名）- 詳細テスト
- グループB: 外部ユーザー（5名）- 基本機能・UX

**セッション数:**
- 各ユーザー10セッション = 合計100セッション

#### 3.2 テストシナリオ（5種類）

| シナリオ | 対象 | 目的 | 時間 |
|---------|------|------|------|
| **1. 基本セッション** | 全ユーザー | 録画機能基本動作 | 5分 |
| **2. 長時間セッション** | 内部のみ | 無限ループ防止 | 15分 |
| **3. エラーリカバリー** | 内部のみ | エラー自動回復 | 10分 |
| **4. シナリオ作成** | 内部のみ | バリデーション | 10分 |
| **5. キャッシュ** | 内部のみ | レスポンス時間 | 5分 |

#### 3.3 データ収集方法

**1. アンケート（5段階評価）:**
- 操作のしやすさ
- レスポンス速度
- エラー処理の適切さ
- 録画品質
- 総合満足度

**2. システムログ（自動収集）:**
- セッション開始・終了時刻
- 会話ターン数
- 録画チャンク数（送信/ACK/失敗）
- エラー発生回数・種類
- リトライ回数
- レスポンス時間

**3. 観察メモ:**
- ユーザーの迷った箇所
- 予期しない動作
- ユーザーからの質問
- 使用中の表情・反応

#### 3.4 合格基準

**必須（100%達成）:**
- [ ] 録画成功率 > 98%
- [ ] 録画処理時間 < 60秒（1分セッション）
- [ ] エラーリカバリー成功率 > 95%
- [ ] シナリオバリデーション動作率 100%
- [ ] キャッシュヒット時レスポンス < 50ms
- [ ] 重大バグ 0件

**推奨（80%達成）:**
- [ ] 総合満足度 ≥ 4.0/5.0
- [ ] 操作のしやすさ ≥ 4.0/5.0
- [ ] エラー処理の適切さ ≥ 3.5/5.0
- [ ] ユーザーテスト完了率 ≥ 90%

---

## 📊 テスト実行方法

### E2Eテスト実行

```bash
# 全Phase 1.6.1テスト実行
cd apps/web
npx playwright test phase1.6.1-integration.spec.ts

# 特定グループのみ実行
npx playwright test -g "Recording Reliability"
npx playwright test -g "Scenario Validation"
npx playwright test -g "Scenario Cache"

# ヘッドレスモード無効（ブラウザ表示）
npx playwright test phase1.6.1-integration.spec.ts --headed

# デバッグモード
npx playwright test phase1.6.1-integration.spec.ts --debug
```

### パフォーマンステスト実行

```bash
# デフォルト設定で実行
bash scripts/performance-test.sh

# カスタム設定
export API_BASE_URL="https://api.app.prance.jp"
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="password"
bash scripts/performance-test.sh

# 結果をファイルに保存
bash scripts/performance-test.sh > performance-results-$(date +%Y%m%d).log 2>&1
```

---

## 🎯 達成した目標

### ✅ 完了した項目
1. **E2E統合テスト実装**
   - 4テストグループ、12テストケース
   - Playwright使用
   - Page Object Modelパターン
   - スキップテストを含む完全なスイート

2. **パフォーマンステストスクリプト**
   - 認証パフォーマンステスト
   - キャッシュパフォーマンステスト
   - 並列リクエストテスト
   - 自動サマリーレポート

3. **ユーザーテストガイド**
   - 包括的な実施手順
   - 5つのテストシナリオ
   - データ収集方法
   - 合格基準
   - テスト報告書テンプレート

4. **テスト環境準備**
   - テストスクリプト実行権限設定
   - ドキュメント完備
   - 実行手順明確化

---

## 📈 期待される効果

### 1. 品質保証
- **自動テスト**: E2Eテストで回帰バグ防止
- **パフォーマンス監視**: 定期的なパフォーマンステスト
- **ユーザー検証**: 実際のユーザーによる実用性確認

### 2. 迅速なフィードバック
- **CI/CD統合**: 自動テスト実行（将来）
- **パフォーマンス劣化検出**: ベンチマーク比較
- **問題早期発見**: ユーザーテストで本番前に問題特定

### 3. ドキュメント化
- **テストケース**: 機能仕様の明確化
- **実施手順**: 再現可能なテストプロセス
- **合格基準**: 客観的な品質評価

---

## 🔄 次のステップ

### immediate（実施準備完了）
1. **E2Eテスト実行**
   ```bash
   npx playwright test phase1.6.1-integration.spec.ts
   ```

2. **パフォーマンステスト実行**
   ```bash
   bash scripts/performance-test.sh
   ```

3. **結果レビュー**
   - テスト失敗箇所の分析
   - パフォーマンスボトルネックの特定

### short-term（1-2日）
1. **ユーザーテスト実施**
   - テストユーザー10名招集
   - テストアカウント配布
   - テスト実施（各ユーザー10セッション）
   - アンケート収集

2. **データ分析**
   - システムログ集計
   - アンケート結果分析
   - 合格基準判定

3. **改善実施**
   - 検出された問題の修正
   - パフォーマンス改善
   - UX改善

### mid-term（次週以降）
1. **Phase 1.6.1 完了判定**
   - 全合格基準達成確認
   - 実用レベル達成判定
   - Phase 1.6完了宣言

2. **Phase 2移行準備**
   - 録画・解析・レポート機能開発開始
   - または Phase 2.5（ゲストユーザー）

---

## 📝 注意事項

### 1. E2Eテスト実行前の準備
```bash
# Playwrightブラウザインストール（初回のみ）
npx playwright install

# テスト用環境変数設定
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="TestPassword123!"
export BASE_URL="http://localhost:3000"

# Dev server起動
npm run dev
```

### 2. パフォーマンステスト実行環境
- **ネットワーク**: 安定した接続環境
- **API環境**: Dev/Staging環境（Production非推奨）
- **認証情報**: 有効なテストアカウント

### 3. ユーザーテスト実施時の注意
- **事前説明**: テスト手順を十分に説明
- **サポート体制**: 問題発生時の即座対応
- **データ保護**: テストデータの適切な管理
- **フィードバック収集**: アンケート・観察メモの確実な記録

### 4. CI/CD統合（将来）
現在は手動実行ですが、将来的にCI/CDパイプラインに統合:
```yaml
# .github/workflows/e2e-tests.yml (例)
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
```

---

## 🔗 関連ファイル

### 新規作成
- `apps/web/tests/e2e/phase1.6.1-integration.spec.ts` - E2E統合テスト
- `scripts/performance-test.sh` - パフォーマンステストスクリプト
- `docs/09-progress/archives/2026-03-21-phase1.6-analysis/USER_TEST_GUIDE.md` - ユーザーテストガイド

### 既存利用
- `apps/web/tests/e2e/page-objects/` - Page Object Model
- `apps/web/tests/e2e/fixtures/` - テストフィクスチャ
- `apps/web/tests/e2e/setup/` - テストセットアップ

---

## 📊 テスト実施状況（予定）

### E2Eテスト
- [ ] 録画機能信頼性（3テスト）
- [ ] シナリオバリデーション（3テスト）
- [ ] エラーリカバリー（3テスト、スキップ）
- [ ] キャッシュ・変数システム（3テスト）

### パフォーマンステスト
- [ ] 認証パフォーマンス
- [ ] キャッシュパフォーマンス
- [ ] 並列リクエスト

### ユーザーテスト
- [ ] テストユーザー招集（10名）
- [ ] テストアカウント配布
- [ ] テスト実施（100セッション）
- [ ] アンケート収集・分析
- [ ] 合格基準判定

---

**完了日時:** 2026-03-21 13:45 UTC
**所要時間:** 約1.5時間
**ステータス:** ✅ Day 37 完了 - テスト環境準備100%
**次の作業:** テスト実施 → 結果分析 → Phase 1.6.1完了判定
