# Reactコンポーネント監査計画

**作成日:** 2026-03-11
**目的:** Reactフック・ライフサイクル管理の不具合を体系的に検証・修正

---

## 🎯 監査目的

今回発生した`SessionPlayer`初期化エラー（`handleStart`がuseEffectより後で定義されていた）のような問題を、プロジェクト全体で検出・修正する。

---

## 📊 検証項目

### 1. フックの定義順序（Rules of Hooks）

#### ✅ 正しい順序
```typescript
export function MyComponent() {
  // 1. State/Ref/Context（データ層）
  const [state, setState] = useState();
  const ref = useRef();
  const context = useContext();

  // 2. カスタムフック
  const { data } = useCustomHook();

  // 3. Memoized values（算出値）
  const memoizedValue = useMemo(() => compute(), [deps]);

  // 4. Callbacks（イベントハンドラー）
  const handleClick = useCallback(() => {}, [deps]);

  // 5. Effects（副作用）
  useEffect(() => {}, [deps]);

  // 6. JSX return
  return <div>...</div>;
}
```

#### ❌ 違反パターン
- useEffectの依存配列に、その後で定義される関数を含める
- 条件分岐の中でフックを呼び出す
- ループの中でフックを呼び出す

### 2. 依存配列の正確性

#### ✅ 正しい依存配列
```typescript
// すべての外部変数を含める
useEffect(() => {
  console.log(value);
}, [value]); // ✅

// 安定した参照は除外可能
const stableRef = useRef();
useEffect(() => {
  stableRef.current = value;
}, [value]); // ✅ stableRef不要
```

#### ❌ 間違った依存配列
```typescript
// 依存する変数が抜けている
useEffect(() => {
  console.log(value);
}, []); // ❌ value が依存配列にない

// useVideoRecorderから取得した安定関数を含める
const { start } = useVideoRecorder();
useEffect(() => {
  start();
}, [start]); // ⚠️ startは安定した参照なら不要
```

### 3. 関数定義の順序

#### ✅ 正しい順序
```typescript
// useCallbackで定義（useEffectより前）
const handleClick = useCallback(() => {}, []);

// 依存配列で参照（useEffectで使用）
useEffect(() => {
  handleClick();
}, [handleClick]); // ✅
```

#### ❌ 間違った順序
```typescript
// useEffectで参照
useEffect(() => {
  handleClick(); // ❌ 後で定義される
}, [handleClick]);

// 通常関数で定義（useEffectより後）
const handleClick = () => {}; // ❌ TDZ違反
```

### 4. クリーンアップ関数

#### ✅ 正しいクリーンアップ
```typescript
useEffect(() => {
  const timer = setInterval(() => {}, 1000);

  return () => {
    clearInterval(timer); // ✅
  };
}, []);
```

#### ❌ クリーンアップ不足
```typescript
useEffect(() => {
  const timer = setInterval(() => {}, 1000);
  // ❌ クリーンアップなし → メモリリーク
}, []);
```

---

## 🔍 検証対象コンポーネント

### 優先度A（複雑なライフサイクル）
1. `components/session-player/index.tsx` - ✅ 修正済み
2. `components/session-player/video-composer.tsx`
3. `hooks/useWebSocket.ts`
4. `hooks/useAudioRecorder.ts`
5. `hooks/useVideoRecorder.ts`
6. `hooks/useAudioVisualizer.ts`

### 優先度B（中程度の複雑性）
7. `app/dashboard/sessions/[id]/page.tsx`
8. `app/dashboard/scenarios/page.tsx`
9. `app/dashboard/avatars/page.tsx`
10. `components/scenario-builder/index.tsx`
11. `components/avatar-selector/index.tsx`

### 優先度C（単純なコンポーネント）
12. その他UIコンポーネント（ボタン、フォーム等）

---

## 🛠️ 検証方法

### Step 1: 静的解析
```bash
# TypeScript型チェック
npx tsc --noEmit --skipLibCheck

# ESLint（React Hooks Plugin）
npx eslint apps/web --ext .ts,.tsx --max-warnings 0
```

### Step 2: コード検査
```bash
# useEffectの依存配列を検査
grep -rn "useEffect(" apps/web/components apps/web/hooks --include="*.tsx" --include="*.ts" -A 5

# useCallbackの定義位置を検査
grep -rn "useCallback(" apps/web/components apps/web/hooks --include="*.tsx" --include="*.ts" -A 3
```

### Step 3: パターン検出
```bash
# 通常関数定義（const fn = () => {}）を検出
grep -rn "const handle[A-Z].*= (" apps/web/components --include="*.tsx" | grep -v "useCallback"

# useEffect内で未定義の関数を呼び出していないか
grep -rn "useEffect.*handle" apps/web/components --include="*.tsx" -B 5 -A 10
```

---

## 📝 検証チェックリスト

### コンポーネント単位
- [ ] すべてのフックがコンポーネントのトップレベルで呼ばれているか
- [ ] 条件分岐・ループ内でフックを呼んでいないか
- [ ] useEffect/useCallbackの定義順序が正しいか
- [ ] 依存配列に必要な変数がすべて含まれているか
- [ ] 不要な依存（安定した参照）が含まれていないか
- [ ] クリーンアップ関数が適切に実装されているか
- [ ] useEffectの実行順序が意図通りか

### プロジェクト全体
- [ ] ESLint React Hooks Pluginで警告が0件
- [ ] TypeScript型エラーが0件
- [ ] すべての優先度Aコンポーネントを検証
- [ ] 検出された問題をすべて修正
- [ ] ベストプラクティスドキュメント作成

---

## 🎓 期待される成果物

1. **監査レポート**: `REACT_COMPONENT_AUDIT_REPORT.md`
   - 検出された問題の一覧
   - 修正内容の詳細
   - 修正前後の比較

2. **ベストプラクティス**: `REACT_HOOKS_BEST_PRACTICES.md`
   - フックの正しい使い方
   - よくある間違いと対策
   - コードレビューチェックリスト

3. **ESLint設定強化**: `.eslintrc.js`
   - `eslint-plugin-react-hooks`の厳格化
   - カスタムルールの追加

---

## 🚀 次のステップ

1. ✅ SessionPlayer修正（完了）
2. ⏳ 優先度Aコンポーネントの検証（次）
3. ⏳ ESLint設定強化
4. ⏳ ベストプラクティス文書化
5. ⏳ チーム共有・レビュー

---

**最終更新:** 2026-03-11
**ステータス:** 🔴 検証中
