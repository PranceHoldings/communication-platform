# 計画・ロードマップ

このディレクトリには、Pranceプラットフォームの開発計画、リリースロードマップ、分析レポートが含まれています。

## ディレクトリ構成

### releases/ - リリース計画
プロダクション環境へのリリースに向けた計画。

- **PRODUCTION_READY_ROADMAP.md** 🔴最優先
  - Phase 1.5-1.6: 実用レベル対応
  - リアルタイム会話実装
  - エラーハンドリング、監視、最適化

- **RELEASE_ROADMAP.md**
  - Phase 0-7の全体リリース計画
  - マイルストーン、依存関係、リスク管理

### implementation/ - 実装計画
詳細な実装フェーズとタスク分解。

- **COMPLETE_IMPLEMENTATION_ROADMAP.md**
  - Phase 0-7の完全実装計画
  - 各Phaseの詳細タスク、技術選定、推定工数

- **PRIORITY_BASED_IMPLEMENTATION_PLAN.md**
  - 優先度ベースの実装順序
  - Critical → High → Medium → Low

- **COMPREHENSIVE_IMPLEMENTATION_PLAN.md**
  - 包括的な実装計画
  - 依存関係マップ、並行実装可能箇所

- **IMPLEMENTATION_PHASES.md**
  - 旧版の実装フェーズ（参考資料）

- **IMPLEMENTATION_SUMMARY.md**
  - 実装計画のサマリー（概要）

### analysis/ - 分析・ギャップ分析
機能ギャップ、不整合、コード品質の分析レポート。

- **FEATURE_GAP_ANALYSIS.md**
  - 計画機能と実装済み機能のギャップ分析
  - 未実装機能のリスト

- **INCONSISTENCY_REPORT.md**
  - コード不整合の検出レポート
  - 型不整合、命名規則違反、ハードコード検出

## 読む順序（推奨）

1. **新規参加者**: PRODUCTION_READY_ROADMAP.md → COMPLETE_IMPLEMENTATION_ROADMAP.md
2. **PM・リード**: RELEASE_ROADMAP.md → PRIORITY_BASED_IMPLEMENTATION_PLAN.md
3. **コード品質担当**: INCONSISTENCY_REPORT.md → FEATURE_GAP_ANALYSIS.md

## 関連ドキュメント

- [../../02-architecture/SYSTEM_ARCHITECTURE.md](../02-architecture/SYSTEM_ARCHITECTURE.md) - システム全体構成
- [../../04-design/API_DESIGN.md](../04-design/API_DESIGN.md) - API設計
- [../../09-progress/SESSION_HISTORY.md](../09-progress/SESSION_HISTORY.md) - 進捗履歴
