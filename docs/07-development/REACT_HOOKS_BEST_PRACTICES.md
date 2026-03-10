# React Hooks ベストプラクティス

**対象:** Prance Communication Platform 開発チーム
**作成日:** 2026-03-11
**カテゴリ:** 開発ガイドライン

---

## 📋 目次

1. [フックの定義順序](#フックの定義順序)
2. [useCallback/useMemoの使い方](#usecallbackusememoの使い方)
3. [依存配列の管理](#依存配列の管理)
4. [よくある間違いと対策](#よくある間違いと対策)
5. [コードレビューチェックリスト](#コードレビューチェックリスト)

---

## フックの定義順序

### ✅ 正しい順序

```typescript
export function MyComponent() {
  // 1️⃣ State / Ref / Context（データ層）
  const [count, setCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const user = useContext(UserContext);

  // 2️⃣ カスタムフック
  const { data, isLoading } = useQuery();
  const { isConnected } = useWebSocket();

  // 3️⃣ Memoized values（算出値）
  const expensiveValue = useMemo(() => {
    return computeExpensiveValue(count);
  }, [count]);

  // 4️⃣ Callbacks（イベントハンドラー）
  const handleClick = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    setCount(0);
  }, []);

  // 5️⃣ Effects（副作用）
  useEffect(() => {
    console.log('Count changed:', count);
  }, [count]);

  // 6️⃣ JSX return
  return (
    <div>
      <button onClick={handleClick}>Count: {count}</button>
      <button onClick={handleReset}>Reset</button>
    </div>
  );
}
```

### 🔴 絶対に守るべきルール

#### Rule 1: useEffectより前にuseCallbackを定義

```typescript
// ✅ 正しい
const handleStart = useCallback(() => {
  console.log('Started');
}, []);

useEffect(() => {
  handleStart();  // ✅ OK
}, [handleStart]);
```

```typescript
// ❌ 間違い（TDZ違反）
useEffect(() => {
  handleStart();  // ❌ エラー: 未定義
}, [handleStart]);

const handleStart = useCallback(() => {
  console.log('Started');
}, []);
```

#### Rule 2: 条件分岐・ループ内でフックを呼ばない

```typescript
// ❌ 間違い
if (condition) {
  useEffect(() => {}, []);  // ❌ Rules of Hooks違反
}

// ✅ 正しい
useEffect(() => {
  if (condition) {
    // 条件をuseEffectの中に入れる
  }
}, [condition]);
```

#### Rule 3: コンポーネントのトップレベルでのみフックを呼ぶ

```typescript
// ❌ 間違い
function processData() {
  const [data, setData] = useState();  // ❌ 関数内でフック呼び出し
  return data;
}

// ✅ 正しい
function MyComponent() {
  const [data, setData] = useState();  // ✅ コンポーネントのトップレベル

  function processData() {
    // dataを使用
    return data;
  }

  return <div>{processData()}</div>;
}
```

---

## useCallback/useMemoの使い方

### useCallbackを使うべき場合

#### ✅ Case 1: useEffectの依存配列に含まれる関数

```typescript
const handleData = useCallback((data: Data) => {
  console.log(data);
}, []);

useEffect(() => {
  handleData(someData);  // ✅ handleDataが依存配列に含まれる
}, [someData, handleData]);
```

#### ✅ Case 2: 子コンポーネントに渡す関数（最適化）

```typescript
const Parent = () => {
  const handleClick = useCallback(() => {
    console.log('Clicked');
  }, []);

  // ChildはReact.memoでラップされている
  return <Child onClick={handleClick} />;
};
```

#### ⚠️ Case 3: 単純なイベントハンドラー（オプショナル）

```typescript
// 🟡 useCallbackは任意（パフォーマンス影響は軽微）
const handleClick = useCallback(() => {
  setCount(prev => prev + 1);
}, []);

return <button onClick={handleClick}>Click</button>;
```

```typescript
// 🟡 useCallbackなしでも動作（推奨はuseCallback使用）
const handleClick = () => {
  setCount(prev => prev + 1);
};

return <button onClick={handleClick}>Click</button>;
```

**プロジェクト方針:** 一貫性のため、すべてのイベントハンドラーでuseCallbackを使用することを推奨。

### useMemoを使うべき場合

#### ✅ Case 1: 高コストな計算

```typescript
const expensiveResult = useMemo(() => {
  return items.reduce((acc, item) => {
    // 複雑な計算
    return acc + complexCalculation(item);
  }, 0);
}, [items]);
```

#### ✅ Case 2: 参照の安定性が必要なオブジェクト

```typescript
const config = useMemo(() => ({
  width: 1280,
  height: 720,
}), []);

// configがuseEffectの依存配列に含まれる場合
useEffect(() => {
  setupCanvas(config);
}, [config]);  // ✅ configは再生成されない
```

#### ❌ Case 3: 単純な計算（不要）

```typescript
// ❌ 不要（オーバーヘッドの方が大きい）
const doubled = useMemo(() => count * 2, [count]);

// ✅ 通常の計算で十分
const doubled = count * 2;
```

---

## 依存配列の管理

### ✅ 正しい依存配列

#### Pattern 1: すべての外部変数を含める

```typescript
useEffect(() => {
  console.log(count, name);
}, [count, name]);  // ✅ count, nameを両方含める
```

#### Pattern 2: 安定した参照は除外

```typescript
const ref = useRef<HTMLDivElement>(null);
const { start } = useVideoRecorder();  // startは安定した関数

useEffect(() => {
  if (ref.current) {
    start();
  }
}, []);  // ✅ ref, startは依存配列に不要
```

#### Pattern 3: コールバックをrefに保存

```typescript
// コールバックをrefに保存して依存配列を最小化
const onDataRef = useRef(onData);

useEffect(() => {
  onDataRef.current = onData;  // 毎レンダーで更新
});

const processData = useCallback((data) => {
  onDataRef.current?.(data);  // 常に最新のコールバックを使用
}, []);  // ✅ 依存配列が空
```

### ❌ 間違った依存配列

#### Anti-pattern 1: 依存変数を省略

```typescript
// ❌ countに依存しているのに依存配列に含まれていない
useEffect(() => {
  console.log(count);
}, []);  // ❌ countが抜けている
```

**ESLint警告:**
```
React Hook useEffect has a missing dependency: 'count'.
Either include it or remove the dependency array.
```

#### Anti-pattern 2: 不要な依存を含める

```typescript
// ❌ setCountは安定した関数なので不要
useEffect(() => {
  setCount(10);
}, [setCount]);  // ❌ setCountは依存配列に不要
```

#### Anti-pattern 3: オブジェクトリテラルを依存配列に含める

```typescript
// ❌ 毎レンダーで新しいオブジェクトが生成される
useEffect(() => {
  setupCanvas({ width: 1280, height: 720 });
}, [{ width: 1280, height: 720 }]);  // ❌ 無限ループ

// ✅ useMemoで安定した参照を作成
const config = useMemo(() => ({ width: 1280, height: 720 }), []);
useEffect(() => {
  setupCanvas(config);
}, [config]);  // ✅ OK
```

---

## よくある間違いと対策

### 問題1: 初期化エラー（TDZ違反）

#### 症状
```
Cannot access 'handleStart' before initialization
```

#### 原因
```typescript
// useEffectが先
useEffect(() => {
  handleStart();  // ← エラー
}, [handleStart]);

// 関数定義が後
const handleStart = () => {};
```

#### 対策
```typescript
// 1. useCallbackでラップ
const handleStart = useCallback(() => {
  // ...
}, []);

// 2. useEffectはその後
useEffect(() => {
  handleStart();  // ✅ OK
}, [handleStart]);
```

### 問題2: 無限ループ

#### 症状
コンポーネントが無限に再レンダーされる

#### 原因
```typescript
// ❌ 依存配列にオブジェクトリテラルを含める
useEffect(() => {
  fetchData({ id: 1 });
}, [{ id: 1 }]);  // 毎レンダーで新しいオブジェクト → 無限ループ
```

#### 対策
```typescript
// ✅ プリミティブ値を依存配列に含める
useEffect(() => {
  fetchData({ id: 1 });
}, [1]);  // プリミティブ値は安全

// ✅ useMemoで安定した参照を作成
const params = useMemo(() => ({ id: 1 }), []);
useEffect(() => {
  fetchData(params);
}, [params]);
```

### 問題3: stale closure（古い値を参照）

#### 症状
useEffectの中で古い値を参照してしまう

#### 原因
```typescript
const [count, setCount] = useState(0);

useEffect(() => {
  const interval = setInterval(() => {
    console.log(count);  // ← 常に0を表示
  }, 1000);

  return () => clearInterval(interval);
}, []);  // ← countが依存配列に含まれていない
```

#### 対策

**Option A: 依存配列に含める（推奨）**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    console.log(count);  // ✅ 最新のcountを表示
  }, 1000);

  return () => clearInterval(interval);
}, [count]);  // ✅ countを含める
```

**Option B: refを使う**
```typescript
const countRef = useRef(count);

useEffect(() => {
  countRef.current = count;  // 毎レンダーで更新
});

useEffect(() => {
  const interval = setInterval(() => {
    console.log(countRef.current);  // ✅ 最新のcountを表示
  }, 1000);

  return () => clearInterval(interval);
}, []);  // 依存配列が空でもOK
```

**Option C: 関数型更新**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    setCount(prev => prev + 1);  // ✅ 最新の値を取得
  }, 1000);

  return () => clearInterval(interval);
}, []);  // setCountは安定した関数なので不要
```

### 問題4: クリーンアップ関数の不足

#### 症状
メモリリーク、二重実行、競合状態

#### 原因
```typescript
// ❌ クリーンアップなし
useEffect(() => {
  const timer = setInterval(() => {
    console.log('tick');
  }, 1000);
  // クリーンアップ関数がない → メモリリーク
}, []);
```

#### 対策
```typescript
// ✅ クリーンアップ関数を追加
useEffect(() => {
  const timer = setInterval(() => {
    console.log('tick');
  }, 1000);

  return () => {
    clearInterval(timer);  // ✅ クリーンアップ
  };
}, []);
```

**クリーンアップが必要なケース:**
- タイマー（setInterval, setTimeout）
- イベントリスナー（addEventListener）
- WebSocket接続
- Subscription（observable.subscribe）
- 非同期処理のキャンセル（AbortController）
- アニメーションフレーム（requestAnimationFrame）

---

## コードレビューチェックリスト

### フック定義順序
- [ ] useState/useRefがコンポーネントの最初に定義されているか
- [ ] useCallbackがuseEffectより前に定義されているか
- [ ] useEffectがコンポーネントの最後（JSX returnの直前）に定義されているか
- [ ] 条件分岐・ループ内でフックを呼んでいないか

### useCallback/useMemo
- [ ] イベントハンドラーがuseCallbackでラップされているか
- [ ] 高コストな計算にuseMemoを使用しているか
- [ ] 不要なuseCallback/useMemoを使用していないか

### 依存配列
- [ ] すべての外部変数が依存配列に含まれているか
- [ ] 安定した参照（ref, setState）を依存配列から除外しているか
- [ ] オブジェクトリテラルを依存配列に直接含めていないか
- [ ] ESLint警告（exhaustive-deps）を無視していないか

### クリーンアップ
- [ ] タイマーを正しくクリアしているか
- [ ] イベントリスナーを正しく削除しているか
- [ ] WebSocket/Subscriptionを正しく切断しているか

### TypeScript
- [ ] フックの返り値に型注釈があるか
- [ ] useRefに適切な型引数があるか
- [ ] useCallbackの引数に型注釈があるか

---

## 実践例

### Example 1: タイマーコンポーネント

```typescript
export function Timer() {
  // 1. State
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // 2. Ref（タイマーID保存）
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 3. Callbacks（useEffectより前）
  const handleStart = useCallback(() => {
    setIsRunning(true);
  }, []);

  const handleStop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    setSeconds(0);
    setIsRunning(false);
  }, []);

  // 4. Effects
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    // クリーンアップ
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  // 5. JSX
  return (
    <div>
      <div>{seconds}秒</div>
      <button onClick={handleStart}>開始</button>
      <button onClick={handleStop}>停止</button>
      <button onClick={handleReset}>リセット</button>
    </div>
  );
}
```

### Example 2: WebSocket接続

```typescript
export function useWebSocketConnection(url: string, onMessage: (data: any) => void) {
  // 1. State
  const [isConnected, setIsConnected] = useState(false);

  // 2. Ref（コールバックを安定させる）
  const onMessageRef = useRef(onMessage);
  const wsRef = useRef<WebSocket | null>(null);

  // 3. コールバックrefを毎レンダーで更新
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  // 4. Callbacks
  const connect = useCallback(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      onMessageRef.current(event.data);  // 最新のコールバックを使用
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, [url]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  // 5. Effects
  useEffect(() => {
    connect();

    return () => {
      disconnect();  // クリーンアップ
    };
  }, [connect, disconnect]);

  return { isConnected, disconnect };
}
```

---

## 参考資料

### 公式ドキュメント
- [React Hooks Rules](https://react.dev/reference/react#hook-rules)
- [useEffect](https://react.dev/reference/react/useEffect)
- [useCallback](https://react.dev/reference/react/useCallback)
- [useMemo](https://react.dev/reference/react/useMemo)

### ESLint Plugin
- [eslint-plugin-react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks)

### プロジェクト内ドキュメント
- [REACT_COMPONENT_AUDIT_REPORT.md](./REACT_COMPONENT_AUDIT_REPORT.md)
- [REACT_COMPONENT_AUDIT_PLAN.md](./REACT_COMPONENT_AUDIT_PLAN.md)

---

**最終更新:** 2026-03-11
**次回レビュー:** Phase 2完了時
