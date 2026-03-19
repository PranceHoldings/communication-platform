# Silence Settings Fix - 検証手順

**修正日:** 2026-03-11 22:15 JST
**問題:** シナリオで設定したsilence関連の値がSessionPlayerで使用されていなかった
**根本原因:** Scenario GET/LIST APIがsilence管理フィールドを返していなかった

---

## 修正内容

### 1. Scenario GET API (`infrastructure/lambda/scenarios/get/index.ts`)

**Before:**
```typescript
select: {
  id: true,
  title: true,
  // ... silence管理フィールドなし
}
```

**After:**
```typescript
select: {
  id: true,
  title: true,
  // ...
  // Silence management fields
  initialGreeting: true,
  silenceTimeout: true,
  enableSilencePrompt: true,
  showSilenceTimer: true,
  silenceThreshold: true,
  minSilenceDuration: true,
}
```

### 2. Scenario LIST API (`infrastructure/lambda/scenarios/list/index.ts`)

同様の修正を適用。

### 3. SessionPlayer (`apps/web/components/session-player/index.tsx`)

**Before:**
```typescript
useAudioRecorder({
  silenceThreshold: 0.05, // 固定値
  silenceDuration: 500,   // 固定値
})
```

**After:**
```typescript
useAudioRecorder({
  silenceThreshold: scenario.silenceThreshold ?? 0.15, // シナリオから取得
  silenceDuration: scenario.minSilenceDuration ?? 500, // シナリオから取得
})
```

---

## 検証手順

### Step 1: Lambda関数デプロイ確認

```bash
# デプロイ完了を確認
aws lambda get-function --function-name prance-scenarios-get-dev \
  --query 'Configuration.LastModified'
```

期待値: 2026-03-11T以降のタイムスタンプ

### Step 2: API動作確認

```bash
# 認証トークン取得
TOKEN=$(curl -s -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@prance.com","password":"Admin2026!Prance"}' \
  | jq -r .accessToken)

# シナリオ取得
curl -s https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/scenarios/8e0a92e8-ae0b-46e0-8901-8631937d7d72 \
  -H "Authorization: Bearer $TOKEN" | jq '{silenceThreshold, minSilenceDuration, silenceTimeout}'
```

**期待値:**
```json
{
  "silenceThreshold": 0.05,  // または設定した値（nullではない！）
  "minSilenceDuration": 500, // または設定した値（nullではない！）
  "silenceTimeout": 10       // または設定した値（nullではない！）
}
```

### Step 3: シナリオ設定更新

1. ブラウザで http://localhost:3000 にアクセス
2. Dashboard → Scenarios → 既存シナリオを編集
3. Advanced Settings を展開
4. Silence Threshold を `0.15` に変更
5. Min Silence Duration を `700` に変更
6. Save

### Step 4: 更新された設定値を確認

```bash
# 同じシナリオを再取得
curl -s https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/scenarios/8e0a92e8-ae0b-46e0-8901-8631937d7d72 \
  -H "Authorization: Bearer $TOKEN" | jq '{silenceThreshold, minSilenceDuration}'
```

**期待値:**
```json
{
  "silenceThreshold": 0.15,  // ✅ 更新された値
  "minSilenceDuration": 700  // ✅ 更新された値
}
```

### Step 5: SessionPlayerでの動作確認

1. 新規セッションを作成（上記で更新したシナリオを使用）
2. セッション開始
3. マイクに向かって話す
4. ブラウザDevTools → Console を確認

**期待されるログ:**
```
[AudioRecorder:Silence] Silence detected {
  duration: 700,         // ✅ 設定した700msが使われている
  threshold: 700,        // ✅
  level: '0.16',         // ✅ silenceThreshold 0.15 を超えている
}
```

### Step 6: CloudWatch Logsで確認

```bash
# 最新のセッションのログを確認
aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --filter-pattern "\"Silence detected\""
```

**期待されるログ:**
- `duration: 700` (設定した値)
- `threshold: 700` (設定した値)

---

## 成功基準

以下のすべてが満たされた場合、修正成功：

- ✅ Scenario GET APIがsilence管理フィールドを返す（nullではない）
- ✅ シナリオ編集でsilence設定を変更できる
- ✅ 変更した設定値がAPIで取得できる
- ✅ SessionPlayerが変更した設定値を使用する
- ✅ ブラウザログに正しい`threshold`と`duration`が表示される

---

## トラブルシューティング

### API が null を返す場合

**原因:** DBに値が保存されていない

**対策:**
1. シナリオを編集して保存（デフォルト値が保存される）
2. または、DBマイグレーションで既存レコードにデフォルト値を設定：
   ```sql
   UPDATE scenarios
   SET silence_threshold = 0.05,
       min_silence_duration = 500,
       silence_timeout = 10,
       enable_silence_prompt = true,
       show_silence_timer = false
   WHERE silence_threshold IS NULL;
   ```

### ブラウザで古い値が使われる場合

**原因:** ブラウザキャッシュ

**対策:**
- ハードリフレッシュ: `Ctrl+Shift+R` (Win) / `Cmd+Shift+R` (Mac)
- または、ブラウザキャッシュをクリア

---

## 関連ファイル

- `infrastructure/lambda/scenarios/get/index.ts` - Scenario GET API
- `infrastructure/lambda/scenarios/list/index.ts` - Scenario LIST API
- `apps/web/components/session-player/index.tsx` - SessionPlayer
- `packages/database/prisma/schema.prisma` - Scenarioモデル定義
- `apps/web/app/dashboard/scenarios/[id]/edit/page.tsx` - シナリオ編集UI

---

**検証実施日時:** ___________
**検証者:** ___________
**結果:** ⬜ 成功 / ⬜ 失敗
**備考:** ___________
