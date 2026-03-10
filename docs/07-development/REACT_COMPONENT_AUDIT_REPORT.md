# Reactコンポーネント監査レポート

**実施日:** 2026-03-11
**監査者:** Claude AI Assistant
**対象:** apps/web プロジェクト全体

---

## 📊 監査サマリー

### 統計情報
- **検証対象コンポーネント:** 優先度A（6ファイル）+ 優先度B（2ファイル）
- **useEffect総数:** 31
- **useCallback総数:** 48
- **useMemo総数:** 0

### 結果
- 🔴 **致命的な問題:** 1件（修正済み）
- 🟡 **推奨改善:** 7件（非致命的）
- ✅ **問題なし:** 優先度Aの5ファイル

---

## 🔴 致命的な問題（修正済み）

### Issue #1: SessionPlayer初期化エラー（TDZ違反）

**ファイル:** `components/session-player/index.tsx`
**発見日時:** 2026-03-11 14:30 JST
**ステータス:** ✅ 修正完了

#### 問題の詳細
```typescript
// ❌ 誤った実装（修正前）

// Line 656: useEffectが先に定義
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    handleStart();  // ← この時点でhandleStartは未定義
    handleStop();
    handlePause();
  };
  // ...
}, [status, handleStart, handleStop, handlePause]);  // ← TDZ違反

// Line 917: 関数定義がuseEffectより後
const handleStart = async () => { /* ... */ };
const handlePause = () => { /* ... */ };
const handleStop = () => { /* ... */ };
```

#### 発生したエラー
```
Cannot access 'handleStart' before initialization
Block-scoped variable 'handleStart' used before its declaration
```

#### 根本原因
1. **定義順序の逆転**: useEffectが関数定義より前に配置
2. **TDZ（Temporal Dead Zone）違反**: 依存配列に未定義の変数を参照
3. **useCallbackの欠如**: 通常の関数定義（const fn = () => {}）を使用

#### 修正内容
```typescript
// ✅ 正しい実装（修正後）

// 1. 関数をuseCallbackでラップし、useEffectより前に配置
const handleStart = useCallback(async () => {
  // ...実装
}, [token, status, t, startVisualizer, resumeRecording]);

const handlePause = useCallback(() => {
  // ...実装
}, [status, pauseRecording, stopVisualizer, t]);

const handleStop = useCallback(() => {
  // ...実装
}, [status, isMicRecording, stopRecording, stopVisualizer, t]);

// 2. useEffectで参照（問題なく動作）
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    handleStart();  // ✅ 正常に参照可能
    handleStop();
    handlePause();
  };
  // ...
}, [status, handleStart, handleStop, handlePause]);
```

#### 修正後の検証
```bash
# TypeScript型チェック: エラー0件
$ npx tsc --noEmit --skipLibCheck
# → 成功

# 開発サーバー: 正常稼働
$ curl http://localhost:3000
# → 200 OK
```

#### 影響範囲
- SessionPlayerコンポーネント全体
- キーボードショートカット機能（Space, P, M, Escape, ?）
- セッション開始/一時停止/停止の全機能

---

## 🟡 推奨改善（非致命的）

### Issue #2-8: 通常関数定義の使用

以下のファイルで、useCallbackを使うべきイベントハンドラーが通常の関数定義（const fn = () => {}）で実装されています。

| # | ファイル | 関数名 | 重要度 | 理由 |
|---|---------|--------|--------|------|
| 2 | recording-player.tsx | handleTimeUpdate | 🟡 低 | useEffectで未使用 |
| 3 | recording-player.tsx | handleLoadedMetadata | 🟡 低 | useEffectで未使用 |
| 4 | recording-player.tsx | handleSeek | 🟡 低 | useEffectで未使用 |
| 5 | recording-player.tsx | handlePlaybackRateChange | 🟡 低 | useEffectで未使用 |
| 6 | recording-player.tsx | handleVolumeChange | 🟡 低 | useEffectで未使用 |
| 7 | recording-player.tsx | handleTranscriptClick | 🟡 低 | useEffectで未使用 |
| 8 | language-switcher.tsx | handleLanguageChange | 🟡 低 | useEffectで未使用 |

#### 現状の影響
- ✅ **致命的なエラーは発生しない**: useEffectの依存配列に含まれていないため
- ⚠️ **パフォーマンス**: 毎レンダーで関数が再生成される（軽微）
- ⚠️ **一貫性**: プロジェクト全体でuseCallbackを使うべき

#### 推奨される修正
```typescript
// 現状（非致命的だが推奨されない）
const handleTimeUpdate = () => {
  // ...
};

// 推奨（ベストプラクティス）
const handleTimeUpdate = useCallback(() => {
  // ...
}, [/* 依存する変数 */]);
```

---

## ✅ 問題なしのコンポーネント

### 優先度A（複雑なライフサイクル）

#### 1. SessionPlayer (components/session-player/index.tsx)
- **useEffect:** 20個
- **useCallback:** 18個
- **ステータス:** ✅ 修正完了
- **コメント:** Issue #1修正後、すべてのフック順序が適切

#### 2. VideoComposer (components/session-player/video-composer.tsx)
- **useEffect:** 1個
- **useCallback:** 1個
- **ステータス:** ✅ 問題なし
- **コメント:** useCallbackがuseEffectより前、依存配列も正確

#### 3. useWebSocket (hooks/useWebSocket.ts)
- **useEffect:** 4個
- **useCallback:** 11個
- **ステータス:** ✅ 問題なし
- **コメント:**
  - コールバックをrefに保存して安定した参照を保持
  - すべてのuseCallbackがuseEffectより前
  - 依存配列が正確

#### 4. useAudioRecorder (hooks/useAudioRecorder.ts)
- **useEffect:** 0個
- **useCallback:** 6個
- **ステータス:** ✅ 問題なし
- **コメント:**
  - useEffectを使用していない（状態管理のみ）
  - monitorAudioLevelがstartRecordingの依存配列に正しく含まれる

#### 5. useVideoRecorder (hooks/useVideoRecorder.ts)
- **useEffect:** 1個
- **useCallback:** 4個
- **ステータス:** ✅ 問題なし
- **コメント:** すべてのuseCallbackがuseEffectより前

#### 6. useAudioVisualizer (hooks/useAudioVisualizer.ts)
- **useEffect:** 1個
- **useCallback:** 3個
- **ステータス:** ✅ 問題なし
- **コメント:** クリーンアップ関数が適切に実装

---

## 🎓 検出されたパターンと教訓

### 良好なパターン（踏襲すべき）

#### 1. コールバックをrefに保存（useWebSocket.ts）
```typescript
// コールバックをrefに保存して安定した参照を保持
const onTranscriptRef = useRef(onTranscript);
const onAvatarResponseRef = useRef(onAvatarResponse);

// 毎レンダーでrefを更新
useEffect(() => {
  onTranscriptRef.current = onTranscript;
  onAvatarResponseRef.current = onAvatarResponse;
});

// useCallbackの依存配列にrefは不要
const handleMessage = useCallback((message) => {
  onTranscriptRef.current?.(message);  // ✅ 常に最新のコールバックを使用
}, []); // ✅ 依存配列が空でも安全
```

**利点:**
- 依存配列が空または最小限で済む
- 無限ループを防止
- 親コンポーネントの再レンダー時にuseCallbackが再生成されない

#### 2. useCallbackの適切な使用
```typescript
// ✅ 正しいパターン
const handleStart = useCallback(async () => {
  // ...
}, [token, status, t]);  // 実際に依存する変数のみ

// useEffectで参照
useEffect(() => {
  // ...
  handleStart();
}, [handleStart]);
```

#### 3. 3段階のクリーンアップ（useAudioRecorder.ts）
```typescript
const restartRecording = useCallback(() => {
  // Phase 1: Stop old recorder and disable handlers
  oldRecorder.ondataavailable = null;
  oldRecorder.onstop = null;
  oldRecorder.stop();

  // Phase 2: Reset state
  sequenceNumberRef.current = 0;

  // Phase 3: Create and start new recorder
  const newRecorder = new MediaRecorder(stream);
  newRecorder.start();
}, []);
```

**利点:**
- 競合状態を防止
- リソースリークを防止
- 予測可能な動作

### 避けるべきパターン

#### 1. useEffectより後で関数定義（今回の問題）
```typescript
// ❌ TDZ違反
useEffect(() => {
  handleClick();  // ← エラー: 未定義
}, [handleClick]);

const handleClick = () => {};  // ← 遅すぎる
```

#### 2. 不要な依存配列
```typescript
// ❌ 安定した参照を依存配列に含める
const { start } = useVideoRecorder();
useEffect(() => {
  start();
}, [start]);  // ← startは安定した参照なので不要

// ✅ 依存配列から除外
useEffect(() => {
  start();
}, []);  // ← OK
```

#### 3. 条件付きフック呼び出し
```typescript
// ❌ Rules of Hooks違反
if (condition) {
  useEffect(() => {}, []);  // ← フックは条件分岐内で呼べない
}

// ✅ 正しいパターン
useEffect(() => {
  if (condition) {
    // 条件をuseEffectの中に入れる
  }
}, [condition]);
```

---

## 🛠️ 修正推奨アクション

### 即座に対応（必須）
- ✅ Issue #1: SessionPlayer初期化エラー → **完了**

### 短期対応（推奨）
- [ ] Issue #2-8: recording-player.tsx と language-switcher.tsx の関数をuseCallbackでラップ
- [ ] ESLint React Hooks Pluginの設定強化
- [ ] ベストプラクティスドキュメントの作成

### 中期対応（改善）
- [ ] すべてのコンポーネントで通常関数定義を検出
- [ ] 自動検出スクリプトの作成
- [ ] CI/CDパイプラインに統合

---

## 📋 修正コマンド（Issue #2-8対応）

recording-player.tsxとlanguage-switcher.tsxの関数をuseCallbackでラップする場合：

```bash
# 対象ファイル
apps/web/components/session-player/recording-player.tsx
apps/web/components/language-switcher.tsx

# 手動修正が必要（依存配列を正確に設定する必要があるため）
# 例:
# const handleTimeUpdate = () => { ... };
# ↓
# const handleTimeUpdate = useCallback(() => { ... }, [依存変数]);
```

**注意:** 自動修正は推奨しません。依存配列を正確に設定する必要があるため、手動でレビューしながら修正してください。

---

## 🎯 次のステップ

### 完了項目
- ✅ SessionPlayer初期化エラー修正
- ✅ 優先度Aコンポーネント検証
- ✅ 監査レポート作成

### 残タスク
1. ベストプラクティスドキュメント作成
2. ESLint設定強化
3. Issue #2-8の修正（オプショナル）
4. CI/CD統合

---

## 📚 参考資料

### 公式ドキュメント
- [React Hooks Rules](https://react.dev/reference/react#hook-rules)
- [useEffect Dependencies](https://react.dev/learn/synchronizing-with-effects#step-2-specify-the-effect-dependencies)
- [useCallback](https://react.dev/reference/react/useCallback)

### プロジェクト内ドキュメント
- [REACT_COMPONENT_AUDIT_PLAN.md](./REACT_COMPONENT_AUDIT_PLAN.md)
- [MEDIARECORDER_LIFECYCLE.md](./MEDIARECORDER_LIFECYCLE.md)

---

**最終更新:** 2026-03-11 15:30 JST
**ステータス:** ✅ 優先度A完了、推奨改善7件を識別
