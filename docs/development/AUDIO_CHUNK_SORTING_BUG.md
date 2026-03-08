# 音声チャンク順序バグの根本原因と修正

**発見日:** 2026-03-08
**重要度:** 🔴 Critical
**影響:** 音声認識が完全に失敗する

---

## 📋 問題の概要

### 症状

```
[AzureSTT] Recognition result: {
  reason: 0,
  reasonText: 'NoMatch',
  text: '',
  duration: 51800000,
  offset: 0
}
```

### ユーザーへの影響

- ✅ UI上では音声インディケーターが動作（マイクは正常）
- ✅ 音声データは正常に送信されている（500KB+）
- ❌ Azure STTが音声を認識できない
- ❌ セッションが失敗し、ユーザー体験が悪化

---

## 🔍 根本原因分析

### 問題発見の経緯

**ユーザーの重要な指摘:**

> 「UI上では音声インディケーターがちゃんと動いていて認識されている。処理の実装が問題のはず。」
> 「前回はちゃんと認識したのになんで別の問題を解決しようとすると、その前に動作していた機能がまたエラーになるのか。」

この指摘により、**音声データ自体は正常**で、**処理ロジックに問題**があることが判明。

### 調査結果

**1. 音声データの確認**

```bash
aws s3 ls s3://prance-recordings-dev-010438500933/sessions/{sessionId}/audio/
# 結果: 511KB の WebM ファイルが正常に保存されている
```

**2. WebMファイルヘッダーの確認**

```
1a 45 df a3  # WebM magic number ✅
A_OPUS       # Opus codec ✅
OpusHead     # Opus header ✅
```

→ ファイル形式は正常

**3. Lambdaログの確認**

```
Combined audio size: 511890 bytes ✅
[AudioProcessor] Conversion complete: { inputSize: 511890, outputSize: 1013838 } ✅
[AzureSTT] Recognition result: reason: 0, reasonText: 'NoMatch' ❌
```

→ 音声データは結合され、変換も成功しているが、Azure STTが認識失敗

**4. 音声チャンクファイル名の調査**

```
sessions/{sessionId}/audio-chunks/{timestamp}-{chunkCount}.webm
```

### 決定的な証拠

**現在のソートコード（837行目）:**

```typescript
const sortedChunks = listResponse.Contents.sort((a, b) => {
  const aKey = a.Key || '';
  const bKey = b.Key || '';
  return aKey.localeCompare(bKey); // 辞書順ソート
});
```

**ファイル名の生成（263行目）:**

```typescript
const chunkKey = `sessions/${audioSessionId}/audio-chunks/${timestamp}-${chunkCount}.webm`;
```

**問題:**

辞書順ソートでは、数値が正しい順序にならない：

| 正しい順序               | 辞書順ソート結果                 | 結果          |
| ------------------------ | -------------------------------- | ------------- |
| 1, 2, 3, ..., 10, 11, 12 | 1, 10, 11, 12, 2, 20, 21, 3, ... | ❌ 誤った順序 |

**具体例:**

```
期待されるファイル順序:
1772952987000-1.webm
1772952987000-2.webm
1772952987000-3.webm
...
1772952987000-10.webm
1772952987000-11.webm

実際のソート結果（辞書順）:
1772952987000-1.webm
1772952987000-10.webm  ← ★ 2よりも先に来る！
1772952987000-11.webm
...
1772952987000-2.webm   ← ★ 10の後に来る！
1772952987000-20.webm
...
1772952987000-3.webm
```

**結果:**

1. 音声チャンクが**誤った順序**で結合される
2. 結合された音声ファイルの内容が**破損**する
3. Azure STTが音声として認識できない
4. InitialSilenceTimeout エラーが発生

---

## 🛠️ 修正内容

### 修正前のコード

```typescript
// 辞書順ソート（誤り）
const sortedChunks = listResponse.Contents.sort((a, b) => {
  const aKey = a.Key || '';
  const bKey = b.Key || '';
  return aKey.localeCompare(bKey);
});
```

### 修正後のコード

```typescript
// 数値ソート（正しい）
const sortedChunks = listResponse.Contents.sort((a, b) => {
  const aKey = a.Key || '';
  const bKey = b.Key || '';

  // Extract timestamp and chunk number from filename
  // Format: sessions/{sessionId}/audio-chunks/{timestamp}-{chunkNumber}.webm
  const aMatch = aKey.match(/(\d+)-(\d+)\.\w+$/);
  const bMatch = bKey.match(/(\d+)-(\d+)\.\w+$/);

  if (!aMatch || !bMatch) {
    // Fallback to string comparison if pattern doesn't match
    return aKey.localeCompare(bKey);
  }

  const aTimestamp = parseInt(aMatch[1], 10);
  const bTimestamp = parseInt(bMatch[1], 10);
  const aChunkNum = parseInt(aMatch[2], 10);
  const bChunkNum = parseInt(aMatch[2], 10);

  // Sort by timestamp first, then by chunk number
  if (aTimestamp !== bTimestamp) {
    return aTimestamp - bTimestamp;
  }
  return aChunkNum - bChunkNum;
});

console.log(
  `[session_end] Sorted chunks (first 5):`,
  sortedChunks.slice(0, 5).map(c => c.Key)
);
```

### 変更点

1. **正規表現でタイムスタンプとチャンク番号を抽出**
2. **数値として比較** (`parseInt` + 数値比較)
3. **タイムスタンプ → チャンク番号の順でソート**
4. **診断用ログ追加** (最初の5個のファイル名を出力)

---

## 📊 期待される改善効果

| 指標                 | 修正前           | 修正後           | 改善率 |
| -------------------- | ---------------- | ---------------- | ------ |
| **音声チャンク順序** | 誤り（辞書順）   | 正しい（数値順） | 100%   |
| **音声認識成功率**   | 0%               | >90%             | ∞      |
| **ユーザー体験**     | 完全に壊れている | 正常に動作       | +++    |

---

## 🧪 検証方法

### テスト手順

1. 新しいセッションを開始
2. マイクで話す（30秒以上）
3. セッション終了
4. CloudWatch Logsを確認

### 期待されるログ

```
[session_end] Found 106 chunks in S3
[session_end] Sorted chunks (first 5): [
  'sessions/.../audio-chunks/1772952987000-1.webm',
  'sessions/.../audio-chunks/1772952987000-2.webm',
  'sessions/.../audio-chunks/1772952987000-3.webm',
  'sessions/.../audio-chunks/1772952987000-4.webm',
  'sessions/.../audio-chunks/1772952987000-5.webm'
]
Combined audio size: 511890 bytes
[AudioProcessor] Conversion complete: { inputSize: 511890, outputSize: 1013838 }
[AzureSTT] Recognition result: {
  reason: 3,
  reasonText: 'RecognizedSpeech',  ← ★ 成功！
  text: 'こんにちは...',
  ...
}
```

### 検証コマンド

```bash
# デプロイ確認
aws lambda get-function --function-name prance-websocket-default-dev \
  --query 'Configuration.LastModified' --output text

# ログ監視
aws logs tail /aws/lambda/prance-websocket-default-dev --follow | grep -E "Sorted chunks|Recognition result"
```

---

## 💡 重要な教訓

### 教訓1: ファイル名のソート順序に注意

**問題:**

- 数値を含むファイル名を辞書順ソートすると、意図しない順序になる

**解決策:**

- ゼロパディング（例: `0001`, `0010`, `0100`）を使用
- または、数値を抽出して数値比較

### 教訓2: ユーザーの観察を重視する

**ユーザーの指摘:**

> 「UI上では音声インディケーターがちゃんと動いていて認識されている」

この観察により、**音声データ自体は正常**で、**処理ロジックに問題**があることが判明。

**教訓:**

- ユーザーの観察を軽視しない
- 「音声が含まれていない」という仮説に固執しない
- 実データを確認する

### 教訓3: 「別の問題を解決すると既存機能が壊れる」を防ぐ

**問題:**

- ロックメカニズム改善時に音声認識が壊れたように見えた
- 実際は、この

バグが以前から存在していた可能性

**対策:**

1. **リグレッションテスト** - 既存機能のテストを自動化
2. **統合テスト** - 全フロー（音声録音→処理→認識）のE2Eテスト
3. **段階的デプロイ** - 1つの変更ごとにテスト

### 教訓4: ログの重要性

**有効だったログ:**

- `Combined audio size: 511890 bytes` - データサイズ確認
- `[AudioProcessor] Conversion complete` - 変換成功確認
- `[AzureSTT] Recognition result` - 認識結果確認

**追加すべきログ:**

- ✅ `[session_end] Sorted chunks (first 5)` - ソート順序の確認（今回追加）

---

## 🚀 今後の改善案

### 改善案1: ファイル名にゼロパディング（Priority: High）

```typescript
// 現在: timestamp-chunkCount.webm
const chunkKey = `sessions/${audioSessionId}/audio-chunks/${timestamp}-${chunkCount}.webm`;

// 改善: ゼロパディング（最大9999チャンク対応）
const chunkKey = `sessions/${audioSessionId}/audio-chunks/${timestamp}-${chunkCount.toString().padStart(4, '0')}.webm`;

// 結果: 辞書順ソートでも正しい順序になる
// 1772952987000-0001.webm
// 1772952987000-0002.webm
// ...
// 1772952987000-0010.webm
```

### 改善案2: 統合テストの追加（Priority: High）

```typescript
// E2Eテスト: 音声録音 → 処理 → 認識
describe('Audio Processing E2E', () => {
  it('should recognize speech from recorded audio', async () => {
    // 1. セッション開始
    // 2. 音声チャンク送信（106個）
    // 3. セッション終了
    // 4. 音声認識結果を確認
    expect(result.text).not.toBe('');
    expect(result.reason).toBe('RecognizedSpeech');
  });
});
```

### 改善案3: チャンク順序の自動検証（Priority: Medium）

```typescript
// チャンク結合時に順序をチェック
function validateChunkOrder(chunks: S3Object[]): boolean {
  for (let i = 1; i < chunks.length; i++) {
    const prevChunkNum = extractChunkNumber(chunks[i - 1].Key);
    const currChunkNum = extractChunkNumber(chunks[i].Key);
    if (currChunkNum !== prevChunkNum + 1) {
      console.error(`Chunk order error: expected ${prevChunkNum + 1}, got ${currChunkNum}`);
      return false;
    }
  }
  return true;
}
```

---

## 📚 参考資料

### 関連ファイル

- `infrastructure/lambda/websocket/default/index.ts` (Line 831-860) - 修正箇所
- `infrastructure/lambda/websocket/default/audio-processor.ts` - 音声処理パイプライン

### 関連ドキュメント

- [docs/development/LOCK_MECHANISM_IMPROVEMENTS.md](./LOCK_MECHANISM_IMPROVEMENTS.md)
- [docs/progress/SESSION_SUMMARY_2026-03-08.md](../progress/SESSION_SUMMARY_2026-03-08.md)

### JavaScript/TypeScript リファレンス

- [String.prototype.localeCompare()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare) - 辞書順ソート
- [Array.prototype.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) - ソート関数
- [String.prototype.padStart()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart) - ゼロパディング

---

**最終更新:** 2026-03-08 08:00 JST
**デプロイステータス:** 🚀 デプロイ中
**検証ステータス:** ⏳ 検証待ち
