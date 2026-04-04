# NULL vs UNDEFINED Guidelines

**バージョン:** 1.0
**作成日:** 2026-03-16
**最終更新:** 2026-03-16

---

## 📋 目的

このドキュメントは、Prance Communication Platformにおける `null` と `undefined` の使い分けを定義し、フロントエンド、バックエンド、API、スキーマ、Prisma間で一貫性を保つためのガイドラインです。

---

## 🎯 基本原則

### Rule 1: 各レイヤーでの使い分け

| レイヤー | 使用する値 | 理由 |
|---------|-----------|------|
| **Prisma Schema** | `Type?` (nullable) | PostgreSQLでNULLを表現 |
| **Database** | `NULL` | SQL標準、値が未設定を表現 |
| **Backend Lambda** | `null` | JSON標準、データベースと一致 |
| **API (Request/Response)** | `null` | JSON.stringify()で保持される |
| **Frontend API Types** | `Type \| null` | APIレスポンスと一致 |
| **Frontend UI State** | `undefined` | TypeScript optional型、未設定を表現 |

### Rule 2: 変換は境界でのみ行う

**✅ 正しい: 境界での変換**

```typescript
// API取得時（Backend → Frontend）
const scenario = await getScenario(id);
setShowSilenceTimer(scenario.showSilenceTimer === null ? undefined : scenario.showSilenceTimer);

// API送信時（Frontend → Backend）
const updateData = {
  showSilenceTimer: showSilenceTimer === undefined ? null : showSilenceTimer,
};
```

**❌ 間違い: 内部での混在**

```typescript
// ❌ フロントエンド内部でnullを使用
const [showSilenceTimer, setShowSilenceTimer] = useState<boolean | null>(null);

// ❌ バックエンド内部でundefinedを使用
const updateData: any = {};
if (showSilenceTimer !== undefined) updateData.showSilenceTimer = showSilenceTimer;
```

---

## 📐 実装パターン

### 1. Prisma Schema定義

```prisma
model Scenario {
  id               String   @id @default(cuid())
  title            String
  showSilenceTimer Boolean? @map("show_silence_timer")  // nullable
  // ...
}
```

**ポイント:**
- `Boolean?` で nullable（NULL許容）
- `@map()` でsnake_caseのDB列名にマッピング

### 2. Backend Lambda (GET)

```typescript
// infrastructure/lambda/scenarios/get/index.ts
const scenario = await prisma.scenario.findUnique({
  where: { id: scenarioId },
  select: {
    id: true,
    title: true,
    showSilenceTimer: true,  // null | true | false
  },
});

// JSONレスポンス（nullをそのまま返す）
return successResponse(scenario);
```

**ポイント:**
- Prismaから取得した値（null | true | false）をそのまま返す
- 変換なし

### 3. Backend Lambda (UPDATE)

```typescript
// infrastructure/lambda/scenarios/update/index.ts
const body = JSON.parse(event.body || '{}');
const { showSilenceTimer } = body;

// 'in' operatorでnull値を検出
const updateData: any = {};
if ('showSilenceTimer' in body) {
  updateData.showSilenceTimer = showSilenceTimer;  // null | true | false
}

await prisma.scenario.update({
  where: { id: scenarioId },
  data: updateData,
});
```

**ポイント:**
- `'showSilenceTimer' in body` で null 値も検出
- `if (showSilenceTimer !== undefined)` は ❌（null を無視してしまう）

### 4. Frontend API Types

```typescript
// apps/web/lib/api/scenarios.ts
export interface Scenario {
  id: string;
  title: string;
  showSilenceTimer: boolean | null;  // ✅ null を明示的に許容
}

export interface UpdateScenarioRequest {
  title?: string;
  showSilenceTimer?: boolean | null;  // ✅ null を明示的に許容
}
```

**ポイント:**
- APIレスポンスと一致させるため `boolean | null`
- `?:` はフィールド自体が省略可能（送信しない場合）
- `| null` は明示的に null を送信する場合

### 5. Frontend Component State

```typescript
// apps/web/app/dashboard/scenarios/[id]/edit/page.tsx
const [showSilenceTimer, setShowSilenceTimer] = useState<boolean | undefined>(undefined);

// API取得時: null → undefined に変換
useEffect(() => {
  const loadScenario = async () => {
    const scenario = await getScenario(id);
    setShowSilenceTimer(
      scenario.showSilenceTimer === null ? undefined : scenario.showSilenceTimer
    );
  };
  loadScenario();
}, [id]);

// API送信時: undefined → null に変換
const handleSubmit = async () => {
  const updateData = {
    title: title.trim(),
    showSilenceTimer: showSilenceTimer === undefined ? null : showSilenceTimer,
  };
  await updateScenario(id, updateData);
};
```

**ポイント:**
- UI状態は `undefined` を使用（TypeScript optional型）
- 取得時: `null → undefined`
- 送信時: `undefined → null`

### 6. Frontend Component Props

```typescript
// apps/web/components/session-player/index.tsx
interface UseWebSocketOptions {
  initialGreeting?: string;          // ✅ undefined を使用
  enableSilencePrompt?: boolean;     // ✅ undefined を使用
  silenceThreshold?: number;         // ✅ undefined を使用
}

// Scenario から WebSocket options へ変換
const { connect } = useWebSocket({
  initialGreeting: scenario.initialGreeting ?? undefined,
  enableSilencePrompt: scenario.enableSilencePrompt ?? undefined,
  silenceThreshold: scenario.silenceThreshold ?? undefined,
});
```

**ポイント:**
- Props/Options は `undefined` を使用（optional）
- `?? undefined` で null を undefined に変換

---

## 🔄 データフロー全体図

```
┌─────────────────────────────────────────────────────────────┐
│ Database (PostgreSQL)                                       │
│   show_silence_timer: NULL | true | false                  │
└─────────────────────────────────────────────────────────────┘
                            ↕ Prisma
┌─────────────────────────────────────────────────────────────┐
│ Backend Lambda (Node.js)                                    │
│   showSilenceTimer: null | true | false                    │
└─────────────────────────────────────────────────────────────┘
                            ↕ JSON API
┌─────────────────────────────────────────────────────────────┐
│ Frontend API Types (TypeScript)                             │
│   showSilenceTimer: boolean | null                         │
└─────────────────────────────────────────────────────────────┘
                            ↕ Conversion (境界)
┌─────────────────────────────────────────────────────────────┐
│ Frontend UI State (React)                                   │
│   showSilenceTimer: boolean | undefined                    │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ チェックリスト

新しいnullable フィールドを追加する際の必須チェックリスト：

### Backend

- [ ] Prisma Schema: `Type?` で nullable 定義
- [ ] GET API: `select` に含める
- [ ] UPDATE API: `'fieldName' in body` で null 検出
- [ ] CREATE API: `'fieldName' in body` で null 検出

### Frontend

- [ ] API Types: `Type | null` で定義
- [ ] Component State: `Type | undefined` で定義
- [ ] API取得時: `field === null ? undefined : field` で変換
- [ ] API送信時: `field === undefined ? null : field` で変換
- [ ] Props/Options: `field ?? undefined` で変換

### 検証

```bash
# 1. 型エラーチェック
pnpm run typecheck

# 2. データフロー検証
pnpm run validate:ui-settings

# 3. 実稼働テスト
# - デフォルト設定（undefined → null）
# - 有効設定（true → true）
# - 無効設定（false → false）
```

---

## 🚫 よくある間違い

### ❌ 間違い 1: API型でnullを許容していない

```typescript
// ❌ 間違い
export interface Scenario {
  showSilenceTimer?: boolean;  // null が型エラーになる
}

// ✅ 正しい
export interface Scenario {
  showSilenceTimer?: boolean | null;
}
```

### ❌ 間違い 2: undefined をJSON送信

```typescript
// ❌ 間違い（undefinedはJSON.stringify()で削除される）
const updateData = {
  showSilenceTimer: showSilenceTimer,  // undefined → フィールドが消える
};

// ✅ 正しい
const updateData = {
  showSilenceTimer: showSilenceTimer === undefined ? null : showSilenceTimer,
};
```

### ❌ 間違い 3: nullをUI状態で使用

```typescript
// ❌ 間違い（UIではundefinedを使用）
const [showSilenceTimer, setShowSilenceTimer] = useState<boolean | null>(null);

// ✅ 正しい
const [showSilenceTimer, setShowSilenceTimer] = useState<boolean | undefined>(undefined);
```

### ❌ 間違い 4: 変換を忘れる

```typescript
// ❌ 間違い（nullがそのまま渡される）
const { connect } = useWebSocket({
  enableSilencePrompt: scenario.enableSilencePrompt,  // null | true | false
});

// ✅ 正しい
const { connect } = useWebSocket({
  enableSilencePrompt: scenario.enableSilencePrompt ?? undefined,
});
```

---

## 📊 意味の違い

| 値 | 意味 | 使用箇所 |
|----|------|----------|
| `undefined` | 値が設定されていない（省略可能） | UI State, Props, Options |
| `null` | 明示的に「値なし」を設定 | Database, API |
| `false` | 明示的に「無効」を設定 | すべて |
| `true` | 明示的に「有効」を設定 | すべて |

**3-State Toggle の例:**
- `undefined` / `null`: デフォルト使用（組織設定を使用）
- `true`: 明示的に有効
- `false`: 明示的に無効

---

## 🔍 検証コマンド

```bash
# API型定義でnullが許容されているか確認
grep -n "showSilenceTimer.*:" apps/web/lib/api/scenarios.ts

# UI状態でundefinedが使用されているか確認
grep -n "useState.*showSilenceTimer" apps/web/app/dashboard/scenarios/\[id\]/edit/page.tsx

# 変換処理が実装されているか確認
grep -n "=== null ? undefined\|=== undefined ? null" apps/web
```

---

## 📚 関連ドキュメント

- [UI Settings Database Sync Rules](./UI_SETTINGS_DATABASE_SYNC_RULES.md)
- [TypeScript Strict Null Checks](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#truthiness-narrowing)
- [JSON Specification](https://www.json.org/json-en.html)

---

**最終更新:** 2026-03-16
**次回レビュー:** 新しいnullable フィールド追加時
