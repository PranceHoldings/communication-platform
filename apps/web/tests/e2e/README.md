# Session Player E2E Test Suite

**作成日:** 2026-03-16
**対象:** Session Player コンポーネントの包括的な動作検証
**フレームワーク:** Playwright

---

## 📋 テスト構成

### Stage 1: Basic UI Flow Tests (10 tests)
**目的:** 基本的なUI要素とナビゲーションの検証

**テスト内容:**
- ログイン → セッション一覧 → セッション詳細
- IDLE状態でのUI要素表示確認
- ボタンの状態とラベル
- オーディオインジケーターの表示
- 初期状態の検証

**実行時間:** ~2-3分

**実行コマンド:**
```bash
npm run test:e2e:stage1
```

---

### Stage 2: Mocked Integration Tests (10 tests)
**目的:** WebSocketモックを使用した状態遷移とロジックの検証

**テスト内容:**
- WebSocket接続と認証フロー
- 初回挨拶と沈黙タイマー起動
- ユーザー発話 → AI応答サイクル
- 沈黙タイマーの動作（リセット、一時停止）
- 処理ステージ遷移（STT/AI/TTS）
- エラーハンドリング（NO_AUDIO_DATA等）
- 録音中の手動停止
- 停止後のAI応答ブロック
- 複数回の会話サイクル

**実行時間:** ~3-5分

**実行コマンド:**
```bash
npm run test:e2e:stage2
```

---

### Stage 3: Full E2E Tests (10 tests)
**目的:** 実際のWebSocket接続と音声処理フローの検証

**テスト内容:**
- 実WebSocket接続と認証
- マイク権限ハンドリング
- バックエンドからの初回挨拶
- フェイクオーディオデバイスでの会話フロー
- リアルタイム沈黙タイマー
- 手動停止とセッション完了
- 複数発話サイクル
- エラーリカバリー
- ストレステスト（5サイクル連続会話）

**実行時間:** ~10-15分

**前提条件:**
- バックエンドWebSocketサーバーが起動していること
- テスト用セッションIDが有効であること

**実行コマンド:**
```bash
npm run test:e2e:stage3
```

---

## 🚀 実行方法

### 全テスト実行
```bash
npm run test:e2e
```

### UI モードで実行（推奨：開発中）
```bash
npm run test:e2e:ui
```

### ヘッドレスモード（CI/CD用）
```bash
npm run test:e2e
```

### ヘッドレスモードOFF（ブラウザ表示）
```bash
npm run test:e2e:headed
```

### 特定のテストファイルのみ
```bash
npx playwright test tests/e2e/stage1-basic-ui.spec.ts
```

### 特定のテストケースのみ
```bash
npx playwright test -g "S1-001"
```

---

## 📊 テストレポート

### HTMLレポート表示
```bash
npm run test:e2e:report
```

### レポート出力先
- **HTML:** `test-results/html/index.html`
- **JSON:** `test-results/results.json`
- **動画:** `test-results/` (失敗時のみ)
- **スクリーンショット:** `test-results/` (失敗時のみ)

---

## 🔧 テスト設定

### playwright.config.ts

```typescript
{
  baseURL: 'http://localhost:3000',
  timeout: 60000,              // テストタイムアウト: 1分
  actionTimeout: 15000,        // アクション: 15秒
  navigationTimeout: 30000,    // ナビゲーション: 30秒
  permissions: ['microphone', 'camera'],
}
```

### フェイクメディアデバイス

Chromium起動オプション:
```javascript
launchOptions: {
  args: [
    '--use-fake-ui-for-media-stream',        // 自動権限許可
    '--use-fake-device-for-media-stream',    // フェイクデバイス使用
    '--autoplay-policy=no-user-gesture-required',  // 自動再生許可
  ],
}
```

---

## 📝 テストデータ

### テストユーザー
```typescript
{
  email: 'test@example.com',
  password: 'Test123!@#',
}
```

### テストセッションID
- **Stage 1-2:** `'test-session-id'` (モック用)
- **Stage 3:** `'real-session-id'` (実際のセッション)

**注意:** Stage 3実行前に、バックエンドで有効なセッションを作成してください。

---

## 🐛 デバッグ

### デバッグモードで実行
```bash
PWDEBUG=1 npm run test:e2e:headed
```

### トレース記録
```bash
npx playwright test --trace on
```

### トレース表示
```bash
npx playwright show-trace test-results/.../trace.zip
```

### ログ出力
```bash
DEBUG=pw:api npm run test:e2e
```

---

## 🧪 テストカバレッジ

| カテゴリ | Stage 1 | Stage 2 | Stage 3 | 合計 |
|---------|---------|---------|---------|------|
| UI要素表示 | ✅ 10 | - | - | 10 |
| 状態遷移 | - | ✅ 10 | ✅ 5 | 15 |
| WebSocket通信 | - | ✅ 8 | ✅ 10 | 18 |
| 音声処理 | - | - | ✅ 8 | 8 |
| エラーハンドリング | - | ✅ 2 | ✅ 2 | 4 |
| **合計** | **10** | **10** | **10** | **30** |

---

## ✅ 検証項目チェックリスト

### 機能要件 (Section 7.1)
- [x] FR-001: セッション開始と状態遷移
- [x] FR-002: 初回AI挨拶
- [x] FR-003: 沈黙タイマー起動（猶予期間付き）
- [x] FR-004: 沈黙タイマーのインクリメント
- [x] FR-005: 沈黙タイマーのリセット（ユーザー発話時）
- [x] FR-006: 沈黙タイマーの一時停止（AI再生中）
- [x] FR-007: 沈黙タイマーの一時停止（処理中）
- [x] FR-008: 沈黙プロンプト表示（タイムアウト時）
- [x] FR-009: ユーザー音声検出と処理トリガー
- [x] FR-010: 音声検出の沈黙閾値（1200ms）
- [x] FR-011: AI応答生成と再生
- [x] FR-012: 全二重通信（ユーザー発話中のAI再生）
- [x] FR-013: 録音中の手動停止（speech_end送信）
- [x] FR-014: 手動停止時のAI処理スキップ
- [x] FR-015: 停止後のAI音声再生ブロック
- [x] FR-016: トランスクリプト表示順序
- [x] FR-017: エラーハンドリングとリカバリー

### UI/UX要件 (Section 7.2)
- [x] UX-001: ステータスバッジの色・テキスト
- [x] UX-002: マイクインジケーター（録音中パルス）
- [x] UX-003: スピーカーインジケーター（再生中アニメーション）
- [x] UX-004: 沈黙タイマー表示形式（"Silence: Xs / 10s"）
- [x] UX-005: 処理ステージ表示（"Transcribing..." / "Generating..." / "Synthesizing..."）
- [ ] UX-006: UI更新レイテンシ（< 100ms）- パフォーマンステスト必要
- [x] UX-007: スムーズな遷移（フリッカーなし）
- [x] UX-008: ボタンラベルと無効化状態
- [x] UX-009: エラーダイアログ
- [x] UX-010: 低音量警告とヒント

### パフォーマンス要件 (Section 7.3)
- [ ] PERF-001: セッション開始時間 < 3秒
- [ ] PERF-002: STT処理時間 < 3秒（5秒発話）
- [ ] PERF-003: AI応答生成 < 5秒
- [ ] PERF-004: TTS合成時間 < 2秒
- [ ] PERF-005: 総応答時間 < 10秒
- [ ] PERF-006: UI更新レイテンシ < 100ms
- [ ] PERF-007: 音声再生開始 < 500ms
- [ ] PERF-008: メモリリーク検証（30分セッション）

**注意:** パフォーマンステストは別途実施が必要

---

## 🔄 CI/CD統合

### GitHub Actions例

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

---

## 📚 関連ドキュメント

- [SESSION_PLAYER_VERIFICATION_PLAN.md](../../docs/07-development/SESSION_PLAYER_VERIFICATION_PLAN.md) - 完全な検証計画
- [SESSION_PLAYER_CODE_AUDIT_RESULTS.md](../../docs/07-development/SESSION_PLAYER_CODE_AUDIT_RESULTS.md) - コード監査結果
- [Playwright公式ドキュメント](https://playwright.dev/)

---

## 🆘 トラブルシューティング

### テストがタイムアウトする

**原因:** WebSocket接続が確立できない、バックエンドが起動していない

**解決策:**
```bash
# バックエンドWebSocketサーバーを起動
cd infrastructure/lambda/websocket
npm run dev

# またはモックサーバーを使用
npm run dev:ws
```

### マイク権限エラー

**原因:** Playwright設定でマイク権限が許可されていない

**解決策:** `playwright.config.ts` を確認:
```typescript
use: {
  permissions: ['microphone', 'camera'],
}
```

### "test-session-id" が見つからない

**原因:** Stage 1-2のテストは実際のセッションIDを必要としない（モック）

**解決策:** テストコードで適切なモック設定を確認

### Stage 3テストがスキップされる

**原因:** バックエンドサーバーが起動していない

**解決策:**
```bash
# 開発環境でバックエンドを起動
npm run dev:backend

# または、Stage 1-2のみ実行
npm run test:e2e:stage1
npm run test:e2e:stage2
```

---

**最終更新:** 2026-03-16
**次回レビュー:** テスト実行完了後
