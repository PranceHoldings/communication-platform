# Pre-Phase 4 Migration Scripts Archive

このディレクトリには、Phase 4スクリプト移行前のオリジナルバージョンが保存されています。

## 概要

- **アーカイブ日時:** 2026-04-05
- **ソースコミット:** caaa998 (Phase 4開始前)
- **スクリプト数:** 63 scripts
- **目的:** Phase 4で共有ライブラリシステムに移行される前のオリジナルスクリプトを参照用に保存

## Phase 4 Script Migration について

Phase 4では、`scripts/lib/common.sh`共有ライブラリシステムへの移行を実施しました：

### 移行内容

- **色定義の一元化** - RED, GREEN, YELLOW, BLUE, NC
- **ログ関数の統一** - log_success(), log_error(), log_warning(), log_info()
- **エラーハンドリングの統一** - die(), require_*()
- **カウンター管理の統一** - increment_counter(), print_counter_summary()
- **対話型プロンプトの統一** - confirm()

### 移行統計

- **移行完了:** 60/60 scripts (100%)
- **実行バッチ:** 18 batches
- **コード削減:** ~500+ lines (平均8.5%)
- **作業期間:** Day 42-44 (2026-04-02 〜 2026-04-05)

## ディレクトリ構造

```
scripts/
├── archive/
│   └── pre-phase4-migration/  ← このディレクトリ
│       ├── README.md          ← このファイル
│       └── *.sh               ← 移行前のオリジナルスクリプト（63個）
├── lib/
│   └── common.sh              ← 共有ライブラリ
└── *.sh                       ← 移行後の新スクリプト（共有ライブラリ使用）
```

## 使用方法

### 古いバージョンとの比較

```bash
# 特定のスクリプトの変更を確認
diff scripts/archive/pre-phase4-migration/validate-env.sh scripts/validate-env.sh

# または vimdiff で視覚的に比較
vimdiff scripts/archive/pre-phase4-migration/validate-env.sh scripts/validate-env.sh
```

### 古いバージョンの参照

```bash
# 移行前のスクリプトを実行（非推奨）
bash scripts/archive/pre-phase4-migration/validate-env.sh

# 推奨: 新しいバージョンを使用
bash scripts/validate-env.sh
```

### 特定のスクリプトの復元（緊急時）

```bash
# 新バージョンに問題がある場合のみ
cp scripts/archive/pre-phase4-migration/validate-env.sh scripts/validate-env.sh
```

## 注意事項

⚠️ **このアーカイブ内のスクリプトは古いバージョンです。**

- 共有ライブラリを使用していません
- 新機能やバグ修正が反映されていません
- 実行には適していません（参照・比較用途のみ）

✅ **通常の使用では、`scripts/`直下の新バージョンを使用してください。**

## 関連ドキュメント

- [scripts/CLAUDE.md](../../CLAUDE.md) - スクリプト使用ガイド
- [scripts/lib/common.sh](../../lib/common.sh) - 共有ライブラリソースコード
- Phase 4完了報告（作成予定）

## Phase 4完了コミット

最終コミット: `0210594` (2026-04-05)
コミットメッセージ: "fix(scripts): complete fix-inconsistencies.sh migration to shared library"

---

**最終更新:** 2026-04-05  
**管理者:** Claude Code + Ken Wakasa
