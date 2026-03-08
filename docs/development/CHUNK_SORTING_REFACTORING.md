# チャンクソート機能のリファクタリング

**実施日:** 2026-03-08
**目的:** コードの重複排除とメンテナンス性向上
**原則:** DRY (Don't Repeat Yourself)

---

## 📋 問題の背景

### 発見された問題

**ユーザーの重要な指摘:**

> 「もし可能だったら、命名規則に一環として音声もビデオも同じ機能を共有できる？
> 同じ機能を別の場所で実装すると漏れが起こる。
> できたら同じ機能は一箇所で実装して共有したい」

### コードの重複

**リファクタリング前:**

同じソート機能が **2箇所** で重複実装されていました：

1. **音声チャンクソート** (`index.ts` Line 831-860)

   ```typescript
   const sortedChunks = listResponse.Contents.sort((a, b) => {
     const aKey = a.Key || '';
     const bKey = b.Key || '';
     const aMatch = aKey.match(/(\d+)-(\d+)\.\w+$/);
     const bMatch = bKey.match(/(\d+)-(\d+)\.\w+$/);
     // ... 30行の重複コード
   });
   ```

2. **ビデオチャンクソート** (`video-processor.ts` Line 110-137)
   ```typescript
   const sortedChunks = listResponse.Contents.sort((a, b) => {
     const aKey = a.Key || '';
     const bKey = b.Key || '';
     const aMatch = aKey.match(/(\d+)-(\d+)\.webm$/);
     const bMatch = bKey.match(/(\d+)-(\d+)\.webm$/);
     // ... 30行の重複コード
   });
   ```

### 重複のリスク

| リスク               | 具体例                               | 今回の問題          |
| -------------------- | ------------------------------------ | ------------------- |
| **修正漏れ**         | 片方だけ修正して、もう片方を忘れる   | ✅ まさに今回発生   |
| **不整合**           | 実装が微妙に異なり、動作が一貫しない | 🔴 潜在的リスク     |
| **メンテナンス負荷** | 変更時に複数箇所を修正する必要       | 🔴 開発効率低下     |
| **テストの困難さ**   | 同じロジックを複数回テストする必要   | 🔴 テストコスト増加 |

---

## 🛠️ 実装内容

### 1. 共通ユーティリティファイル作成

**新規ファイル:** `infrastructure/lambda/websocket/default/chunk-utils.ts`

**提供する機能:**

1. **`sortChunksByTimestampAndIndex()`** - チャンクソート関数
2. **`validateChunkOrder()`** - チャンク順序検証関数
3. **`logSortedChunks()`** - デバッグログ出力関数

#### 1.1 sortChunksByTimestampAndIndex()

**機能:**

- S3オブジェクトの配列をファイル名のタイムスタンプとチャンク番号でソート
- 正規表現でファイル名から数値を抽出
- 数値比較によるソート（辞書順ではない）

**シグネチャ:**

```typescript
function sortChunksByTimestampAndIndex(chunks: S3Object[]): S3Object[];
```

**期待されるファイル名形式:**

```
{timestamp}-{chunkNumber}.{extension}
例: 1772952987123-5.webm
```

**ソート順序:**

1. タイムスタンプ（昇順）
2. チャンク番号（昇順）

**例:**

```typescript
const chunks = [
  { Key: 'sessions/xxx/audio-chunks/1772952987123-10.webm' },
  { Key: 'sessions/xxx/audio-chunks/1772952987123-2.webm' },
  { Key: 'sessions/xxx/audio-chunks/1772952987123-1.webm' },
];

const sorted = sortChunksByTimestampAndIndex(chunks);

// 結果: [
//   { Key: 'sessions/xxx/audio-chunks/1772952987123-1.webm' },
//   { Key: 'sessions/xxx/audio-chunks/1772952987123-2.webm' },
//   { Key: 'sessions/xxx/audio-chunks/1772952987123-10.webm' },
// ]
```

#### 1.2 validateChunkOrder()

**機能:**

- ソート済みチャンクの順序を検証
- 欠損チャンク（抜け番）を検出
- 重複チャンクを検出

**シグネチャ:**

```typescript
function validateChunkOrder(chunks: S3Object[]): {
  isValid: boolean;
  missingChunks: number[];
  duplicateChunks: number[];
  totalChunks: number;
};
```

**例:**

```typescript
// チャンク番号: 1, 2, 4, 5, 5 (3が欠損、5が重複)
const result = validateChunkOrder(chunks);

// 結果: {
//   isValid: false,
//   missingChunks: [3],
//   duplicateChunks: [5],
//   totalChunks: 5
// }
```

#### 1.3 logSortedChunks()

**機能:**

- ソート済みチャンクの先頭N個をログ出力
- 検証結果もログ出力
- デバッグとモニタリングに有用

**シグネチャ:**

```typescript
function logSortedChunks(chunks: S3Object[], context: string, count: number = 5): void;
```

**出力例:**

```
[session_end:audio] Sorted chunks (first 5): [
  '1772952987123-1.webm',
  '1772952987123-2.webm',
  '1772952987123-3.webm',
  '1772952987123-4.webm',
  '1772952987123-5.webm'
]
[session_end:audio] Chunk order validation passed: 106 chunks
```

---

### 2. 既存コードの修正

#### 2.1 index.ts (音声チャンク)

**Before:**

```typescript
// 30行のソートロジック（重複）
const sortedChunks = listResponse.Contents.sort((a, b) => {
  const aKey = a.Key || '';
  const bKey = b.Key || '';
  const aMatch = aKey.match(/(\d+)-(\d+)\.\w+$/);
  const bMatch = bKey.match(/(\d+)-(\d+)\.\w+$/);
  // ... 続く
});
console.log(
  `[session_end] Sorted chunks (first 5):`,
  sortedChunks.slice(0, 5).map(c => c.Key)
);
```

**After:**

```typescript
// 共通関数を使用（3行）
const sortedChunks = sortChunksByTimestampAndIndex(listResponse.Contents);
logSortedChunks(sortedChunks, 'session_end:audio', 5);
```

**削減:** 30行 → 3行 (90%削減)

#### 2.2 video-processor.ts (ビデオチャンク)

**Before:**

```typescript
// 30行のソートロジック（重複）
const sortedChunks = listResponse.Contents.filter(obj => obj.Key && obj.Key.endsWith('.webm')).sort(
  (a, b) => {
    const aKey = a.Key || '';
    const bKey = b.Key || '';
    const aMatch = aKey.match(/(\d+)-(\d+)\.webm$/);
    const bMatch = bKey.match(/(\d+)-(\d+)\.webm$/);
    // ... 続く
  }
);
console.log(
  '[VideoProcessor] Sorted chunks (first 5):',
  sortedChunks.slice(0, 5).map(c => c.Key)
);
```

**After:**

```typescript
// 共通関数を使用（4行）
const filteredChunks = listResponse.Contents.filter(obj => obj.Key && obj.Key.endsWith('.webm'));
const sortedChunks = sortChunksByTimestampAndIndex(filteredChunks);
logSortedChunks(sortedChunks, 'VideoProcessor:combineChunks', 5);
```

**削減:** 30行 → 4行 (87%削減)

---

## 📊 改善効果

### コード量削減

| 指標               | Before                               | After                                  | 改善率 |
| ------------------ | ------------------------------------ | -------------------------------------- | ------ |
| **重複コード**     | 60行 (2箇所×30行)                    | 0行                                    | -100%  |
| **総コード量**     | 60行 (index.ts + video-processor.ts) | 127行 (utils) + 7行 (呼び出し) = 134行 | -      |
| **呼び出しコード** | 30行×2 = 60行                        | 3-4行×2 = 7行                          | -88%   |

**注:** 総コード量は増えていますが、これは以下の機能追加によるものです：

- チャンク順序検証（validateChunkOrder）
- デバッグログ強化（logSortedChunks）
- JSDoc コメント

### 保守性向上

| 指標               | Before                 | After            | 改善          |
| ------------------ | ---------------------- | ---------------- | ------------- |
| **修正箇所**       | 2箇所                  | 1箇所            | ✅ 50%削減    |
| **修正漏れリスク** | 高（片方だけ修正）     | なし             | ✅ リスク排除 |
| **テストコスト**   | 2箇所テスト必要        | 1箇所のみ        | ✅ 50%削減    |
| **可読性**         | 30行のロジック埋め込み | 関数名で意図明確 | ✅ 大幅改善   |

### 今後の拡張性

**新しいメディアタイプ追加時:**

**Before（重複実装）:**

```typescript
// 新しいaudio2チャンク処理を追加
// → 60行のソートロジックを再度コピペ
// → 3箇所目の重複コードが発生
```

**After（共通関数使用）:**

```typescript
// 新しいaudio2チャンク処理を追加
const sortedChunks = sortChunksByTimestampAndIndex(chunks); // 既存関数を使用
logSortedChunks(sortedChunks, 'audio2', 5);
// → 2行で完了、重複なし
```

---

## 🧪 検証方法

### 単体テスト（推奨）

```typescript
// chunk-utils.test.ts
describe('sortChunksByTimestampAndIndex', () => {
  it('should sort chunks by timestamp and index', () => {
    const chunks = [
      { Key: 'sessions/xxx/audio-chunks/1000-10.webm' },
      { Key: 'sessions/xxx/audio-chunks/1000-2.webm' },
      { Key: 'sessions/xxx/audio-chunks/1000-1.webm' },
    ];

    const sorted = sortChunksByTimestampAndIndex(chunks);

    expect(sorted[0].Key).toBe('sessions/xxx/audio-chunks/1000-1.webm');
    expect(sorted[1].Key).toBe('sessions/xxx/audio-chunks/1000-2.webm');
    expect(sorted[2].Key).toBe('sessions/xxx/audio-chunks/1000-10.webm');
  });

  it('should validate chunk order', () => {
    const chunks = [
      { Key: 'sessions/xxx/audio-chunks/1000-1.webm' },
      { Key: 'sessions/xxx/audio-chunks/1000-2.webm' },
      // Missing chunk 3
      { Key: 'sessions/xxx/audio-chunks/1000-4.webm' },
    ];

    const result = validateChunkOrder(chunks);

    expect(result.isValid).toBe(false);
    expect(result.missingChunks).toEqual([3]);
  });
});
```

### 統合テスト

```bash
# 1. セッション実行（音声+ビデオ録画）
# 2. CloudWatch Logs確認
aws logs tail /aws/lambda/prance-websocket-default-dev --follow | \
  grep -E "Sorted chunks|validation"

# 期待されるログ:
# [session_end:audio] Sorted chunks (first 5): ['...-1.webm', '...-2.webm', ...]
# [session_end:audio] Chunk order validation passed: 106 chunks
# [VideoProcessor:combineChunks] Sorted chunks (first 5): ['...-1.webm', '...-2.webm', ...]
# [VideoProcessor:combineChunks] Chunk order validation passed: 27 chunks
```

---

## 💡 設計原則

### 1. DRY (Don't Repeat Yourself)

**原則:**

> 同じ知識を複数の場所で表現しない

**適用:**

- ソートロジックを1箇所に集約
- 音声・ビデオで共通関数を使用

### 2. Single Responsibility Principle (SRP)

**原則:**

> 1つのモジュールは1つの責任のみを持つ

**適用:**

- `chunk-utils.ts` - チャンク処理の責任のみ
- `index.ts` - WebSocketメッセージハンドリング
- `video-processor.ts` - ビデオ処理パイプライン

### 3. Open/Closed Principle (OCP)

**原則:**

> 拡張に開いていて、修正に閉じている

**適用:**

- 新しいメディアタイプ追加時、既存コードを変更不要
- `sortChunksByTimestampAndIndex()` を呼び出すだけ

### 4. Testability（テスト容易性）

**原則:**

> コードはテスト可能であるべき

**適用:**

- 純粋関数として実装（副作用なし）
- 入力→出力が明確
- モックやスタブが不要

---

## 📚 今後の改善案

### 改善案1: TypeScript型定義の共有

**現状:**

- `S3Object` を直接使用

**改善案:**

```typescript
export interface ChunkFile {
  key: string;
  timestamp: number;
  chunkNumber: number;
  size?: number;
}

export function parseChunkFile(s3Object: S3Object): ChunkFile | null {
  const match = s3Object.Key?.match(/(\d+)-(\d+)\.\w+$/);
  if (!match) return null;

  return {
    key: s3Object.Key!,
    timestamp: parseInt(match[1], 10),
    chunkNumber: parseInt(match[2], 10),
    size: s3Object.Size,
  };
}
```

### 改善案2: ファイル名にゼロパディング

**現状:**

```
1772952987123-1.webm
1772952987123-10.webm
```

**改善案:**

```
1772952987123-0001.webm  // 4桁ゼロパディング
1772952987123-0010.webm
```

**メリット:**

- 辞書順ソートでも正しい順序になる
- ファイルエクスプローラーで見やすい

**実装:**

```typescript
// index.ts, video-processor.ts
const chunkKey = `sessions/${sessionId}/audio-chunks/${timestamp}-${chunkCount.toString().padStart(4, '0')}.webm`;
```

### 改善案3: チャンク順序エラー時の自動修復

**現状:**

- 欠損チャンクがあってもそのまま処理

**改善案:**

```typescript
if (!validation.isValid) {
  console.error('Chunk order validation failed:', validation);

  if (validation.missingChunks.length > 0) {
    // オプション1: エラーを返す
    throw new Error(`Missing chunks: ${validation.missingChunks.join(', ')}`);

    // オプション2: 警告して続行
    console.warn('Processing with missing chunks');
  }
}
```

---

## 📝 まとめ

### 実施内容

1. ✅ 共通ユーティリティファイル作成 (`chunk-utils.ts`)
2. ✅ 音声チャンクソートを共通関数に置き換え
3. ✅ ビデオチャンクソートを共通関数に置き換え
4. ✅ チャンク順序検証機能を追加
5. ✅ デバッグログを強化

### 効果

- ✅ コードの重複を完全に排除
- ✅ 修正漏れのリスクを排除
- ✅ メンテナンス性を大幅に向上
- ✅ テスト容易性を向上
- ✅ 将来の拡張性を確保

### 重要な教訓

**ユーザーの指摘:**

> 「同じ機能を別の場所で実装すると漏れが起こる。
> できたら同じ機能は一箇所で実装して共有したい」

この指摘は完全に正しく、ソフトウェア工学の基本原則（DRY）に基づいています。

**今後の開発方針:**

- コードレビュー時に重複コードを積極的に検出
- 共通ロジックは早期にユーティリティ関数化
- 「コピペ」ではなく「共有」を優先

---

**最終更新:** 2026-03-08 08:30 JST
**次回レビュー:** 単体テスト実装後
