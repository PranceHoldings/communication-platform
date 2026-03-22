# 次回セッション開始手順

**最終更新:** 2026-03-22 (Day 36)
**現在の Phase:** Phase 1.6.1 完了 ✅
**次のアクション:** Day 36実装のデプロイ・検証
**ステータス:** 実装完了・デプロイ待ち

---

## セッション開始の第一声

```
前回の続きから始めます。START_HERE.mdを確認してください。
```

---

## 🔴 必須手順

### Step 1: 環境検証

```bash
bash scripts/verify-environment.sh
```

**期待結果:** `✅ All environment checks passed`

### Step 2: 既知の問題確認

```bash
cat docs/07-development/KNOWN_ISSUES.md
```

### Step 3: Day 36実装のデプロイ

```bash
# 1. Prismaマイグレーション実行
cd /workspaces/prance-communication-platform/packages/database
npx prisma migrate dev --name add_session_error_model
npx prisma generate

# 2. Lambda関数デプロイ
cd /workspaces/prance-communication-platform/infrastructure
npm run deploy:lambda

# 3. 動作確認
# - /dashboard/scenarios で新規シナリオ作成
# - バリデーションエラー/警告確認
# - ターン制限確認
```

---

## 📊 現在の状況

### Phase進捗サマリー

| Phase | 内容 | ステータス |
|-------|------|-----------|
| Phase 1.5-1.6.1 | リアルタイム会話・アバター・録画・シナリオ | ✅ 完了 |
| Phase 2-2.5 | 録画・解析・ゲストユーザー | ✅ 完了 |
| Phase 3.1-3.4 | Dev/Production環境・環境変数管理 | ✅ 完了 |
| Phase 4 | ベンチマークシステム | ✅ 完了 |
| Phase 5 | ランタイム設定管理 | ✅ 完了 |

**詳細:** [docs/09-progress/SESSION_HISTORY.md](docs/09-progress/SESSION_HISTORY.md)

### 最新達成 (Day 36)

**Phase 1.6.1 シナリオバリデーション・エラーリカバリー完了:**
- シナリオ事前バリデーション、警告ダイアログ、AI応答フォールバック、ターン制限
- 多言語対応: 10言語全翻訳完了

**詳細:** [docs/09-progress/archives/SESSION_2026-03-22_Day36_Phase1.6.1_Complete.md](docs/09-progress/archives/SESSION_2026-03-22_Day36_Phase1.6.1_Complete.md)


---

## 🎯 次のアクション

### 1. Day 36実装のデプロイ（最優先）

詳細手順: [Step 3](#step-3-day-36実装のデプロイ) 参照

### 2. Production環境での動作確認

- シナリオバリデーション確認
- エラーハンドリング確認

### 3. 次Phase検討

**選択肢:**
- Option A: 新機能開発（Phase計画参照）
- Option B: 既存機能改善・最適化

---

## 📚 重要ドキュメント

### 開発ガイド
- [CLAUDE.md](CLAUDE.md) - プロジェクト全体概要
- [CODING_RULES.md](CODING_RULES.md) - コミット前チェックリスト
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - ドキュメント索引

### Phase関連
- [SESSION_HISTORY.md](docs/09-progress/SESSION_HISTORY.md) - 全セッション履歴
- [Day 36 完了記録](docs/09-progress/archives/SESSION_2026-03-22_Day36_Phase1.6.1_Complete.md)

### スクリプト
```bash
bash scripts/verify-environment.sh           # 環境検証
bash scripts/validate-env-single-source.sh   # SSOT検証
bash scripts/detect-hardcoded-values.sh      # ハードコード検出
```

---

## 📈 プロジェクト統計

- Lambda関数: 44個
- 環境変数: 93個
- E2Eテスト: 35/35 ✅
- 全Phase: 完了 ✅

**詳細:** [SESSION_HISTORY.md](docs/09-progress/SESSION_HISTORY.md)

---

**最終更新:** 2026-03-22
**Production Status:** 🚀 **稼働中** - https://app.prance.jp
