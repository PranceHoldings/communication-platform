# トランスクリプトプレイヤー

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [トランスクリプトデータ構造](#トランスクリプトデータ構造)
3. [同期プレイヤー実装](#同期プレイヤー実装)
4. [プレイヤー画面構成](#プレイヤー画面構成)

---

## 概要

トランスクリプトプレイヤーは、録画された会話セッションの再生と文字起こしを同期表示するモジュールです。

### 主要機能

| 機能 | 説明 |
| ---- | ---- |
| **同期再生** | 録画映像と文字起こしを完全同期 |
| **ハイライト表示** | 重要な発言を強調表示 |
| **検索機能** | トランスクリプト内の全文検索 |
| **タイムスタンプジャンプ** | 特定の発言にジャンプ |

---

## トランスクリプトデータ構造

```typescript
interface Transcript {
  id: string;
  sessionId: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestampStart: number; // 秒
  timestampEnd: number;
  confidence: number; // 0.0 - 1.0
  highlight?: 'positive' | 'negative' | 'important';
  emotionSnapshot?: {
    emotion: string;
    score: number;
  };
}
```

---

## 同期プレイヤー実装

```typescript
class TranscriptPlayer {
  private video: HTMLVideoElement;
  private transcripts: Transcript[];
  private currentIndex: number = 0;

  constructor(videoUrl: string, transcripts: Transcript[]) {
    this.video = document.getElementById('video-player') as HTMLVideoElement;
    this.video.src = videoUrl;
    this.transcripts = transcripts.sort((a, b) => a.timestampStart - b.timestampStart);

    this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
  }

  private onTimeUpdate() {
    const currentTime = this.video.currentTime;

    // 現在時刻に対応するトランスクリプトを検索
    const currentTranscript = this.transcripts.find(
      (t) => t.timestampStart <= currentTime && currentTime <= t.timestampEnd
    );

    if (currentTranscript) {
      this.highlightTranscript(currentTranscript.id);
    }
  }

  private highlightTranscript(id: string) {
    // UIで該当トランスクリプトをハイライト
    document.querySelectorAll('.transcript-item').forEach((el) => {
      el.classList.remove('active');
    });
    document.getElementById(`transcript-${id}`)?.classList.add('active');
  }

  jumpToTimestamp(timestamp: number) {
    this.video.currentTime = timestamp;
  }
}
```

---

## プレイヤー画面構成

```
┌─────────────────────────────────────────────────────────────────┐
│ セッション再生: エンジニア採用面接               [✕ 閉じる]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │               録画映像                                   │   │
│  │                                                          │   │
│  │           [▶ 再生] [⏸ 一時停止] [⏹ 停止]                │   │
│  │           ━━━━━━━━●━━━━━━━━ 05:32 / 28:45             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  💬 トランスクリプト                          [🔍 検索]         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 00:12  AI: ありがとうございます。自己紹介から...        │   │
│  │ 00:45  あなた: 田中太郎と申します。5年間...            │   │
│  │ ▶ 01:23  AI: 技術スタックについて教えて...    ← 現在位置│   │
│  │ 02:10  あなた: Node.js、TypeScript、PostgreSQL...       │   │
│  │ 03:05  AI: 素晴らしいですね。チームワークは...          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  📊 セッション統計                                               │
│  総時間: 28分45秒 | 会話ターン: 24回 | 発話比率: AI 42% / あなた 58%│
└─────────────────────────────────────────────────────────────────┘
```

---

**最終更新:** 2026-03-05
