# セッション録画モジュール

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [セッション実行フロー](#セッション実行フロー)
3. [セッション実行中のUI表示](#セッション実行中のui表示)
4. [リアルタイム文字起こし実装詳細](#リアルタイム文字起こし実装詳細)
5. [録画技術的実装詳細](#録画技術的実装詳細)
6. [録画品質設定](#録画品質設定)
7. [ストレージ管理](#ストレージ管理)
8. [プライバシー・ユーザー制御](#プライバシーユーザー制御)

---

## 概要

セッション録画モジュールは、AIアバターとユーザーの会話セッションを記録・保存するシステムです。アバター映像、ユーザーカメラ映像、音声、文字起こしをリアルタイムで処理・保存します。

### 主要機能

| 機能                     | 説明                                        |
| ------------------------ | ------------------------------------------- |
| **リアルタイムSTT**      | ユーザー音声を即座にテキスト化              |
| **マルチストリーム録画** | アバター映像 + ユーザーカメラ映像の同時録画 |
| **合成録画**             | 2つの映像を1つに合成（Picture-in-Picture）  |
| **クラウドストレージ**   | S3 + CloudFrontで高速配信                   |
| **プライバシー保護**     | 録画のオン/オフ、自動削除機能               |

---

## セッション実行フロー

```
セッション開始
     │
     ▼
シナリオ・アバター・音声選択
     │
     ▼
カメラ・マイクアクセス許可
     │
     ▼
┌────────────────────────────────────┐
│ セッション実行中                    │
│ ・AIアバター表示＆リップシンク      │
│ ・ユーザーカメラ表示（PiP）         │
│ ・リアルタイムSTT                   │
│ ・会話ターンカウント                │
│ ・経過時間表示                      │
└────────────────────────────────────┘
     │
     ▼
セッション終了
     │
     ▼
録画処理（MediaRecorder → S3）
     │
     ▼
解析処理（感情・音声特徴）
     │
     ▼
レポート生成
     │
     ▼
完了通知
```

---

## セッション実行中のUI表示

```
┌─────────────────────────────────────────────────────────────────┐
│ セッション実行中                              [一時停止] [終了] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │              AIアバター表示エリア                         │   │
│  │           (Three.js / Live2D レンダリング)               │   │
│  │                                                          │   │
│  │                                                          │   │
│  │                    ┌───────────┐                         │   │
│  │                    │ ユーザー  │ ← PiP (Picture-in-Picture) │
│  │                    │ カメラ    │                         │   │
│  │                    └───────────┘                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  📊 セッション情報                                               │
│  経過時間: 05:32 / 30:00                                        │
│  会話ターン: 8回                                                 │
│                                                                  │
│  💬 リアルタイム文字起こし                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AI: では、技術スタックについて教えていただけますか？    │   │
│  │ あなた: 主にNode.jsとTypeScriptを使用しています。       │   │
│  │ AI: なるほど、具体的なプロジェクト経験を教えて...       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  🎤 あなたのターンです                        [🔴 録音中...]   │
│  [テキスト入力モードに切り替え]                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## リアルタイム文字起こし実装詳細

### WebSocket経由のSTT

```typescript
// フロントエンド: WebSocket STT Client
class RealtimeSTTClient {
  private ws: WebSocket;
  private mediaRecorder: MediaRecorder;

  constructor(private sessionId: string) {
    this.ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.ws.onmessage = event => {
      const data = JSON.parse(event.data);
      if (data.type === 'transcript') {
        this.onTranscript(data.text, data.isFinal);
      }
    };
  }

  async startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        this.ws.send(event.data);
      }
    };

    this.mediaRecorder.start(100); // 100msごとに送信
  }

  stopRecording() {
    this.mediaRecorder?.stop();
  }

  private onTranscript(text: string, isFinal: boolean) {
    // UIに表示
    updateTranscriptDisplay(text, isFinal);

    // 確定テキストをDBに保存
    if (isFinal) {
      saveTranscript(this.sessionId, text);
    }
  }
}
```

---

## 録画技術的実装詳細

### MediaRecorder API

```typescript
// 録画マネージャー
class SessionRecorder {
  private userRecorder: MediaRecorder;
  private avatarRecorder: MediaRecorder;
  private chunks: { user: Blob[]; avatar: Blob[] } = { user: [], avatar: [] };

  async startRecording() {
    // ユーザーカメラ録画
    const userStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
    this.userRecorder = new MediaRecorder(userStream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2500000, // 2.5 Mbps
    });

    // アバターCanvas録画
    const avatarCanvas = document.getElementById('avatar-canvas') as HTMLCanvasElement;
    const avatarStream = avatarCanvas.captureStream(30); // 30fps
    this.avatarRecorder = new MediaRecorder(avatarStream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 3000000, // 3 Mbps
    });

    // データ収集
    this.userRecorder.ondataavailable = e => this.chunks.user.push(e.data);
    this.avatarRecorder.ondataavailable = e => this.chunks.avatar.push(e.data);

    this.userRecorder.start(1000); // 1秒ごと
    this.avatarRecorder.start(1000);
  }

  async stopAndUpload(sessionId: string) {
    this.userRecorder.stop();
    this.avatarRecorder.stop();

    // Blob作成
    const userBlob = new Blob(this.chunks.user, { type: 'video/webm' });
    const avatarBlob = new Blob(this.chunks.avatar, { type: 'video/webm' });

    // S3にアップロード
    await Promise.all([
      uploadToS3(userBlob, `sessions/${sessionId}/user.webm`),
      uploadToS3(avatarBlob, `sessions/${sessionId}/avatar.webm`),
    ]);
  }
}
```

---

## 録画品質設定

| 設定           | 標準     | 高画質    |
| -------------- | -------- | --------- |
| 解像度         | 1280x720 | 1920x1080 |
| フレームレート | 30fps    | 60fps     |
| ビットレート   | 2.5 Mbps | 5 Mbps    |
| コーデック     | VP9      | H.264     |

---

## ストレージ管理

- **S3バケット:** `prance-recordings`
- **保存期間:** 90日（自動削除）
- **CDN:** CloudFront経由で配信

---

## プライバシー・ユーザー制御

- 録画のオン/オフ切り替え
- 自動削除設定（30日/90日/無期限）
- ダウンロード機能

---

**最終更新:** 2026-03-05
