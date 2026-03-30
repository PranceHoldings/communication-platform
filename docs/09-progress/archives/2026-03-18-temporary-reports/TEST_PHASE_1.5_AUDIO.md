# Phase 1.5 Day 12 - 音声再生機能テスト手順

**作成日:** 2026-03-11 21:47 JST
**目的:** ElevenLabs TTS音声がブラウザで正しく再生されるか確認

---

## 前提条件

### Lambda関数デプロイ状況
- ✅ WebSocket Lambda: 2026-03-11 15:43 UTC (2026-03-12 00:43 JST)
- ✅ Sessions Lambda: 2026-03-11 15:19 UTC (2026-03-12 00:19 JST)

### 修正内容
1. **環境ノイズ無限ループ対策**
   - `useAudioRecorder.ts` Line 54: `silenceThreshold = 0.15` (0.05から引き上げ)
   - Line 75-77: `MINIMUM_SPEECH_DURATION = 200ms` 追加

2. **ElevenLabs 0バイト問題対策**
   - `tts-elevenlabs.ts` Line 292: `generateSpeechWebSocketStream()` 関数定義修正
   - async generator宣言なのにPromise返却する矛盾を解消

---

## テスト手順

### Step 1: ブラウザでアプリケーションを開く

```bash
# URL
http://localhost:3000
```

**重要:** ハードリフレッシュを実行してキャッシュをクリア
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Step 2: ログイン

```
Email: admin@prance.com
Password: Admin2026!Prance
```

### Step 3: テストセッションを作成

1. ダッシュボード → Sessions → "New Session"
2. シナリオを選択（既存のシナリオ、例: "Interview Practice"）
3. アバターを選択（既存のアバター）
4. "Start Session" をクリック

### Step 4: 音声テストを実行

#### 4.1 マイク許可
- ブラウザがマイクアクセスを要求 → "Allow" をクリック

#### 4.2 環境ノイズ検出の確認
**期待される動作:**
- ✅ 環境ノイズ（エアコン、キーボード音）で無限ループが発生しない
- ✅ 音声検出閾値が0.15に引き上げられている（開発者ツールで確認可能）

**確認方法:**
- DevToolsを開く（F12）
- Console タブで `silenceThreshold` を検索
- `0.15` が設定されていることを確認

#### 4.3 音声会話テスト
1. **ユーザーが話す** - マイクに向かって話す（例: "Hello, how are you?"）
2. **無音検出** - 話し終わった後、500ms無音が続く
3. **STT処理** - 文字起こしが画面に表示される ✓（既に確認済み）
4. **AI応答生成** - アバターの応答テキストが表示される
5. **🔴 TTS音声再生** - **アバターの音声が再生される**（最重要確認項目）

#### 4.4 チェックポイント

| 項目 | 確認方法 | 期待結果 | ステータス |
|------|----------|----------|------------|
| 1. 文字起こし表示 | 画面にユーザーの発言が表示される | ✅ 表示される | 既に確認済み |
| 2. AI応答テキスト | 画面にアバターの返答が表示される | ✅ 表示される | 確認必要 |
| 3. **音声再生** | **スピーカーから音声が聞こえる** | **✅ 聞こえる** | **未確認（最重要）** |
| 4. リアルタイム性 | AI応答後2-5秒以内に音声再生開始 | ✅ 2-5秒以内 | 確認必要 |
| 5. 音声の品質 | ロボット声でない、自然な発音 | ✅ 自然 | 確認必要 |
| 6. 環境ノイズ無限ループ | 環境音で誤検出しない | ✅ 誤検出しない | 確認必要 |

### Step 5: CloudWatch Logsで詳細確認

```bash
# TTS完了ログを確認（0バイトでないこと）
aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --filter-pattern "\"[Streaming] TTS complete\""

# 期待される出力例:
# [Streaming] TTS complete: 71392 bytes (NOT 0 bytes)
```

```bash
# S3に音声ファイルが保存されているか確認
aws s3 ls s3://prance-storage-dev/sessions/ --recursive | grep "audio-response"

# 期待される出力例:
# 2026-03-11 21:50:00    71392 sessions/{session_id}/audio-response-1.mp3
```

---

## トラブルシューティング

### 音声が再生されない場合

#### 1. DevToolsでエラー確認
```
F12 → Console タブ
エラーメッセージを確認
```

#### 2. CloudWatch Logsで0バイト確認
```bash
aws logs tail /aws/lambda/prance-websocket-default-dev --since 5m --filter-pattern "\"TTS complete\""

# 0 bytes が表示される場合 → ElevenLabs API呼び出しエラー
```

#### 3. WebSocket接続確認
```
F12 → Network タブ → WS タブ
WebSocket接続が確立されているか確認
```

#### 4. ElevenLabs API Key確認
```bash
# Lambda環境変数を確認
aws lambda get-function-configuration --function-name prance-websocket-default-dev --query 'Environment.Variables.ELEVENLABS_API_KEY'

# 期待: "sk_..."で始まる有効なAPIキー
```

### 環境ノイズで無限ループが発生する場合

#### 1. 閾値の確認
```bash
# useAudioRecorder.ts Line 54を確認
grep -n "silenceThreshold" apps/web/hooks/useAudioRecorder.ts
```

**期待:** `silenceThreshold = 0.15`

#### 2. 閾値をさらに引き上げる（必要な場合）
```bash
# 0.15 → 0.20 に変更
# useAudioRecorder.ts Line 54
```

---

## 成功基準

以下のすべてが満たされた場合、Day 12完了：

- ✅ 文字起こしが正常に表示される
- ✅ AI応答が正常に生成される
- ✅ **音声が再生される（最重要）**
- ✅ リアルタイム性（2-5秒以内）
- ✅ 環境ノイズで無限ループが発生しない
- ✅ CloudWatch Logsで0バイトエラーがない

---

## 次のステップ（Day 12完了後）

### Day 13-14: パフォーマンステスト（推定2日）
- レスポンス時間測定（10回以上、平均・最小・最大値）
- 同時接続負荷テスト（5-10セッション同時実行）
- メモリリーク確認（長時間セッションテスト）
- パフォーマンス最適化（ボトルネック特定・改善）

### Phase 1.6（Week 2.5-3.5）: 既存機能の実用化
- エラーハンドリング、リトライロジック
- レート制限、パフォーマンス最適化
- 監視、分析、アラート

---

**テスト実施日時:** ___________
**テスター:** ___________
**結果:** ⬜ 成功 / ⬜ 失敗
**備考:** ___________
