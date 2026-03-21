# Phase 1.6.1 Day 35 - シナリオエンジン改善実装記録

**日付:** 2026-03-21
**Phase:** Phase 1.6.1 (既存機能の実用化)
**Day:** 35 (Week 2.5-3, Day 17-18)
**目標:** シナリオバリデーション・エラーリカバリー実装

---

## 📋 実装概要

### 目的
シナリオ実行前のバリデーション、実行中のエラーハンドリング、そして適切なリカバリー戦略を実装し、システムの信頼性を向上させる。

### 実装範囲
1. ✅ シナリオバリデーター実装
2. ✅ エラーリカバリーハンドラー実装
3. ✅ WebSocket統合（authenticate/処理時バリデーション）
4. ✅ エラーリトライ・スキップ・終了ロジック
5. ✅ 無限ループ防止（最大ターン数・セッション時間制限）

---

## 🔧 実装詳細

### 1. シナリオバリデーター (`shared/scenario/validator.ts`)

**新規作成:**
- `validateScenario()` - シナリオ設定のバリデーション
- `validateExecutionState()` - 実行状態のバリデーション（無限ループ防止）
- `formatValidationErrors()` - エラーメッセージのフォーマット

**検証項目:**
```typescript
// 必須フィールド検証
- title: 必須
- systemPrompt: 必須、長さチェック (50-10000文字)
- language: 有効な言語コード ('ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it')

// 推奨設定検証（警告）
- initialGreeting: 推奨
- conversationFlow: ループ構造チェック（maxIterations必須）

// 実行状態検証
- turnCount: 最大100ターン（無限ループ防止）
- sessionDuration: 最大3600秒（1時間）
- conversationHistory: サイズ制限
```

**バリデーション結果:**
```typescript
interface ScenarioValidationResult {
  isValid: boolean;
  errors: ScenarioValidationError[];    // 致命的エラー
  warnings: ScenarioValidationError[];  // 警告（非ブロッキング）
}
```

### 2. エラーリカバリーハンドラー (`shared/scenario/error-handler.ts`)

**新規作成:**
- `determineRecoveryStrategy()` - エラータイプに応じたリカバリー戦略決定
- `handleAIGenerationError()` - AI生成エラー処理
- `handleTTSGenerationError()` - TTS生成エラー処理
- `handleSTTRecognitionError()` - STT認識エラー処理
- `handleValidationError()` - バリデーションエラー処理
- `handleTimeoutError()` - タイムアウトエラー処理

**リカバリー戦略:**
```typescript
interface RecoveryResult {
  shouldRetry: boolean;        // リトライすべきか
  shouldSkip: boolean;         // スキップして継続すべきか
  shouldTerminate: boolean;    // セッション終了すべきか
  fallbackResponse?: string;   // フォールバック応答（多言語対応）
}
```

**エラータイプ別戦略:**

| エラータイプ | 1回目 | 2回目 | 3回目 |
|------------|------|------|------|
| **AI生成** | 即座にリトライ | フォールバックプロンプトでリトライ | スキップして継続 |
| **TTS生成** | リトライ | スキップ（テキストのみ） | - |
| **STT認識** | リトライ | ユーザーに再発話依頼 | - |
| **バリデーション** | 即座に終了 | - | - |
| **タイムアウト** | リトライ | 終了 | - |

**多言語対応フォールバックメッセージ:**
- 10言語対応（ja, en, zh-CN, zh-TW, ko, es, pt, fr, de, it）
- エラータイプごとに適切なメッセージ

### 3. WebSocket統合 (`websocket/default/index.ts`)

#### 3.1 ConnectionData拡張

```typescript
interface ConnectionData {
  // Phase 1.6.1 Day 35: 追加フィールド
  turnCount?: number;          // 会話ターン数
  sessionStartTime?: number;   // セッション開始時刻
  lastErrorType?: string;      // 最後のエラータイプ
  errorAttemptCount?: number;  // エラーリトライ回数
}
```

#### 3.2 authenticate メッセージハンドリング

**実装内容:**
```typescript
// 1. シナリオバリデーション実行
const validationResult = validateScenario({
  title: scenarioTitle,
  systemPrompt: scenarioPrompt,
  language: scenarioLanguage,
  initialGreeting,
});

// 2. 警告をクライアントに送信（非ブロッキング）
if (validationResult.warnings.length > 0) {
  await sendToConnection(connectionId, {
    type: 'validation_warning',
    warnings: validationResult.warnings,
  });
}

// 3. エラーの場合は認証失敗
if (!validationResult.isValid) {
  await sendToConnection(connectionId, {
    type: 'authentication_failed',
    error: 'Scenario validation failed',
    details: validationResult.errors,
  });
  return; // 処理中断
}

// 4. セッション状態初期化
await updateConnectionData(connectionId, {
  turnCount: 0,
  sessionStartTime: Date.now(),
  errorAttemptCount: 0,
});
```

#### 3.3 handleAudioProcessingStreaming 関数

**実装内容:**
```typescript
// 1. 実行状態バリデーション（無限ループ防止）
const executionValidation = validateExecutionState({
  sessionId,
  turnCount: connectionData?.turnCount || 0,
  conversationHistory: connectionData?.conversationHistory || [],
  startTime: connectionData?.sessionStartTime || Date.now(),
});

// 2. 警告送信（非ブロッキング）
if (executionValidation.warnings.length > 0) {
  await sendToConnection(connectionId, {
    type: 'execution_warning',
    warnings: executionValidation.warnings,
  });
}

// 3. 制限超過の場合はセッション終了
if (!executionValidation.isValid) {
  await sendToConnection(connectionId, {
    type: 'session_terminated',
    reason: 'execution_limit_exceeded',
    details: executionValidation.errors,
  });
  return; // 処理中断
}

// 4. 成功時: ターン数インクリメント
const currentTurnCount = (connectionData?.turnCount || 0) + 1;
await updateConnectionData(connectionId, {
  conversationHistory: updatedHistory,
  turnCount: currentTurnCount,
  errorAttemptCount: 0, // リセット
});

// 5. エラー時: リカバリー戦略決定
catch (error) {
  const recoveryResult = determineRecoveryStrategy({
    sessionId,
    errorType,
    errorMessage,
    attemptNumber: connectionData?.errorAttemptCount || 0,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    language: connectionData?.scenarioLanguage,
  });

  // エラーカウンタ更新
  await updateConnectionData(connectionId, {
    lastErrorType: errorType,
    errorAttemptCount: (connectionData?.errorAttemptCount || 0) + 1,
  });

  if (recoveryResult.shouldTerminate) {
    // セッション終了
    await sendToConnection(connectionId, {
      type: 'session_terminated',
      reason: 'max_errors_exceeded',
      message: recoveryResult.fallbackResponse,
    });
  } else if (recoveryResult.shouldSkip) {
    // スキップして継続
    await sendToConnection(connectionId, {
      type: 'error_recovered',
      message: recoveryResult.fallbackResponse,
      errorType,
    });
  } else if (recoveryResult.shouldRetry) {
    // リトライ通知
    await sendToConnection(connectionId, {
      type: 'processing_retry',
      attemptNumber: currentAttempts + 1,
      maxAttempts: MAX_RETRY_ATTEMPTS,
    });
  }
}
```

### 4. 環境変数設定 (`.env.local`)

**追加した環境変数:**
```bash
#############################################
# Scenario Validation Configuration
# Phase 1.6.1 Day 35: バリデーション・エラーリカバリー
#############################################
MIN_PROMPT_LENGTH=50            # 最小プロンプト長（文字数）
MAX_PROMPT_LENGTH=10000         # 最大プロンプト長（文字数）
MAX_CONVERSATION_TURNS=100      # 最大会話ターン数（無限ループ防止）
MAX_SESSION_DURATION_SEC=3600   # 最大セッション時間（1時間）
MAX_RETRY_ATTEMPTS=3            # 最大リトライ回数
```

---

## 📊 新しいWebSocketメッセージタイプ

### クライアント → サーバー
既存のメッセージタイプを使用（変更なし）

### サーバー → クライアント（新規）

#### 1. `validation_warning`
```typescript
{
  type: 'validation_warning',
  warnings: Array<{
    field: string;
    message: string;
    severity: 'warning';
  }>,
  timestamp: number
}
```
**タイミング:** authenticate時、シナリオ設定に警告がある場合
**動作:** 非ブロッキング（セッション継続可能）

#### 2. `authentication_failed`
```typescript
{
  type: 'authentication_failed',
  error: string,
  details: Array<{
    field: string;
    message: string;
    severity: 'error';
  }>,
  timestamp: number
}
```
**タイミング:** authenticate時、シナリオバリデーション失敗
**動作:** ブロッキング（セッション開始不可）

#### 3. `execution_warning`
```typescript
{
  type: 'execution_warning',
  warnings: Array<{
    field: string;
    message: string;
    severity: 'warning';
  }>,
  timestamp: number
}
```
**タイミング:** 音声処理時、ターン数/時間制限に近づいた場合
**動作:** 非ブロッキング（処理継続）

#### 4. `session_terminated`
```typescript
{
  type: 'session_terminated',
  reason: 'execution_limit_exceeded' | 'max_errors_exceeded',
  message?: string,
  details?: Array<ValidationError>,
  timestamp: number
}
```
**タイミング:** ターン数/時間制限超過、または最大エラー回数超過
**動作:** セッション強制終了

#### 5. `error_recovered`
```typescript
{
  type: 'error_recovered',
  message: string,        // 多言語対応フォールバックメッセージ
  errorType: string,
  timestamp: number
}
```
**タイミング:** エラー発生後、スキップして継続する場合
**動作:** ユーザーにエラー通知、会話継続

#### 6. `processing_retry`
```typescript
{
  type: 'processing_retry',
  attemptNumber: number,
  maxAttempts: number,
  timestamp: number
}
```
**タイミング:** エラー発生後、リトライする場合
**動作:** リトライ中であることをユーザーに通知

---

## 🧪 テストシナリオ

### 1. シナリオバリデーション
```typescript
// ✅ 正常ケース
- systemPrompt: 50-10000文字
- language: 'ja', 'en', etc.
- initialGreeting: あり

// ❌ エラーケース
- systemPrompt: 空文字列 → authentication_failed
- systemPrompt: 10001文字以上 → authentication_failed
- language: 'invalid' → authentication_failed

// ⚠️ 警告ケース
- systemPrompt: 49文字以下 → validation_warning (非ブロッキング)
- initialGreeting: なし → validation_warning
```

### 2. 実行状態バリデーション
```typescript
// ✅ 正常ケース
- turnCount: 0-79 → 通常処理

// ⚠️ 警告ケース
- turnCount: 80-99 → execution_warning (非ブロッキング)
- sessionDuration: 2880-3599秒 → execution_warning

// ❌ エラーケース
- turnCount: 100以上 → session_terminated
- sessionDuration: 3600秒以上 → session_terminated
```

### 3. エラーリカバリー
```typescript
// AI生成エラー
- 1回目: リトライ（processing_retry）
- 2回目: フォールバックプロンプトでリトライ
- 3回目: スキップ（error_recovered）
- 4回目: 終了（session_terminated）

// TTS生成エラー
- 1回目: リトライ
- 2回目: テキストのみで継続（error_recovered）

// STT認識エラー
- 1回目: リトライ
- 2回目: ユーザーに再発話依頼（error_recovered）
```

---

## 🎯 達成した目標

### ✅ 完了した項目
1. **シナリオバリデーション実装**
   - 必須フィールド検証
   - プロンプト長検証
   - 言語コード検証
   - 警告システム実装

2. **無限ループ防止実装**
   - ターン数カウンター（最大100ターン）
   - セッション時間制限（最大1時間）
   - 実行状態バリデーション

3. **エラーリカバリー実装**
   - エラータイプ別リカバリー戦略
   - リトライロジック（最大3回）
   - スキップロジック
   - セッション終了ロジック
   - 多言語対応フォールバックメッセージ

4. **WebSocket統合**
   - authenticate時バリデーション
   - 音声処理時バリデーション
   - 新しいメッセージタイプ（6種類）
   - エラーカウンター・ターンカウンター管理

---

## 📈 効果・メリット

### 1. 信頼性向上
- **無限ループ防止**: ターン数・時間制限により、暴走を自動停止
- **エラーリカバリー**: 一時的なエラーから自動回復
- **バリデーション**: 不正なシナリオ設定を事前検出

### 2. ユーザー体験向上
- **透明性**: エラー内容・リトライ状況をリアルタイム通知
- **多言語対応**: ユーザーの言語でエラーメッセージ表示
- **柔軟性**: 警告は非ブロッキング（セッション継続可能）

### 3. 運用効率向上
- **デバッグ容易性**: 詳細なログ・バリデーション結果
- **自動回復**: 管理者介入不要でエラーから回復
- **リソース保護**: 無限ループ・長時間セッションを自動終了

---

## 🔄 次のステップ

### Day 36: シナリオキャッシュ・変数システム実装
- DynamoDBシナリオキャッシュ
- 変数型チェック
- 次のステップ事前計算
- テストモード（シナリオプレビュー）

### Day 37: 統合テスト・ユーザーテスト
- E2Eテスト実装
- エラーシナリオテスト
- パフォーマンステスト

---

## 📝 注意事項

### 1. 環境変数同期
```bash
# 環境変数追加後、必ず同期スクリプト実行
bash scripts/sync-env-vars.sh
```

### 2. デプロイ
```bash
# Lambda関数再デプロイ必要
cd infrastructure
npm run deploy:lambda
```

### 3. フロントエンド対応
新しいWebSocketメッセージタイプに対応するため、フロントエンド実装が必要:
- `validation_warning` - 警告表示UI
- `authentication_failed` - 認証失敗エラー画面
- `execution_warning` - セッション制限警告
- `session_terminated` - 強制終了通知
- `error_recovered` - エラー回復通知
- `processing_retry` - リトライ中インジケーター

---

**完了日時:** 2026-03-21 12:30 UTC
**所要時間:** 約2.5時間
**ステータス:** ✅ Day 35 完了 - バックエンド実装100%
**次の作業:** Day 36 - シナリオキャッシュ・変数システム実装
