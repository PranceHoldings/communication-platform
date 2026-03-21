# Phase 1.6 現状分析レポート - Prance Communication Platform

**作成日:** 2026-03-21
**分析期間:** Day 30
**ステータス:** 現状分析完了 - 実装計画策定中

---

## 📊 エグゼクティブサマリー

Phase 1.6（既存機能の実用化）の3つの主要領域について、コードベースの現状を分析しました。

**重要な発見:**
- ⚠️ **アバターレンダリング機能は未実装**（ゼロから作成が必要）
- ✅ **録画機能は実装済み**（改善のみ必要）
- ⚠️ **シナリオエンジンは部分的に実装**（改善・拡張が必要）

---

## 🎯 分析結果サマリー

### 1. アバターレンダリング: **未実装** ⚠️

**実装状況:** 0% (ゼロから作成が必要)

**現状:**
- `apps/web/components/session-player/index.tsx:2249` に空のcanvas要素のみ
- コメントに「将来Three.js統合用」と明記
- Live2D/Three.jsの実装なし
- アバター専用のレンダリングコンポーネントなし

**影響:**
- セッション実行時、アバターが表示されない
- ユーザーは静止画または空白画面を見る
- VideoComposerは動作するが、avatarCanvasは空白のまま合成される

**必要な作業:**
- Live2D Cubism SDK 5の統合（2Dアバター）
- Three.js + GLTFモデルの統合（3Dアバター）
- リップシンク実装（音声同期）
- 表情変更システム
- パフォーマンス最適化（60fps/30fps）

**優先度:** 🔴 **最高** (Phase 1.6の前提条件)

---

### 2. 録画機能: **実装済み** ✅

**実装状況:** 80% (基本機能完成、信頼性向上のみ必要)

#### Frontend実装 ✅

**useAudioRecorder** (`apps/web/hooks/useAudioRecorder.ts`)
- ✅ MediaRecorderによるマイク録音
- ✅ リアルタイムチャンク送信（1秒ごと）
- ✅ 無音検出（silenceThreshold: 0.15）
- ✅ speech_end イベント送信
- ✅ EBML headerチェック
- ✅ エラーハンドリング（LOW_VOLUME警告等）
- ✅ Phase 1.5対応（リアルタイム処理）

**useVideoRecorder** (`apps/web/hooks/useVideoRecorder.ts`)
- ✅ Canvas録画（MediaRecorder API）
- ✅ チャンク送信（1秒ごと）
- ✅ 音声トラック統合
- ✅ エラーハンドリング
- ✅ 録画時間カウンター

**VideoComposer** (`apps/web/components/session-player/video-composer.tsx`)
- ✅ アバターcanvas + ユーザーvideoの合成
- ✅ 2レイアウト対応（side-by-side, picture-in-picture）
- ✅ requestAnimationFrameによる60fps合成

**useAudioBuffer** (`apps/web/hooks/useAudioBuffer.ts`)
- ✅ 音声チャンクバッファリング（10チャンク）
- ✅ バッチ送信（5チャンクずつ）
- ✅ 100msフラッシュ間隔
- ✅ ネットワーク負荷80%削減

#### Backend実装 ✅

**AudioProcessor** (`infrastructure/lambda/shared/audio/`)
- ✅ Azure Speech Services STT
- ✅ ElevenLabs TTS (WebSocket Streaming)
- ✅ AWS Bedrock Claude (Streaming AI)
- ✅ リアルタイムチャンク処理

**VideoProcessor** (`infrastructure/lambda/websocket/default/video-processor.ts`)
- ✅ S3チャンク保存
- ✅ チャンク結合（ffmpeg）
- ✅ CloudFront CDN統合
- ✅ Signed URL生成

#### 改善が必要な箇所 ⚠️

**信頼性向上:**
- ❌ ACK確認なし（チャンク送信成功を確認していない）
- ❌ 自動リトライなし（送信失敗時の対応なし）
- ❌ 順序保証不十分（タイムスタンプのみ、シーケンス番号検証なし）
- ❌ 重複排除なし（同じチャンクが複数回送信される可能性）
- ❌ チャンク欠損検出なし（欠けたチャンクの検出・補間なし）

**パフォーマンス:**
- ⚠️ ffmpeg並列処理なし（チャンク結合が直列処理）
- ⚠️ S3アップロード直列処理（並列化で高速化可能）

**エラーハンドリング:**
- ⚠️ 録画失敗時の部分保存なし
- ⚠️ ユーザーへの録画状態通知不足

**優先度:** 🟡 **中** (動作はしているが改善の余地あり)

---

### 3. シナリオエンジン: **部分的に実装** ⚠️

**実装状況:** 50% (基本機能あり、拡張・改善が必要)

#### 現在の実装 ✅

**WebSocket Handler** (`infrastructure/lambda/websocket/default/index.ts`)
- ✅ scenarioPrompt: シナリオプロンプト保存
- ✅ scenarioLanguage: シナリオ言語設定
- ✅ conversationHistory: 会話履歴管理
- ✅ silenceTimeout, silencePromptTimeout: タイムアウト設定

**AI応答生成** (`infrastructure/lambda/shared/ai/bedrock.ts`)
- ✅ AWS Bedrock Claude Streaming API統合
- ✅ 会話履歴をコンテキストとして送信
- ✅ ストリーミング応答

**沈黙プロンプト** (`infrastructure/lambda/shared/utils/generateSilencePrompt.ts`)
- ✅ ユーザー沈黙時のAIプロンプト生成

#### 欠けている機能 ❌

**実行前バリデーション:**
- ❌ シナリオ構造検証なし（必須フィールド、構文エラーチェック）
- ❌ 警告表示なし（推奨設定チェック）
- ❌ テストモードなし（シナリオプレビュー機能）

**変数システム:**
- ❌ 変数型チェックなし（string, number, boolean）
- ❌ デフォルト値設定なし
- ❌ 変数一覧表示なし
- ❌ 変数置換エンジンなし

**エラーリカバリー:**
- ❌ シナリオ実行エラー時の継続処理なし（スキップして継続）
- ❌ 無限ループ防止なし（最大ターン数制限なし）
- ⚠️ タイムアウトは実装済み（セッション最大60分）

**パフォーマンス:**
- ❌ シナリオキャッシュなし（毎回データベースから取得）
- ❌ 次のステップ事前計算なし

**シナリオ実行ロジックの所在:**
- WebSocket handlerに統合されている（分離されていない）
- シナリオエンジンとして独立したモジュールになっていない

**優先度:** 🟡 **中** (基本機能は動作、拡張性・エラーハンドリング強化が必要)

---

## 📁 関連ファイルマップ

### Frontend

```
apps/web/
├── components/
│   └── session-player/
│       ├── index.tsx (2267 lines)           # メインコンポーネント
│       │   - Line 90: avatarCanvasRef (空のcanvas) ⚠️
│       │   - Line 2249: アバターcanvas定義（将来Three.js統合用）
│       └── video-composer.tsx (140 lines)    # アバター+ユーザー合成 ✅
└── hooks/
    ├── useAudioRecorder.ts (~600 lines)      # マイク録音 ✅
    ├── useVideoRecorder.ts (~250 lines)      # Canvas録画 ✅
    ├── useAudioBuffer.ts (~150 lines)        # 音声バッファリング ✅
    └── useWebSocket.ts (~800 lines)          # WebSocket通信 ✅
```

### Backend

```
infrastructure/lambda/
├── websocket/
│   └── default/
│       ├── index.ts (~2000 lines)            # WebSocketハンドラー
│       │   - Line 208: scenarioPrompt, scenarioLanguage
│       │   - Line 210: conversationHistory
│       ├── audio-processor.ts                # STT/AI/TTS統合 ✅
│       ├── video-processor.ts                # 録画処理 ✅
│       └── chunk-utils.ts                    # チャンクソート ✅
└── shared/
    ├── audio/
    │   ├── stt-azure.ts                      # Azure STT ✅
    │   └── tts-elevenlabs.ts                 # ElevenLabs TTS ✅
    ├── ai/
    │   └── bedrock.ts                        # AWS Bedrock Claude ✅
    └── utils/
        └── generateSilencePrompt.ts          # 沈黙プロンプト ✅
```

---

## 🎯 Phase 1.6 実装計画への影響

### 当初の想定 vs 現実

| 項目 | 当初の想定 | 現実 | 影響 |
|------|-----------|------|------|
| アバターレンダリング | 実装済み、最適化のみ | **未実装** | ⚠️ 追加工数大 |
| 録画機能 | 実装済み、改善のみ | 実装済み、改善のみ | ✅ 想定通り |
| シナリオエンジン | 実装済み、改善のみ | 部分的実装 | ⚠️ 追加工数中 |

### 優先順位の見直し

**Phase 1.6の実現可能性:**
- ❌ **当初計画（Day 15-21）は非現実的**
  - アバターレンダリングがゼロから作成必要
  - 推定工数: 2-3週間（Live2D + Three.js）

**現実的なアプローチ（3つのオプション）:**

#### Option A: Phase 1.6を2段階に分割 ✅ **推奨**

**Phase 1.6.1 (録画・シナリオ改善)** - 1週間
- Day 15-18: 録画機能信頼性向上（ACK、リトライ、順序保証）
- Day 19-21: シナリオエンジン改善（バリデーション、エラーハンドリング）

**Phase 1.6.2 (アバターレンダリング実装)** - 2-3週間（別フェーズとして計画）
- Week 4-6: Live2D/Three.js統合、リップシンク、表情変更
- アバターなしでもセッションは実行可能（音声会話のみ）

#### Option B: アバター実装を後回し

- Phase 1.6では録画・シナリオのみ改善
- アバターは Phase 2 以降で実装
- **影響:** セッション実行時、アバターが表示されない（音声のみ）

#### Option C: 最小限のアバター実装

- 静止画像アバター（簡易版）
- リップシンクなし、表情変更なし
- **影響:** ユーザー体験が低下

---

## 🚦 推奨アクション

### immediate (Day 30-31)

1. **Phase 1.6実装計画の見直し** ✅
   - Option Aを採用（2段階分割）
   - Phase 1.6.1に集中（録画・シナリオ改善）
   - Phase 1.6.2を新規フェーズとして計画

2. **Phase 1.5音声再生テストの完了** 🔴 最優先
   - 並行Track Bとして実施
   - 音声再生機能の検証完了
   - Phase 1.5完全完了

### short-term (Week 5)

3. **Phase 1.6.1実装開始**
   - Day 15-18: 録画機能信頼性向上
   - Day 19-21: シナリオエンジン改善

4. **Phase 1.6.2計画策定**
   - アバターレンダリング技術選定
   - Live2D vs Three.js vs 両方
   - 工数見積もり（2-3週間）

---

## 📊 技術的詳細

### 録画機能アーキテクチャ

```
┌────────────────────────────────────────────────────────┐
│ Frontend (Browser)                                     │
│                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ useAudio     │  │ useVideo     │  │ Video       │ │
│  │ Recorder     │  │ Recorder     │  │ Composer    │ │
│  │              │  │              │  │             │ │
│  │ Mic Input    │  │ Canvas       │  │ Avatar +    │ │
│  │ → Chunks     │  │ → Chunks     │  │ User Video  │ │
│  │   (1sec)     │  │   (1sec)     │  │   Merge     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │        │
│         └─────────────────┴──────────────────┘        │
│                           ↓                           │
│                  ┌────────────────┐                   │
│                  │ useAudioBuffer │                   │
│                  │ (Batch 5 chnk) │                   │
│                  └────────┬───────┘                   │
│                           ↓                           │
│                  ┌────────────────┐                   │
│                  │ WebSocket      │                   │
│                  │ (IoT Core)     │                   │
│                  └────────┬───────┘                   │
└───────────────────────────┼────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Backend (Lambda)                                       │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ WebSocket $default Handler                       │ │
│  │                                                  │ │
│  │  ┌────────────────┐  ┌────────────────────────┐ │ │
│  │  │ Audio         │  │ Video                  │ │ │
│  │  │ Processor     │  │ Processor              │ │ │
│  │  │               │  │                        │ │ │
│  │  │ STT → AI → TTS │  │ S3 Save → ffmpeg      │ │ │
│  │  └────────────────┘  └───────────┬────────────┘ │ │
│  └─────────────────────────────────┼────────────────┘ │
│                                    ▼                  │
│                          ┌──────────────────┐         │
│                          │ S3 Bucket        │         │
│                          │ + CloudFront CDN │         │
│                          └──────────────────┘         │
└────────────────────────────────────────────────────────┘
```

### シナリオ実行フロー（現状）

```
1. WebSocket接続
   ↓
2. auth_request (scenarioPrompt, scenarioLanguage含む)
   ↓
3. DynamoDB ConnectionData保存
   ├─ scenarioPrompt
   ├─ scenarioLanguage
   ├─ conversationHistory: []
   └─ silenceTimeout, silencePromptTimeout
   ↓
4. User Speech → audio_chunk_realtime
   ↓
5. speech_end → Azure STT
   ↓
6. transcript_final → AWS Bedrock Claude
   ├─ Input: scenarioPrompt + conversationHistory + user speech
   └─ Output: AI response (streaming)
   ↓
7. avatar_response_final → ElevenLabs TTS
   ↓
8. audio_response → Browser playback
   ↓
9. conversationHistory更新
   ↓
10. 手順4-9を繰り返し
```

**問題点:**
- シナリオエンジンとして独立していない
- バリデーション・エラーハンドリングが不十分
- キャッシュなし（毎回DB取得）

---

## 📚 関連ドキュメント

- [Phase 1.6 実装計画](../../03-planning/releases/PRODUCTION_READY_ROADMAP.md#phase-16-既存機能の実用化新規追加)
- [SessionPlayer Component](../../../apps/web/components/session-player/index.tsx)
- [useAudioRecorder Hook](../../../apps/web/hooks/useAudioRecorder.ts)
- [useVideoRecorder Hook](../../../apps/web/hooks/useVideoRecorder.ts)
- [WebSocket Default Handler](../../../infrastructure/lambda/websocket/default/index.ts)

---

**最終更新:** 2026-03-21 10:30 UTC (Day 30)
**次回更新:** Phase 1.6.1 実装計画策定完了時
**作成者:** Claude Code (Task #6 完了)
