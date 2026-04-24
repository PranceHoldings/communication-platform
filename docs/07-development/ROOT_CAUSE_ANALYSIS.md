# 根本原因分析ガイドライン

**作成日:** 2026-03-10
**ステータス:** 🔴 最重要・必須遵守

---

## 概要

このドキュメントは、問題解決時に根本原因を特定し、対症療法ではなく根本的な解決策を実装するためのガイドラインです。

## 基本原則

### 🔴 絶対厳守: 症状ではなく原因を修正する

**問題解決の目的:**
- ❌ エラーを「とりあえず止める」こと
- ✅ 同じ問題が**二度と発生しない**ようにすること

**対症療法 vs 根本解決:**

| 対症療法（❌ 禁止）                          | 根本解決（✅ 必須）                                      |
| -------------------------------------------- | -------------------------------------------------------- |
| エラーメッセージの表面だけ見る               | ログ全体・スタックトレースを追跡                         |
| 「動けばいい」で満足                         | 「なぜこのエラーが発生したのか」を徹底追求               |
| リトライロジックで回避                       | エラーが発生しない設計に変更                             |
| 一時的な回避策（workaround）                 | 恒久的な解決策（permanent fix）                          |
| 同じエラーが繰り返し発生                     | 一度修正したら二度と発生しない                           |

---

## 根本原因分析の手順（5ステップ）

### Step 1: エラーの再現性を確認

**目的:** エラーのパターンを理解する

**実施事項:**
```bash
# 再現条件を特定
- 一度だけ発生？
- 常に発生？
- 特定の条件で発生？
- ランダムに発生？

# 環境依存性を確認
- ローカル環境でのみ？
- CI/CDでのみ？
- 本番環境でのみ？
- 特定のOSバージョンで？
```

**チェックリスト:**
- [ ] エラーを意図的に再現できる？
- [ ] 再現手順を文書化した？
- [ ] 環境依存性を特定した？

### Step 2: エラーの全体像を把握

**目的:** 表面的なエラーメッセージだけでなく、全体像を理解する

**実施事項:**
```bash
# ログファイル全体を確認
- 最後のエラーだけでなく、全ログを読む
- 複数回実行されている兆候がないか確認
- タイムスタンプの間隔を確認

# 関連ファイルを確認
cat /tmp/npm-cache/_logs/*.log | grep -A 5 -B 5 "ENOTEMPTY"

# システムプロセスを確認
ps aux | grep -i npm
lsof | grep node_modules

# スタックトレースを追跡
# どのファイルのどの行から呼び出されているか確認
```

**チェックリスト:**
- [ ] ログファイル全体を確認した？
- [ ] 複数のログファイルが生成されていないか確認した？
- [ ] スタックトレースを追跡した？
- [ ] 関連するシステムプロセスを確認した？

### Step 3: 根本原因の特定（5 Whys分析）

**目的:** 表面的な原因から真の根本原因を特定する

**実施事項:**

**例: clean-deploy.shのENOTEMPTYエラー（2026-03-10）**

```
問題: node_modules削除時にENOTEMPTYエラーが発生

Why 1: なぜnode_modulesが削除できないのか？
→ ディレクトリが空でない

Why 2: なぜディレクトリが空でないのか？
→ 一部のファイルが削除されずに残っている

Why 3: なぜファイルが削除されずに残っているのか？
→ 複数のプロセスが同時にnode_modulesにアクセスしている

Why 4: なぜ複数のプロセスが同時にアクセスしているのか？
→ pnpm installが複数回実行されている

Why 5: なぜpnpm installが複数回実行されているのか？
→ pnpm prepare hookが自動的に実行され、prepare.sh内でpnpm install --frozen-lockfileを呼び出し、
   それが再びprepare hookを発動させる（無限ループ）

根本原因: pnpm prepare hookとpnpm install --frozen-lockfile/installの循環依存
```

**チェックリスト:**
- [ ] 「なぜ？」を最低5回繰り返した？
- [ ] 表面的な原因と根本原因を区別できている？
- [ ] 設計上の問題がないか確認した？
- [ ] 仕様・ドキュメントと照らし合わせた？

### Step 4: 根本的な解決策を実装

**目的:** 症状ではなく原因を修正し、二度と発生しないようにする

**実施事項:**

**❌ 対症療法の例:**
```bash
# リトライロジックで回避（根本解決ではない）
for i in {1..5}; do
  rm -rf node_modules && break || sleep 1
done

# sudo で強制削除（根本解決ではない）
sudo rm -rf node_modules

# リネームで回避（根本解決ではない）
mv node_modules node_modules.broken
```

**✅ 根本解決の例:**
```bash
# pnpm prepare hookを削除（根本原因を排除）
# package.json から "prepare" スクリプトを削除

# --ignore-scripts で明示的に制御
ppnpm install --ignore-scripts

# deploy scriptでビルドステップを明示的に実行
# prepare.shを廃止し、deploy.sh内で直接実行
```

**チェックリスト:**
- [ ] 症状ではなく原因を修正している？
- [ ] 同じ問題が再発しない設計になっている？
- [ ] コードレビューで根本解決であることを確認した？
- [ ] テストで再発防止を確認した？

### Step 5: ドキュメント・メモリに記録

**目的:** 同様の問題が発生した際の参考資料とする

**実施事項:**

**記録すべき内容:**
1. **問題の症状** - どのようなエラーが発生したか
2. **再現手順** - どのような条件で発生するか
3. **対症療法と失敗** - 試して失敗した対応
4. **根本原因** - 5 Whys分析の結果
5. **根本解決策** - 実装した解決策と理由
6. **再発防止策** - 同様の問題を防ぐための対策

**記録場所:**
- `CLAUDE.md` - 絶対厳守ルールとして追加
- `MEMORY.md` - 開発原則として追加
- `docs/07-development/` - 詳細ドキュメントとして記録
- コミットメッセージ - Root Cause Analysisの結果を記載

**チェックリスト:**
- [ ] 問題の全容を記録した？
- [ ] 根本原因と解決策を記録した？
- [ ] ドキュメントに反映した？
- [ ] コミットメッセージに記載した？

---

## 過去の失敗例と教訓

### Case 1: clean-deploy.shの3重ループ問題（2026-03-10）

**問題:**
```
clean-deploy.sh実行時にENOTEMPTYエラーが頻発
npm error code ENOTEMPTY
npm error syscall rmdir
npm error path /workspaces/.../node_modules/date-fns
```

**対症療法（失敗）:**
```bash
# 4段階リトライロジックで削除を強化
remove_directory_robust() {
  # Strategy 1: Normal deletion
  rm -rf "$target" || \
  # Strategy 2: sudo deletion
  sudo rm -rf "$target" || \
  # Strategy 3: Rename to backup
  sudo mv "$target" "${target}.broken" || \
  # Strategy 4: Individual file deletion
  find "$target" -type f -exec sudo rm -f {} \;
}
```

**なぜ対症療法では不十分だったのか:**
- エラーの症状（削除失敗）だけに対応
- 根本原因（3重ループ実行）を調査していない
- 同じエラーが繰り返し発生し続ける

**根本原因分析:**
```
clean-deploy.sh
  → ppnpm install
    → prepare hook (1回目)
      → prepare.sh
        → ppnpm install --frozen-lockfile
          → prepare hook (2回目)
            → prepare.sh
              → ppnpm install --frozen-lockfile
                → prepare hook (3回目) → ENOTEMPTY
```

**根本解決:**
```bash
# 1. package.jsonからprepare hookを削除
- "prepare": "cd infrastructure && ./prepare.sh"

# 2. pnpm installに--ignore-scriptsフラグを追加
ppnpm install --ignore-scripts

# 3. ビルドステップを明示的に実行
cd "$PROJECT_ROOT"
ppnpm install --ignore-scripts
cd "$PROJECT_ROOT/packages/database"
pnpm exec prisma generate
cd "$PROJECT_ROOT"
pnpm run build
```

**教訓:**
- ✅ 繰り返し発生するエラーは設計上の問題を疑う
- ✅ ログファイルが複数ある場合、複数回実行を疑う
- ✅ npm lifecycle scriptsの動作を深く理解する
- ✅ 「なぜ3回も実行されているのか？」という疑問を持つ

**効果:**
- ✅ ENOTEMPTYエラーが完全に解消
- ✅ デプロイ時間が短縮（3重実行 → 1回実行）
- ✅ 予測可能な実行フロー（明示的制御）

### Case 2: ElevenLabs WebSocket偽ストリーミング（2026-04-24）

**問題:**
TTS音声の再生開始が遅い。LiveKit水準のレイテンシが出ない。

**対症療法（当初の認識）:**
`useAudioPlayer.playChunk()` は実装済みなのに使われていない → 接続すれば解決と思われた。

**なぜ対症療法では不十分だったのか:**
`playChunk()` を接続しても、上流の `generateSpeechWebSocketStream()` が全チャンクを収集してから返す実装だったため、接続しても遅延は変わらない。

**根本原因分析（5 Whys）:**

1. **なぜ音声開始が遅い？**
   → TTS全音声生成後に再生が始まるから

2. **なぜTTS全音声生成後になる？**
   → `generateSpeechWebSocketStream()` がWebSocket close後にチャンクを返すから

3. **なぜWebSocket close後に返す？**
   → 実装が `ws.on('close')` で全チャンクをまとめてasync generatorに渡していたから

4. **なぜそうなったのか？**
   → WebSocket APIのevent-drivenモデルをasync generatorに変換する正しいパターンを使わなかったから

5. **根本原因:**
   → queue+Promise bridgeパターンを知らず（または適用しなかった）、収集してから返すシンプルな実装を選んだ

**根本解決:**
```typescript
// queue+Promiseパターン: WebSocket events → async generator のブリッジ
const queue: QueueEntry[] = [];
let waitResolve: (() => void) | null = null;

const enqueue = (entry: QueueEntry) => {
  queue.push(entry);
  if (waitResolve) { const r = waitResolve; waitResolve = null; r(); }
};

ws.on('message', data => { /* parse → enqueue({type:'chunk'}) */ });
ws.on('close', () => { enqueue({type:'done'}); });
ws.on('error', e => { enqueue({type:'error', error: e}); });

return (async function*() {
  while(true) {
    if(queue.length === 0) await new Promise<void>(r => { waitResolve = r; });
    const entry = queue.shift()!;
    if(entry.type === 'done') break;
    if(entry.type === 'error') throw entry.error;
    yield entry.value; // ← チャンク到着順に即yield
  }
})();
```

**教訓:**
- ✅ 「ストリーミング」という名前でも内部が偽ストリーミングの場合がある。接続前に実装を確認する
- ✅ Event-driven APIをasync generatorに変換する標準パターン（queue+Promiseブリッジ）を覚える
- ✅ レイテンシ問題は上流から調査する（再生 → TTS → AI → STT の順）
- ✅ 「実装済みだが使われていない」ものが存在する場合、なぜ使われていないかを必ず調べる

**効果:**
- ✅ ElevenLabs WebSocketの真のストリーミング達成
- ✅ センテンスレベルパイプラインと組み合わせて ~1-3s レイテンシ削減
- ✅ Web Audio API queue再生との統合が正常動作

---

### Case 3: 実装済み未接続コード（`useAudioPlayer`）（2026-04-24）

**問題:**
TTS音声再生のストリーミングが機能していない。

**根本原因:**
`apps/web/hooks/useAudioPlayer.ts` に `playChunk()` / `stop()` / Web Audio API queue の完全な実装が存在していたが、`apps/web/components/session-player/index.tsx` から一切importされておらず、`handleTTSAudioChunk` はコメントのみのplaceholder状態だった。

**なぜ未接続だったのか:**
実装と配線（wiring）が別タイミングで行われた。hookは実装されたが、SessionPlayerへの統合ステップが実行されなかった。

**検出方法:**
`grep -r "useAudioPlayer" apps/web` → hookファイル自体にのみ存在、importなし

**教訓:**
- ✅ 新しいhookを実装したら、同じコミットまたはPRで使用側の接続も含める
- ✅ placeholderコメントに「TODO」または「future implementation」と書かれた箇所は定期的にレビューする
- ✅ `grep -r "hookName"` で実際に使用されているか確認してから完了とする

---

### 問題発生時
- [ ] エラーの再現条件を特定した？
- [ ] ログ全体を確認した？（最後のエラーだけでなく）
- [ ] スタックトレース・呼び出しチェーンを追跡した？
- [ ] 関連するシステムプロセスを確認した？

### 原因分析時
- [ ] 「なぜ？」を5回繰り返した？
- [ ] 表面的な原因と根本原因を区別できている？
- [ ] 設計上の問題がないか確認した？
- [ ] 仕様・ドキュメントと照らし合わせた？

### 解決策実装時
- [ ] 症状ではなく原因を修正している？
- [ ] 対症療法ではなく根本解決になっている？
- [ ] 同じ問題が再発しない設計になっている？
- [ ] テストで再発防止を確認した？

### ドキュメント化時
- [ ] 問題の全容を記録した？
- [ ] 根本原因と解決策を記録した？
- [ ] CLAUDE.md / MEMORY.md に反映した？
- [ ] コミットメッセージに記載した？

---

## 参考資料

- **5 Whys分析:** https://en.wikipedia.org/wiki/Five_whys
- **Root Cause Analysis:** https://en.wikipedia.org/wiki/Root_cause_analysis
- **npm lifecycle scripts:** https://docs.npmjs.com/cli/v10/using-npm/scripts#life-cycle-scripts
- **CLAUDE.md Rule 3:** 根本原因分析の原則
- **MEMORY.md:** 最重要開発原則

---

**最終更新:** 2026-04-24 (Day 52 - Case 2, 3 追加)
**次回レビュー:** 問題発生時に随時更新
