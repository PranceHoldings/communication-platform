# UI設定項目とデータベース同期 厳守ルール

**作成日:** 2026-03-15 03:50 JST
**重要度:** 🔴 最重要（違反するとデータ不整合が発生）
**適用範囲:** 全てのUI設定可能項目

---

## 🔴 問題の重大性

**UI上で設定可能にした項目がデータベースに正しく保存・取得されていない場合:**

1. **ユーザーの設定が反映されない** → 信頼性の喪失
2. **設定したはずなのに動作しない** → サポートコスト増大
3. **データ不整合が発生** → バグの温床
4. **デバッグが困難** → 開発効率の低下

**過去の実例（2026-03-15）:**
- 沈黙タイマー設定がUI上で変更可能だったが、組織設定のデフォルト値が `false` でハードコードされていた
- シナリオ設定を「デフォルト使用」にしても、タイマーが表示されなかった
- 原因特定に時間がかかり、ユーザー体験を損ねた

---

## 📋 実装時の必須チェックリスト

UI設定項目を追加する際は、以下の**全ての項目**を確認してください。

### ✅ Phase 1: データモデル設計

- [ ] **1.1 Prismaスキーマ定義**
  - [ ] `packages/database/prisma/schema.prisma` にフィールド追加
  - [ ] 型を正しく定義（`Boolean?`, `Int?`, `String?`等）
  - [ ] `@map()` でデータベースカラム名を指定（snake_case）
  - [ ] コメントで用途を記述
  - [ ] `null` = デフォルト使用、という設計の場合は `?` を付ける

```prisma
model Scenario {
  // ✅ 正しい例
  showSilenceTimer Boolean? @map("show_silence_timer") // UIにタイマー表示（null = use org default）

  // ❌ 間違い例
  showSilenceTimer Boolean @default(false) @map("show_silence_timer") // デフォルト値を設定すると階層設定が効かない
}
```

- [ ] **1.2 マイグレーション作成**
  - [ ] `npx prisma migrate dev --name add_<feature>_settings`
  - [ ] マイグレーションファイルを確認（デフォルト値が意図通りか）
  - [ ] 既存データへの影響を検証

- [ ] **1.3 Prisma Client再生成**
  - [ ] `npx prisma generate`
  - [ ] 型定義が更新されることを確認

---

### ✅ Phase 2: 型定義

- [ ] **2.1 共有型定義（packages/shared）**
  - [ ] `packages/shared/src/types/index.ts` に追加
  - [ ] フロントエンド・バックエンドで共通の型を使用
  - [ ] オプショナル（`?`）か必須かを明確にする

```typescript
// ✅ 正しい例
export interface Scenario {
  id: string;
  title: string;
  showSilenceTimer?: boolean;  // オプショナル
  silenceTimeout?: number;
}

// ❌ 間違い例 - 重複定義
// apps/web/lib/api/scenarios.ts にも同じ型を定義
```

- [ ] **2.2 OrganizationSettings型（デフォルト値用）**
  - [ ] 組織レベルのデフォルト設定の場合、`OrganizationSettings` に追加
  - [ ] システムデフォルト値を決定

---

### ✅ Phase 3: バックエンド実装

#### 3.1 GET API（取得）

- [ ] **Prisma select に全フィールドを含める**

```typescript
// ✅ 正しい例 - scenarios/get/index.ts
const scenario = await prisma.scenario.findUnique({
  where: { id: scenarioId },
  select: {
    id: true,
    title: true,
    // ... 他のフィールド
    showSilenceTimer: true,        // ✅ 追加
    enableSilencePrompt: true,     // ✅ 追加
    silenceTimeout: true,          // ✅ 追加
  },
});
```

- [ ] **LIST APIでも同様に select に含める**
- [ ] **関連するネストされたクエリにも含める**
  - 例: `sessions/get` で `scenario` を include する場合

```typescript
// ✅ 正しい例 - sessions/get/index.ts
const session = await prisma.session.findUnique({
  include: {
    scenario: {
      select: {
        id: true,
        title: true,
        showSilenceTimer: true,  // ✅ 追加
      },
    },
  },
});
```

#### 3.2 UPDATE/CREATE API（保存）

- [ ] **リクエストボディから値を取得**

```typescript
// ✅ 正しい例 - scenarios/update/index.ts
const {
  title,
  category,
  showSilenceTimer,        // ✅ 追加
  enableSilencePrompt,     // ✅ 追加
  silenceTimeout,          // ✅ 追加
} = body;
```

- [ ] **updateData に含める（undefined チェック）**

```typescript
// ✅ 正しい例
const updateData: any = {};
if (title !== undefined) updateData.title = title;
if (showSilenceTimer !== undefined) updateData.showSilenceTimer = showSilenceTimer;  // ✅ 追加
```

- [ ] **Prisma select に含める（レスポンス用）**

```typescript
// ✅ 正しい例
const scenario = await prisma.scenario.update({
  where: { id: scenarioId },
  data: updateData,
  select: {
    id: true,
    title: true,
    showSilenceTimer: true,  // ✅ 追加（レスポンスに含める）
  },
});
```

#### 3.3 組織設定デフォルト値

- [ ] **DEFAULT_SETTINGS に追加**

```typescript
// ✅ 正しい例 - organizations/settings/index.ts
const DEFAULT_SETTINGS: OrganizationSettings = {
  showSilenceTimer: true,  // ✅ デフォルト値を決定
  enableSilencePrompt: true,
  silenceTimeout: 10,
};
```

- [ ] **デフォルト値の決定基準:**
  - ユーザーにとって最も便利な値
  - 安全な値（無効化して問題が起きるより、有効化して不要なら無効化できる方が良い）
  - ドキュメント化された値

---

### ✅ Phase 4: フロントエンド実装

#### 4.1 API型定義

- [ ] **フロントエンドAPI型にフィールド追加**

```typescript
// ✅ 正しい例 - apps/web/lib/api/scenarios.ts
export interface Scenario {
  id: string;
  title: string;
  showSilenceTimer?: boolean;  // ✅ 追加
}

export interface UpdateScenarioRequest {
  title?: string;
  showSilenceTimer?: boolean;  // ✅ 追加
}
```

#### 4.2 フォーム実装

- [ ] **state 変数を定義**

```typescript
// ✅ 正しい例
const [showSilenceTimer, setShowSilenceTimer] = useState<boolean | undefined>(undefined);
```

- [ ] **初期値をAPIレスポンスから設定**

```typescript
// ✅ 正しい例
useEffect(() => {
  const loadData = async () => {
    const data = await getScenario(id);
    setShowSilenceTimer(data.showSilenceTimer);  // ✅ 設定
  };
  loadData();
}, [id]);
```

- [ ] **UI要素（トグル、入力フィールド等）を実装**
- [ ] **3状態対応の場合（null/true/false）:**
  - グレー: デフォルト使用（`undefined`/`null`）
  - 緑: 有効（`true`）
  - 赤: 無効（`false`）

- [ ] **保存時にAPIに送信**

```typescript
// ✅ 正しい例
await updateScenario(id, {
  title: title.trim(),
  showSilenceTimer,  // ✅ 送信（undefinedも含む）
});
```

#### 4.3 詳細ページ表示

- [ ] **APIレスポンスから値を取得**
- [ ] **UIに表示**
  - 値の状態を視覚的に表現（バッジ、アイコン等）
  - 3状態の場合は明確に区別

```typescript
// ✅ 正しい例
{scenario.showSilenceTimer === true ? (
  <span className="badge-green">Enabled</span>
) : scenario.showSilenceTimer === false ? (
  <span className="badge-red">Disabled</span>
) : (
  <span className="badge-gray">Use Default</span>
)}
```

#### 4.4 実際の使用箇所

- [ ] **階層的設定の実装**

```typescript
// ✅ 正しい例 - SessionPlayer等
const effectiveValue = scenario.setting ?? orgSettings?.setting ?? SYSTEM_DEFAULT;
```

- [ ] **デバッグログの追加**

```typescript
// ✅ 正しい例
console.log('[Component] Settings:', {
  'scenario.setting': scenario.setting,
  'orgSettings?.setting': orgSettings?.setting,
  effectiveValue,
});
```

---

### ✅ Phase 5: 検証

#### 5.1 コードベース検証

```bash
# 自動検証スクリプト実行
npm run validate:ui-settings
```

**検証内容:**
- [ ] Prismaスキーマにフィールド存在
- [ ] GET APIの select に含まれている
- [ ] UPDATE/CREATE APIのbody抽出に含まれている
- [ ] UPDATE/CREATE APIのupdateDataに含まれている
- [ ] UPDATE/CREATE APIのselect（レスポンス）に含まれている
- [ ] フロントエンド型定義に含まれている
- [ ] 組織設定DEFAULT_SETTINGSに含まれている（該当する場合）

#### 5.2 実稼働検証

- [ ] **編集画面でデフォルト値が正しく表示される**
- [ ] **値を変更して保存できる**
- [ ] **詳細ページで保存した値が表示される**
- [ ] **実際の機能で設定が反映される**
- [ ] **階層的設定が正しく動作する（該当する場合）**
  - シナリオ個別設定 > 組織設定 > システムデフォルト

#### 5.3 エッジケース確認

- [ ] **null/undefined の扱いが正しい**
- [ ] **デフォルト値への戻し方が明確**
- [ ] **複数回保存しても値が変わらない（冪等性）**
- [ ] **他の設定項目との干渉がない**

---

## 🔍 検証スクリプトの使い方

### 新しい設定項目を追加した場合

```bash
# Step 1: フィールド名を指定して検証
npm run validate:ui-settings -- --field showSilenceTimer

# Step 2: 全フィールドを検証
npm run validate:ui-settings

# Step 3: デプロイ前検証（全チェック）
npm run pre-deploy
```

### 出力例

```
✅ Prisma Schema: showSilenceTimer found
✅ scenarios/get: showSilenceTimer in select
✅ scenarios/update: showSilenceTimer in body extraction
✅ scenarios/update: showSilenceTimer in updateData
✅ scenarios/update: showSilenceTimer in select (response)
✅ Frontend types: showSilenceTimer in Scenario interface
✅ Frontend types: showSilenceTimer in UpdateScenarioRequest
✅ Organization settings: showSilenceTimer in DEFAULT_SETTINGS
```

---

## 📚 ケーススタディ: 沈黙タイマー設定

### 問題が発生した経緯

1. **Prismaスキーマ:** ✅ 正しく定義されていた
2. **GET API:** ✅ select に含まれていた
3. **UPDATE API:** ✅ body抽出と updateData に含まれていた
4. **フロントエンド:** ✅ 型定義と実装は正しかった
5. **組織設定デフォルト値:** ❌ **`showSilenceTimer: false` がハードコード**

**結果:**
- シナリオ設定を「デフォルト使用」にすると、`false` になった
- タイマーが表示されなかった
- 原因特定に時間がかかった

### 学んだ教訓

1. **デフォルト値の重要性:**
   - デフォルト値は「最も便利な値」にする
   - `false` にすると機能が無効化され、気づきにくい

2. **階層的設定の検証:**
   - シナリオ個別設定だけでなく、組織設定も確認する
   - システムデフォルトまで追跡する

3. **検証スクリプトの必要性:**
   - 人間のレビューだけでは漏れる
   - 自動検証スクリプトで確実にチェック

---

## 🚫 よくある間違い

### 間違い1: GET APIに含め忘れ

```typescript
// ❌ 間違い
const scenario = await prisma.scenario.findUnique({
  select: {
    id: true,
    title: true,
    // showSilenceTimer が無い
  },
});
```

**影響:** フロントエンドで値が取得できず、`undefined` になる

---

### 間違い2: UPDATE APIのupdateDataに含め忘れ

```typescript
// ❌ 間違い
const { showSilenceTimer } = body;  // ✅ 抽出はしている

const updateData: any = {};
if (title !== undefined) updateData.title = title;
// showSilenceTimer を updateData に入れていない
```

**影響:** 値を送信しても保存されない

---

### 間違い3: デフォルト値が不適切

```typescript
// ❌ 間違い
const DEFAULT_SETTINGS = {
  showSilenceTimer: false,  // 機能が無効化される
};
```

**影響:** ユーザーが有効化したつもりでも動作しない

---

### 間違い4: 3状態の扱いが不完全

```typescript
// ❌ 間違い - undefined を true として扱ってしまう
const effectiveValue = scenario.setting || orgSettings?.setting || true;
// undefined || undefined → true になってしまう

// ✅ 正しい - Nullish coalescing を使う
const effectiveValue = scenario.setting ?? orgSettings?.setting ?? true;
```

---

## 📖 チェックリストテンプレート

新しいUI設定項目を追加する際は、このチェックリストをコピーして使用してください。

```markdown
## UI設定項目追加チェックリスト

**項目名:** `<fieldName>`
**データ型:** `Boolean` | `Int` | `String`
**デフォルト値:** `<value>`

### Phase 1: データモデル設計
- [ ] Prismaスキーマに追加
- [ ] マイグレーション作成
- [ ] Prisma Client再生成

### Phase 2: 型定義
- [ ] packages/shared/src/types/index.ts に追加
- [ ] OrganizationSettings に追加（該当する場合）

### Phase 3: バックエンド実装
- [ ] GET API: select に含める
- [ ] LIST API: select に含める
- [ ] 関連API: select に含める（sessions/get等）
- [ ] UPDATE/CREATE API: body抽出
- [ ] UPDATE/CREATE API: updateData追加
- [ ] UPDATE/CREATE API: select（レスポンス）
- [ ] 組織設定: DEFAULT_SETTINGS追加

### Phase 4: フロントエンド実装
- [ ] API型定義に追加
- [ ] state変数定義
- [ ] 初期値設定（APIレスポンスから）
- [ ] UI実装
- [ ] 保存時にAPI送信
- [ ] 詳細ページ表示
- [ ] 実際の使用箇所で反映

### Phase 5: 検証
- [ ] コードベース検証実行
- [ ] 編集→保存→表示の動作確認
- [ ] 階層的設定の動作確認
- [ ] エッジケース確認
```

---

## 🔗 関連ドキュメント

- [CONSISTENCY_GUIDELINES.md](../04-design/CONSISTENCY_GUIDELINES.md) - コード整合性ガイドライン
- [DATABASE_MIGRATION_CHECKLIST.md](./DATABASE_MIGRATION_CHECKLIST.md) - DBマイグレーションチェックリスト
- [LAMBDA_BUILD_DEPLOY_GUIDE.md](./LAMBDA_BUILD_DEPLOY_GUIDE.md) - Lambdaビルド・デプロイガイド
- [I18N_SYSTEM_GUIDELINES.md](./I18N_SYSTEM_GUIDELINES.md) - 多言語対応ガイドライン

---

**最終更新:** 2026-03-15 03:50 JST
**適用開始:** 即時
**違反時の対応:** Pull Requestレビューで修正を要求
