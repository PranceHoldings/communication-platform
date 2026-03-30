# Phase 1-1.6 残タスクサマリー

**作成日:** 2026-03-21 15:45 UTC (Day 30)
**ステータス:** 分析完了 - 実装待ち
**重要度:** 🔴 最高優先度

---

## 📊 エグゼクティブサマリー

START_HERE.md では **「Phase 1-1.6 完了（100%）」** と記載されていますが、実際には以下の重大な問題があります：

### 🚨 致命的な問題

1. **Phase 1.5: リアルタイム会話が未完成**
   - 音声会話がバッチ処理（セッション終了時に一括処理）
   - リアルタイムSTT/AI/TTSが不完全
   - **実用性: ゼロ**

2. **Phase 1.6: アバターレンダリングが未実装**
   - Live2D/Three.js の統合なし
   - セッション中、アバターが表示されない
   - **実装率: 0%**

3. **Phase 1.6: 録画機能の信頼性不足**
   - ACK確認なし、リトライなし
   - チャンク欠損検出なし
   - **実装率: 80%**

4. **Phase 1.6: シナリオエンジンが部分的**
   - バリデーション、変数システム未実装
   - エラーリカバリーなし
   - **実装率: 50%**

---

## 🎯 Phase 1.5: リアルタイム会話実装（未完成）

### 現状の問題

**PRODUCTION_READY_ROADMAP.md からの引用:**

> **音声会話機能の致命的問題**
> - ❌ ユーザーが話した後、**セッション終了まで**文字起こしが返ってこない
> - ❌ AIの応答も**セッション終了まで**返ってこない
> - ❌ リアルタイム会話ではなく、**バッチ処理**
> - ❌ 実用性: **ゼロ**

### あるべき姿

```
ユーザーが話す → 即座に文字起こし表示（1-2秒）
              → AI応答生成（2-5秒）
              → 音声再生開始（即座）
              → 会話が自然に継続
```

### 必要な実装

#### 1. リアルタイムSTT（1-3日）

**現状:**
```typescript
// ❌ セッション終了時に一括送信
mediaRecorder.onstop = () => {
  const audioBlob = new Blob(chunks, { type: 'audio/webm' });
  sendAudioData(audioBlob); // セッション終了時のみ
};
```

**必要な実装:**
```typescript
// ✅ 1秒ごとにチャンク送信
mediaRecorder.start(1000); // 1秒timeslice

mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0) {
    sendAudioChunk(event.data); // リアルタイム送信
  }
};

// ✅ 無音検出で発話終了を判定
const silenceDetector = new SilenceDetector({
  threshold: 0.15,
  minDuration: 200, // 200ms無音で発話終了
});

silenceDetector.on('speech_end', () => {
  ws.send({ action: 'speech_end' }); // STT処理トリガー
});
```

**実装ファイル:**
- `apps/web/hooks/useAudioRecorder.ts` - チャンク送信実装
- `infrastructure/lambda/websocket/default/audio-processor.ts` - リアルタイム処理

**タスク:**
- [ ] MediaRecorder timeslice設定（1秒）
- [ ] 音声チャンクのWebSocket送信
- [ ] 無音検出実装（Web Audio API）
- [ ] Lambda側リアルタイムSTT処理
- [ ] 文字起こし結果のWebSocket返却

**推定時間:** 1-3日

---

#### 2. ストリーミングAI応答（1-2日）

**現状:**
```typescript
// ⚠️ AI応答は一括で返却（ストリーミングAPIは使用しているが最適化の余地あり）
const response = await generateAIResponse(userText);
ws.send({ action: 'ai_response', text: response });
```

**必要な改善:**
```typescript
// ✅ チャンクごとにリアルタイム送信
const stream = await bedrockClient.generateResponseStream(userText);

for await (const chunk of stream) {
  ws.send({
    action: 'ai_response_chunk',
    chunk: chunk.text,
    isDone: chunk.isDone,
  });
}
```

**実装ファイル:**
- `infrastructure/lambda/shared/ai/bedrock.ts` - Streaming API最適化
- `infrastructure/lambda/websocket/default/index.ts` - チャンク送信

**タスク:**
- [ ] Bedrock Streaming APIの最適化確認
- [ ] チャンクごとのWebSocket送信
- [ ] Frontend でのリアルタイム表示
- [ ] バッファリング・エラーハンドリング

**推定時間:** 1-2日

---

#### 3. ストリーミングTTS（1-2日）

**現状:**
```typescript
// ✅ ElevenLabs WebSocket Streaming APIは実装済み
// ⚠️ 音声再生のバッファリング・品質に改善の余地あり
```

**必要な改善:**
```typescript
// ✅ 音声チャンクのバッファリング
const audioBuffer = new AudioBufferQueue();

ws.on('tts_chunk', (chunk) => {
  audioBuffer.enqueue(chunk);
  if (!isPlaying) {
    audioBuffer.play(); // 自動再生開始
  }
});
```

**実装ファイル:**
- `apps/web/hooks/useAudioPlayer.ts` - 音声バッファリング改善
- `infrastructure/lambda/shared/audio/tts-elevenlabs.ts` - ストリーミング最適化

**タスク:**
- [ ] 音声バッファリングキュー実装
- [ ] 自動再生開始ロジック
- [ ] 音声品質チェック
- [ ] エラーハンドリング

**推定時間:** 1-2日

---

### Phase 1.5 合計推定時間: 3-7日

---

## 🎯 Phase 1.6: アバターレンダリング実装（未実装）

### 現状の問題

**PHASE_1.6_CURRENT_STATE_ANALYSIS.md からの引用:**

> **アバターレンダリング: 未実装** ⚠️
>
> **実装状況:** 0% (ゼロから作成が必要)
>
> **現状:**
> - `apps/web/components/session-player/index.tsx:2249` に空のcanvas要素のみ
> - コメントに「将来Three.js統合用」と明記
> - Live2D/Three.jsの実装なし
> - アバター専用のレンダリングコンポーネントなし
>
> **影響:**
> - セッション実行時、アバターが表示されない
> - ユーザーは静止画または空白画面を見る

### 必要な実装

#### 1. Live2D統合（2Dアバター）（3-5日）

**実装タスク:**
- [ ] Live2D Cubism SDK 5 インストール
- [ ] Live2Dモデルローダー実装
- [ ] リップシンク実装（音素データ連携）
- [ ] 表情変更システム（感情に応じた表情）
- [ ] パフォーマンス最適化（60fps維持）

**実装ファイル:**
- `apps/web/components/avatar/Live2DAvatar.tsx` - Live2Dレンダラー（新規作成）
- `apps/web/lib/avatar/live2d-loader.ts` - モデルローダー（新規作成）
- `apps/web/lib/avatar/lip-sync.ts` - リップシンク（新規作成）

**推定時間:** 3-5日

---

#### 2. Three.js統合（3Dアバター）（3-5日）

**実装タスク:**
- [ ] Three.js + React Three Fiber セットアップ
- [ ] GLTFモデルローダー実装
- [ ] リップシンク実装（Blendshape制御）
- [ ] 表情変更システム
- [ ] カメラ制御・ライティング
- [ ] パフォーマンス最適化（30fps-60fps）

**実装ファイル:**
- `apps/web/components/avatar/ThreeDAvatar.tsx` - Three.jsレンダラー（新規作成）
- `apps/web/lib/avatar/gltf-loader.ts` - GLTFローダー（新規作成）
- `apps/web/lib/avatar/blendshape-controller.ts` - Blendshape制御（新規作成）

**推定時間:** 3-5日

---

#### 3. アバター切り替え・統合（1-2日）

**実装タスク:**
- [ ] アバタータイプ判定（TWO_D / THREE_D）
- [ ] 動的コンポーネント切り替え
- [ ] VideoComposer統合
- [ ] プリセットアバター対応

**実装ファイル:**
- `apps/web/components/session-player/index.tsx` - アバター統合
- `apps/web/components/avatar/AvatarRenderer.tsx` - 統一インターフェース（新規作成）

**推定時間:** 1-2日

---

### Phase 1.6 アバター合計推定時間: 7-12日

---

## 🎯 Phase 1.6: 録画機能の信頼性向上（改善）

### 現状の問題

**PHASE_1.6_CURRENT_STATE_ANALYSIS.md からの引用:**

> **録画機能: 実装済み** ✅
>
> **実装状況:** 80% (基本機能完成、信頼性向上のみ必要)
>
> **改善が必要な箇所:**
> - ❌ ACK確認なし（チャンク送信成功を確認していない）
> - ❌ 自動リトライなし（送信失敗時の対応なし）
> - ❌ 順序保証不十分（タイムスタンプのみ、シーケンス番号検証なし）
> - ❌ 重複排除なし（同じチャンクが複数回送信される可能性）
> - ❌ チャンク欠損検出なし（欠けたチャンクの検出・補間なし）

### 必要な実装

**Phase 1.6.1 実装計画（Day 31-37）が存在:**
- `PHASE_1.6.1_IMPLEMENTATION_PLAN.md` に詳細な実装計画あり
- Day 31: WebSocket ACK追跡システム
- Day 32: 順序保証・重複排除
- Day 33: チャンク結合最適化
- Day 34: エラーハンドリング・UI改善
- Day 35-37: シナリオ関連

**実装状況:**
- ⚠️ 計画書は存在するが、実際の実装は未着手
- `useWebSocketConnection.ts` などのファイルが存在しない

**推定時間:** 3-5日（Phase 1.6.1 計画に従う）

---

## 🎯 Phase 1.6: シナリオエンジン改善（改善）

### 現状の問題

**PHASE_1.6_CURRENT_STATE_ANALYSIS.md からの引用:**

> **シナリオエンジン: 部分的に実装** ⚠️
>
> **実装状況:** 50% (基本機能あり、拡張・改善が必要)
>
> **欠けている機能:**
> - ❌ 実行前バリデーションなし
> - ❌ 変数システムなし
> - ❌ エラーリカバリーなし
> - ❌ シナリオキャッシュなし

### 必要な実装

**Phase 1.6.1 実装計画に含まれる:**
- Day 35: シナリオバリデーション・エラーリカバリー
- Day 36: シナリオキャッシュ・変数システム
- Day 37: パフォーマンステスト・デプロイ

**推定時間:** 2-3日（Phase 1.6.1 計画に含まれる）

---

## 📋 実装優先順位

### P0（最高優先度）- ブロッカー

1. **アバターレンダリング実装** 🔴
   - **理由:** セッション実行の前提条件
   - **推定:** 7-12日
   - **ブロック:** Phase 1.6完了を阻害

2. **Phase 1.5 リアルタイム会話完成** 🔴
   - **理由:** 実用性ゼロ
   - **推定:** 3-7日
   - **ブロック:** ユーザー体験の根幹

### P1（高優先度）- 実用性向上

3. **録画機能の信頼性向上** 🟡
   - **理由:** データ損失リスク
   - **推定:** 3-5日
   - **Phase 1.6.1 計画:** Day 31-34

4. **シナリオエンジン改善** 🟡
   - **理由:** エラーリカバリー不足
   - **推定:** 2-3日
   - **Phase 1.6.1 計画:** Day 35-36

---

## 🎯 推奨アクションプラン

### Option A: Phase 1完全化（推奨）⭐

**期間:** 2-3週間
**内容:** Phase 1.5-1.6 の完全実装

**Week 1:**
- Phase 1.5: リアルタイム会話完成（3-7日）

**Week 2-3:**
- Phase 1.6: アバターレンダリング実装（7-12日）
- Phase 1.6: 録画機能信頼性向上（3-5日、並行可）

**効果:**
- ✅ ユーザーが実際に使える状態になる
- ✅ Phase 1 を「実用レベル」と呼べるようになる
- ✅ Production デプロイに自信が持てる

---

### Option B: 最小限の修正（非推奨）

**期間:** 1週間
**内容:** Phase 1.5のみ完成

**理由:**
- アバターなしでは製品として不完全
- 録画機能の信頼性不足はデータ損失リスク
- **推奨しない**

---

## 📚 関連ドキュメント

- [PRODUCTION_READY_ROADMAP.md](../../03-planning/releases/PRODUCTION_READY_ROADMAP.md) - 実用レベル対応計画
- [PHASE_1.6_CURRENT_STATE_ANALYSIS.md](PHASE_1.6_CURRENT_STATE_ANALYSIS.md) - 現状分析
- [PHASE_1.6.1_IMPLEMENTATION_PLAN.md](PHASE_1.6.1_IMPLEMENTATION_PLAN.md) - 実装計画
- [PHASE_1.6.1_COMPLETE_SUMMARY.md](PHASE_1.6.1_COMPLETE_SUMMARY.md) - 完了サマリー（計画書）

---

## 📊 まとめ

### 現状

| Phase | 記載ステータス | 実際のステータス | 実装率 |
|-------|---------------|-----------------|--------|
| Phase 1.5 | "完了" | 未完成 | 60-70% |
| Phase 1.6 Avatar | "完了" | 未実装 | 0% |
| Phase 1.6 Recording | "完了" | 改善必要 | 80% |
| Phase 1.6 Scenario | "完了" | 部分実装 | 50% |

### 必要な作業

| タスク | 優先度 | 推定時間 | 実装計画 |
|--------|--------|---------|---------|
| アバターレンダリング | P0 🔴 | 7-12日 | 新規実装 |
| リアルタイム会話 | P0 🔴 | 3-7日 | 改善・完成 |
| 録画機能信頼性 | P1 🟡 | 3-5日 | Phase 1.6.1 計画あり |
| シナリオエンジン | P1 🟡 | 2-3日 | Phase 1.6.1 計画あり |

**合計推定時間:** 15-27日（2-4週間）

---

**作成日:** 2026-03-21 15:45 UTC (Day 30)
**次のアクション:** Phase 1完全化の実施判断
