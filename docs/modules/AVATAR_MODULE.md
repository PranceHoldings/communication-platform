# アバターモジュール

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [アバタータイプと生成方法](#アバタータイプと生成方法)
3. [アバター選択UI](#アバター選択ui)
4. [画像からのアバター生成パイプライン](#画像からのアバター生成パイプライン)
5. [リップシンク実装](#リップシンク実装)
6. [表情システム](#表情システム)
7. [データ構造](#データ構造)
8. [API仕様](#api仕様)
9. [実装ガイド](#実装ガイド)

---

## 概要

アバターモジュールは、AIアバターの選択・生成・管理・レンダリングを担当する中核システムです。ユーザーがプリセットアバターを選択するか、自分の画像から独自のアバターを生成できる機能を提供します。

### 主要機能

| 機能 | 説明 | アクセス権限 |
| ---- | ---- | ---------- |
| **プリセットアバター選択** | 事前用意された2D/3Dアバターから選択 | 全ユーザー |
| **画像からのアバター生成** | ユーザーアップロード画像から2D/3Dアバターを生成 | Pro以上 |
| **カスタムアバターライブラリ** | 生成したアバターを保存・再利用 | Pro以上 |
| **組織専用アバター** | 管理者が組織メンバー向けにカスタムプリセットを追加 | 組織管理者 |
| **リップシンク** | 音声に合わせた口の動きの同期 | 全ユーザー |
| **表情制御** | AIの感情状態に応じた表情変化 | 全ユーザー |

### 設計方針

- **マルチフォーマット対応**: 2Dアニメ（Live2D）、3Dリアル（Ready Player Me）の両方をサポート
- **段階的アクセス**: 無料ユーザーはプリセットのみ、有料ユーザーはカスタム生成が可能
- **高パフォーマンス**: WebGLを活用した60fps以上のスムーズなレンダリング
- **リアルタイム性**: 音声とリップシンクの遅延を50ms以内に抑制

---

## アバタータイプと生成方法

### サポートするアバタータイプ

| タイプ | ソース | 生成方法 | レンダリング | アクセス権限 |
| ---------------------- | ---------------------------- | ------------------------------------------ | ---------------------- | ---------- |
| **2Dアニメ（プリセット）** | Live2D既製モデル | ライブラリから選択 | Canvas 2D / Live2D SDK | 全ユーザー |
| **2Dアニメ（画像生成）** | ユーザーアップロード画像 | AnimeGANスタイル変換 + 顔ランドマーク駆動 | Canvas 2D | Pro以上 |
| **3Dリアル（プリセット）** | Ready Player Me標準モデル | ライブラリから選択 | Three.js / WebGL | 全ユーザー |
| **3Dリアル（画像生成）** | ユーザーアップロード画像 | RPM Photo Capture API | Three.js / WebGL | Pro以上 |

### 各タイプの特徴

#### 2Dアニメ（プリセット）

**特徴:**
- Live2D Cubism SDK 5を使用
- 軽量（1モデルあたり1-3MB）
- アニメ風のキャラクター表現
- 表情パラメータで豊かな表現が可能

**用途:**
- カジュアルな会話練習
- 語学学習
- エンターテインメント

**提供モデル数:** 初期20種類（ビジネス・カジュアル・フレンドリー・フォーマル各5種）

#### 2Dアニメ（画像生成）

**特徴:**
- ユーザーの顔写真をアニメ風に変換
- AnimeGANv2でスタイル変換
- MediaPipeで顔パーツを検出し、Live2Dパラメータにマッピング

**用途:**
- パーソナライズされた学習体験
- ブランドマスコットキャラクターの再現

**制限:**
- Pro以上のプラン
- 生成時間: 約30-60秒

#### 3Dリアル（プリセット）

**特徴:**
- Ready Player Me標準モデル（GLB形式）
- フォトリアルな表現
- ARKit 52 Blendshapesで詳細な表情制御

**用途:**
- ビジネス面接練習
- フォーマルなトレーニング
- プロフェッショナルな印象が必要なシナリオ

**提供モデル数:** 初期15種類（多様な性別・年齢・民族）

#### 3Dリアル（画像生成）

**特徴:**
- Ready Player Me Photo Capture APIを利用
- ユーザーの顔写真から3Dモデル生成
- 高品質なフォトリアルアバター

**用途:**
- 実際の面接官やトレーナーを再現
- 企業ブランドに合わせたカスタマイズ

**制限:**
- Pro以上のプラン
- 生成時間: 約60-120秒

---

## アバター選択UI

### 一般ユーザー向けUI

```
┌──────────────────────────────────────────────────────────────┐
│ アバター選択                                    [マイアバター] │
├──────────────────────────────────────────────────────────────┤
│ 📂 カテゴリフィルター                                         │
│ [すべて] [2Dアニメ] [3Dリアル] [マイライブラリ]              │
│                                                               │
│ 🎨 スタイルフィルター                                         │
│ [すべて] [ビジネス] [カジュアル] [フレンドリー] [フォーマル] │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ プリセットアバター                                       │  │
│ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │  │
│ │ │ 👩‍💼│ │ 👨‍💼│ │ 🧑‍🎓│ │ 👩‍🏫│ │ 🧑‍💻│ │ 👨‍⚕️│ ...         │  │
│ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘            │  │
│ │ Alex   Sarah  Ken    Lisa   Mike   Emma              │  │
│ │ [選択] [選択] [選択] [選択] [選択] [選択]              │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ カスタムアバター作成 (Pro以上)                 [+ 新規作成] │  │
│ │ ┌────┐ ┌────┐ ┌────┐                                   │  │
│ │ │ 📷 │ │ 🖼️ │ │ 🎨 │                                   │  │
│ │ └────┘ └────┘ └────┘                                   │  │
│ │ 写真撮影 画像アップロード AI生成                         │  │
│ │         2D/3D選択                                        │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ 選択中: Alex (3Dリアル・ビジネス)              [プレビュー]  │
│                                             [この設定で開始] │
└──────────────────────────────────────────────────────────────┘
```

### 選択フロー

1. **ユーザーがセッション開始前にアバター選択画面にアクセス**
2. **カテゴリとスタイルでフィルタリング**
   - カテゴリ: すべて / 2Dアニメ / 3Dリアル / マイライブラリ
   - スタイル: すべて / ビジネス / カジュアル / フレンドリー / フォーマル
3. **アバターカードをクリックしてプレビュー表示**
   - リアルタイムで3D/2Dモデルを確認
   - サンプル音声でリップシンクをテスト
   - 表情変化のデモンストレーション
4. **「この設定で開始」ボタンでセッション設定へ進む**

### プレビュー画面

```
┌──────────────────────────────────────────────┐
│ アバタープレビュー                [✕ 閉じる] │
├──────────────────────────────────────────────┤
│                                              │
│           ┌──────────────────┐               │
│           │                  │               │
│           │   3Dアバター     │               │
│           │   レンダリング   │               │
│           │   エリア         │               │
│           │                  │               │
│           └──────────────────┘               │
│                                              │
│ 名前: Alex                                   │
│ タイプ: 3Dリアル                              │
│ スタイル: ビジネス                            │
│ 説明: プロフェッショナルな男性面接官          │
│                                              │
│ [▶ サンプル音声再生]                        │
│ [😀 表情テスト: 通常/笑顔/驚き/真剣]         │
│                                              │
│ [この設定で開始]          [別のアバターを選択] │
└──────────────────────────────────────────────┘
```

### 管理者向けプリセット管理UI

組織管理者は、自組織専用のカスタムプリセットアバターを追加できます。

```
┌──────────────────────────────────────────────────────────────┐
│ 組織アバター管理 (管理者専用)                  [+ 新規追加]  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 📋 組織専用プリセットアバター                                 │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ アバター名  タイプ    スタイル  公開範囲      操作      │  │
│ ├─────────────────────────────────────────────────────────┤  │
│ │ 営業太郎    3Dリアル  ビジネス  全メンバー   [編集][削除] │  │
│ │ 受付花子    2Dアニメ  フレンドリー チームA   [編集][削除] │  │
│ │ トレーナー山田 3Dリアル フォーマル 管理者のみ [編集][削除] │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ 新規追加フォーム:                                             │
│ アバター名: [                    ]                           │
│ タイプ: [ 2Dアニメ ▼ ]                                       │
│ スタイル: [ ビジネス ▼ ]                                     │
│ モデルファイル: [ファイル選択]                                │
│ タグ: [面接, 営業, カスタマーサービス]                        │
│ 公開範囲: [ 全メンバー ▼ ]                                   │
│ 説明: [                                                  ]   │
│                                                               │
│                              [キャンセル]   [保存]          │
└──────────────────────────────────────────────────────────────┘
```

**設定可能な項目:**
- アバター名、タイプ、スタイル
- タグ（検索用）
- カテゴリ（面接、語学、カスタマーサービス等）
- 公開範囲（全メンバー、特定チーム、管理者のみ）
- アバターライブラリのバージョン管理

---

## 画像からのアバター生成パイプライン

### 生成フロー図

```
ユーザー画像アップロード
        │
        ▼
   顔検出・品質チェック (MediaPipe)
   ├── 顔が検出されない → エラー返却
   └── 品質不十分 → 再アップロード要求
        │
        ├──[2Dアニメスタイル]──────────────────────────────────┐
        │   1. 背景除去 (Remove.bg API)                       │
        │   2. アニメ変換 (AnimeGANv2)                        │
        │   3. 顔パーツマスク生成 (目/口/眉)                   │
        │   4. MediaPipe顔ランドマーク → パーツ変形           │
        │   5. リップシンク: Viseme → 口形状マッピング         │
        │                                                      │
        └──[3Dリアルスタイル]──────────────────────────────────┘
            1. Ready Player Me Photo Capture API
            2. GLB形式の3Dモデル取得
            3. ARKit 52 Blendshapesでリップシンク
            4. Three.jsでレンダリング
```

### ステップ詳細

#### 1. 画像アップロード・品質チェック

**要件:**
- **ファイル形式:** JPG, PNG, HEIC
- **ファイルサイズ:** 最大10MB
- **推奨解像度:** 512x512px以上
- **顔の向き:** 正面を向いている
- **照明:** 明るく、影が少ない

**品質チェック項目:**
```typescript
interface ImageQualityCheck {
  hasFace: boolean; // 顔が検出されたか
  faceCount: number; // 検出された顔の数（1である必要あり）
  faceSize: number; // 顔のサイズ（画像全体の20%以上）
  brightness: number; // 明るさ（30-220の範囲）
  sharpness: number; // シャープネス（ブレ検出、30以上）
  eyesOpen: boolean; // 目が開いているか
  mouthClosed: boolean; // 口が閉じているか（推奨）
}
```

**エラーメッセージ例:**
- "顔が検出されませんでした。正面を向いた明るい写真をアップロードしてください。"
- "複数の顔が検出されました。1人だけが写っている写真を選択してください。"
- "画像が暗すぎます。明るい場所で撮影した写真を使用してください。"

#### 2. 2Dアニメスタイル生成パイプライン

```typescript
// 2Dアニメアバター生成フロー
async function generate2DAnimeAvatar(imageUrl: string): Promise<AvatarAsset> {
  // Step 1: 背景除去
  const foregroundImage = await removeBackground(imageUrl);

  // Step 2: AnimeGANv2でスタイル変換
  const animeStyleImage = await animeGANConvert(foregroundImage, {
    style: 'paprika', // shinkai / paprika / hayao
    faceEnhance: true
  });

  // Step 3: 顔パーツマスク生成
  const faceParts = await extractFaceParts(animeStyleImage, {
    parts: ['eyes', 'mouth', 'eyebrows', 'nose']
  });

  // Step 4: Live2Dパラメータマッピング
  const live2dParams = mapToLive2DParams(faceParts);

  // Step 5: モデルファイル生成
  const modelFile = await generateLive2DModel({
    baseImage: animeStyleImage,
    parts: faceParts,
    params: live2dParams
  });

  // S3にアップロード
  const assetUrl = await uploadToS3(modelFile, {
    bucket: 'prance-avatars',
    path: `custom/2d/${userId}/${avatarId}/`
  });

  return {
    type: '2d_anime_custom',
    assetUrl,
    thumbnailUrl: await generateThumbnail(assetUrl),
    metadata: {
      generationTime: Date.now(),
      style: 'anime',
      faceParts
    }
  };
}
```

#### 3. 3Dリアルスタイル生成パイプライン

```typescript
// 3Dリアルアバター生成フロー
async function generate3DRealisticAvatar(imageUrl: string): Promise<AvatarAsset> {
  // Ready Player Me Photo Capture API呼び出し
  const rpmResponse = await fetch('https://api.readyplayer.me/v2/avatars', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RPM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image: imageUrl,
      bodyType: 'halfbody', // fullbody / halfbody
      gender: 'auto', // 自動検出
      useHands: false
    })
  });

  const { avatarUrl } = await rpmResponse.json();

  // GLBモデルをダウンロード
  const glbModel = await downloadGLBModel(avatarUrl);

  // S3にアップロード
  const assetUrl = await uploadToS3(glbModel, {
    bucket: 'prance-avatars',
    path: `custom/3d/${userId}/${avatarId}/model.glb`
  });

  return {
    type: '3d_realistic_custom',
    assetUrl,
    thumbnailUrl: await generateThumbnail(glbModel),
    metadata: {
      generationTime: Date.now(),
      format: 'glb',
      blendshapes: 'arkit52'
    }
  };
}
```

### 生成時のUI表示

```
┌──────────────────────────────────────────────┐
│ アバター生成中...                            │
├──────────────────────────────────────────────┤
│                                              │
│           [⏳ 処理中のスピナー]               │
│                                              │
│ ステップ 2/5: スタイル変換中                  │
│                                              │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░ 60%                │
│                                              │
│ 推定残り時間: 約30秒                          │
│                                              │
│ ヒント: 高品質なアバターを生成するため、      │
│ 正面を向いた明るい写真を使用することを        │
│ おすすめします。                              │
│                                              │
│                         [キャンセル]         │
└──────────────────────────────────────────────┘
```

---

## リップシンク実装

リップシンクは、音声とアバターの口の動きを同期させる技術です。TTS（Text-to-Speech）で生成された音声データに基づいて、リアルタイムでアバターの口形状を制御します。

### 実装アプローチ

#### 2Dアバターのリップシンク

**方式:** Visemeベースの口形状マッピング

```typescript
// Viseme（口の形）の定義
const visemeShapes = {
  'sil': { mouthOpenY: 0.0 },    // 無音
  'PP': { mouthOpenY: 0.0 },      // p, b, m
  'FF': { mouthOpenY: 0.1 },      // f, v
  'TH': { mouthOpenY: 0.2 },      // th
  'DD': { mouthOpenY: 0.3 },      // t, d
  'kk': { mouthOpenY: 0.2 },      // k, g
  'CH': { mouthOpenY: 0.3 },      // ch, j, sh
  'SS': { mouthOpenY: 0.2 },      // s, z
  'nn': { mouthOpenY: 0.3 },      // n, l
  'RR': { mouthOpenY: 0.2 },      // r
  'aa': { mouthOpenY: 0.6 },      // a (father)
  'E': { mouthOpenY: 0.4 },       // e (bed)
  'I': { mouthOpenY: 0.3 },       // i (seat)
  'O': { mouthOpenY: 0.5 },       // o (boat)
  'U': { mouthOpenY: 0.3 }        // u (boot)
};

// ElevenLabs APIからのAlignment data
interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

// リップシンクコントローラー
class LipSyncController {
  private currentViseme: string = 'sil';
  private audioContext: AudioContext;
  private startTime: number = 0;

  async syncLipsWithAudio(
    audioUrl: string,
    alignment: AlignmentData,
    avatar: Live2DAvatar
  ): Promise<void> {
    // 音声再生開始
    const audio = new Audio(audioUrl);
    this.startTime = Date.now();
    audio.play();

    // Alignment dataから各文字のタイミングでVisemeを更新
    for (let i = 0; i < alignment.characters.length; i++) {
      const char = alignment.characters[i];
      const startTime = alignment.character_start_times_seconds[i] * 1000;

      // 該当文字のVisemeを取得
      const viseme = this.getVisemeFromChar(char);

      // タイミングに合わせてパラメータ更新
      setTimeout(() => {
        this.updateAvatarMouth(avatar, viseme);
      }, startTime);
    }
  }

  private getVisemeFromChar(char: string): string {
    // 文字からVisemeへのマッピング（簡易版）
    const visemeMap: Record<string, string> = {
      'a': 'aa', 'e': 'E', 'i': 'I', 'o': 'O', 'u': 'U',
      'p': 'PP', 'b': 'PP', 'm': 'PP',
      'f': 'FF', 'v': 'FF',
      // ... その他のマッピング
    };
    return visemeMap[char.toLowerCase()] || 'sil';
  }

  private updateAvatarMouth(avatar: Live2DAvatar, viseme: string): void {
    const shape = visemeShapes[viseme];
    avatar.setParameter('ParamMouthOpenY', shape.mouthOpenY);
    // スムーズな遷移のためイージング適用
    avatar.update(0.016); // 60fps
  }
}
```

#### 3Dアバターのリップシンク

**方式:** ARKit 52 Blendshapesを使用

```typescript
// ARKit Blendshapesの主要パラメータ
interface ARKitBlendshapes {
  jawOpen: number;           // 顎の開き (0.0 - 1.0)
  mouthClose: number;        // 口を閉じる
  mouthFunnel: number;       // 口をすぼめる (o, u)
  mouthPucker: number;       // 口を突き出す
  mouthSmileLeft: number;    // 左口角を上げる
  mouthSmileRight: number;   // 右口角を上げる
  mouthLeft: number;         // 口を左に
  mouthRight: number;        // 口を右に
  // ... 52種類のパラメータ
}

// 3Dアバター用リップシンク
class LipSync3DController {
  private mixer: THREE.AnimationMixer;
  private blendshapeMesh: THREE.Mesh;

  async syncLipsWithAudio(
    audioUrl: string,
    alignment: AlignmentData,
    avatar: THREE.Scene
  ): Promise<void> {
    // BlendShape meshを取得
    this.blendshapeMesh = avatar.getObjectByName('Wolf3D_Head') as THREE.Mesh;

    // 音声再生
    const audio = new Audio(audioUrl);
    const startTime = Date.now();
    audio.play();

    // Alignmentデータから各タイミングでBlendshapesを更新
    for (let i = 0; i < alignment.characters.length; i++) {
      const char = alignment.characters[i];
      const startTime = alignment.character_start_times_seconds[i] * 1000;
      const endTime = alignment.character_end_times_seconds[i] * 1000;

      const blendshapes = this.getBlendshapesFromChar(char);

      setTimeout(() => {
        this.applyBlendshapes(blendshapes);
      }, startTime);

      // 次の音素への遷移
      setTimeout(() => {
        this.smoothTransition();
      }, endTime);
    }
  }

  private getBlendshapesFromChar(char: string): Partial<ARKitBlendshapes> {
    // 文字からBlendshapes値へのマッピング
    const blendshapeMap: Record<string, Partial<ARKitBlendshapes>> = {
      'a': { jawOpen: 0.6, mouthClose: 0.0 },
      'e': { jawOpen: 0.4, mouthSmileLeft: 0.3, mouthSmileRight: 0.3 },
      'i': { jawOpen: 0.3, mouthSmileLeft: 0.5, mouthSmileRight: 0.5 },
      'o': { jawOpen: 0.5, mouthFunnel: 0.6 },
      'u': { jawOpen: 0.3, mouthFunnel: 0.7, mouthPucker: 0.5 },
      // ... その他のマッピング
    };
    return blendshapeMap[char.toLowerCase()] || { jawOpen: 0.0 };
  }

  private applyBlendshapes(shapes: Partial<ARKitBlendshapes>): void {
    const morphTargets = this.blendshapeMesh.morphTargetInfluences;
    const dict = this.blendshapeMesh.morphTargetDictionary;

    Object.entries(shapes).forEach(([key, value]) => {
      const index = dict[key];
      if (index !== undefined) {
        morphTargets[index] = value;
      }
    });
  }

  private smoothTransition(): void {
    // 次の音素への滑らかな遷移（イージング）
    // GSAP等のライブラリを使用
  }
}
```

### ElevenLabs APIのAlignment data活用

ElevenLabs `/v1/text-to-speech` APIレスポンスには、音声とテキストの同期情報が含まれています。

```typescript
// ElevenLabs APIレスポンス例
interface ElevenLabsResponse {
  audio_base64: string; // MP3音声データ（Base64エンコード）
  alignment: {
    characters: ['H', 'e', 'l', 'l', 'o'],
    character_start_times_seconds: [0.0, 0.1, 0.2, 0.3, 0.4],
    character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5]
  };
  normalized_alignment: {
    characters: ['H', 'e', 'l', 'l', 'o'],
    character_start_times_seconds: [0.0, 0.1, 0.2, 0.3, 0.4],
    character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5]
  };
}

// Alignment dataを使ったリップシンク
async function performLipSync(
  text: string,
  voiceId: string,
  avatar: Avatar
): Promise<void> {
  // ElevenLabs APIコール
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/{voice_id}', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });

  const data: ElevenLabsResponse = await response.json();

  // 音声データをデコード
  const audioBlob = base64ToBlob(data.audio_base64, 'audio/mpeg');
  const audioUrl = URL.createObjectURL(audioBlob);

  // リップシンク実行
  const lipSyncController = avatar.type === '2d'
    ? new LipSyncController()
    : new LipSync3DController();

  await lipSyncController.syncLipsWithAudio(
    audioUrl,
    data.alignment,
    avatar
  );
}
```

---

## 表情システム

AIの感情状態や会話の文脈に応じて、アバターの表情を動的に変化させます。

### 感情状態と表情のマッピング

```typescript
// 感情状態の定義
type EmotionState =
  | 'neutral'      // 通常
  | 'happy'        // 嬉しい
  | 'confused'     // 困惑
  | 'serious'      // 真剣
  | 'surprised'    // 驚き
  | 'concerned'    // 心配
  | 'thinking';    // 考え中

// 感情状態からアバターパラメータへのマッピング
const emotionToExpression: Record<EmotionState, AvatarParams> = {
  neutral: {
    mouthSmile: 0.0,
    eyeWide: 0.0,
    browRaise: 0.0,
    headTilt: 0.0
  },
  happy: {
    mouthSmile: 0.8,
    eyeWide: 0.3,
    browRaise: 0.1,
    headTilt: 2.0
  },
  confused: {
    mouthSmile: 0.0,
    eyeWide: 0.2,
    browRaise: 0.5,
    headTilt: -3.0
  },
  serious: {
    mouthSmile: 0.0,
    eyeWide: 0.0,
    browRaise: -0.3,
    headTilt: 0.0
  },
  surprised: {
    mouthSmile: 0.2,
    eyeWide: 0.9,
    browRaise: 0.8,
    headTilt: 0.0
  },
  concerned: {
    mouthSmile: -0.2,
    eyeWide: 0.1,
    browRaise: -0.4,
    headTilt: -2.0
  },
  thinking: {
    mouthSmile: 0.0,
    eyeWide: 0.0,
    browRaise: 0.2,
    headTilt: 5.0 // 少し上を向く
  }
};

// 表情パラメータの型定義
interface AvatarParams {
  mouthSmile: number;    // -1.0 (下がる) ~ 1.0 (上がる)
  eyeWide: number;       // 0.0 (通常) ~ 1.0 (見開く)
  browRaise: number;     // -1.0 (下がる) ~ 1.0 (上がる)
  headTilt: number;      // 度数 (-30 ~ 30)
}
```

### 表情コントローラー

```typescript
class ExpressionController {
  private currentEmotion: EmotionState = 'neutral';
  private isTransitioning: boolean = false;

  /**
   * 感情状態に基づいて表情を変更
   */
  async setEmotion(
    emotion: EmotionState,
    avatar: Avatar,
    transitionDuration: number = 0.5
  ): Promise<void> {
    if (this.isTransitioning) return;

    this.isTransitioning = true;
    this.currentEmotion = emotion;

    const targetParams = emotionToExpression[emotion];

    // スムーズな遷移（GSAP使用）
    await this.animateToParams(avatar, targetParams, transitionDuration);

    this.isTransitioning = false;
  }

  /**
   * AIの発話内容から感情を推定
   */
  inferEmotionFromText(text: string, context: ConversationContext): EmotionState {
    // センチメント分析
    const sentiment = this.analyzeSentiment(text);

    // 文脈を考慮
    if (context.isQuestion && !context.hasAnswer) {
      return 'confused';
    }

    if (sentiment > 0.5) return 'happy';
    if (sentiment < -0.5) return 'concerned';
    if (text.includes('?') || text.includes('？')) return 'thinking';

    return 'neutral';
  }

  /**
   * まばたきの自動制御
   */
  startBlinking(avatar: Avatar): void {
    setInterval(() => {
      this.blink(avatar);
    }, 3000 + Math.random() * 2000); // 3-5秒ごと
  }

  private async blink(avatar: Avatar): Promise<void> {
    // 目を閉じる
    avatar.setParameter('ParamEyeLOpen', 0.0);
    avatar.setParameter('ParamEyeROpen', 0.0);

    await this.sleep(150); // 150ms閉じる

    // 目を開ける
    avatar.setParameter('ParamEyeLOpen', 1.0);
    avatar.setParameter('ParamEyeROpen', 1.0);
  }

  /**
   * 自然な動きの追加（アイドルモーション）
   */
  startIdleMotion(avatar: Avatar): void {
    // 微細な動き（呼吸、わずかな頭の動き）を追加
    setInterval(() => {
      const breathe = Math.sin(Date.now() / 2000) * 0.02;
      avatar.setParameter('ParamBodyAngleY', breathe);
    }, 16); // 60fps
  }

  private animateToParams(
    avatar: Avatar,
    params: AvatarParams,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      // GSAPでスムーズなアニメーション
      gsap.to(avatar.currentParams, {
        ...params,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => {
          avatar.applyParams(avatar.currentParams);
        },
        onComplete: resolve
      });
    });
  }

  private analyzeSentiment(text: string): number {
    // 簡易的なセンチメント分析
    // 実際にはAWS Comprehendや専用ライブラリを使用
    const positiveWords = ['good', 'great', 'excellent', 'wonderful', 'いい', 'すばらしい'];
    const negativeWords = ['bad', 'poor', 'terrible', 'wrong', '悪い', 'ダメ'];

    let score = 0;
    positiveWords.forEach(word => {
      if (text.toLowerCase().includes(word)) score += 0.3;
    });
    negativeWords.forEach(word => {
      if (text.toLowerCase().includes(word)) score -= 0.3;
    });

    return Math.max(-1, Math.min(1, score));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 使用例

```typescript
// セッション中の表情制御
const expressionController = new ExpressionController();
const avatar = await loadAvatar('3d_realistic', 'avatar_id_123');

// まばたきとアイドルモーション開始
expressionController.startBlinking(avatar);
expressionController.startIdleMotion(avatar);

// AIの発話ごとに表情を変更
async function onAISpeech(text: string, context: ConversationContext) {
  // 感情を推定
  const emotion = expressionController.inferEmotionFromText(text, context);

  // 表情を変更
  await expressionController.setEmotion(emotion, avatar);

  // TTSで音声生成
  const audioData = await generateSpeech(text);

  // リップシンク実行
  await performLipSync(text, voiceId, avatar);
}
```

---

## データ構造

### Avatarsテーブル

```typescript
interface Avatar {
  id: string; // UUID
  organizationId: string; // 組織ID
  userId?: string; // 作成者ID（カスタムアバターの場合）
  name: string; // アバター名
  type: AvatarType; // アバタータイプ
  style: AvatarStyle; // スタイル
  visibility: 'public' | 'organization' | 'private'; // 公開範囲

  // アセット情報
  assetUrl: string; // モデルファイルのURL (S3)
  thumbnailUrl: string; // サムネイル画像URL

  // メタデータ
  description?: string;
  tags: string[];
  category?: string; // 'interview', 'language', 'customer_service'

  // 技術情報
  metadata: AvatarMetadata;

  // タイムスタンプ
  createdAt: Date;
  updatedAt: Date;
}

type AvatarType =
  | '2d_anime_preset'
  | '2d_anime_custom'
  | '3d_realistic_preset'
  | '3d_realistic_custom';

type AvatarStyle =
  | 'business'
  | 'casual'
  | 'friendly'
  | 'formal';

interface AvatarMetadata {
  format: 'live2d' | 'glb'; // ファイル形式
  version: string; // モデルバージョン

  // 2D専用
  live2dVersion?: string; // Live2D Cubismバージョン
  parameterCount?: number; // パラメータ数

  // 3D専用
  polygonCount?: number; // ポリゴン数
  textureResolution?: string; // テクスチャ解像度
  blendshapeType?: 'arkit52' | 'custom'; // Blendshapeタイプ

  // 生成情報（カスタムアバターの場合）
  sourceImageUrl?: string; // 元画像URL
  generationTime?: number; // 生成時間（秒）
  generationProvider?: string; // 'anime_gan' | 'ready_player_me'
}
```

### Prismaスキーマ

```prisma
model Avatar {
  id             String   @id @default(uuid())
  organizationId String
  userId         String?
  name           String
  type           AvatarType
  style          AvatarStyle
  visibility     AvatarVisibility

  assetUrl       String
  thumbnailUrl   String

  description    String?
  tags           String[]
  category       String?

  metadata       Json

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  organization   Organization @relation(fields: [organizationId], references: [id])
  user           User?        @relation(fields: [userId], references: [id])
  sessions       Session[]

  @@index([organizationId])
  @@index([userId])
  @@index([type, style])
  @@index([visibility])
  @@map("avatars")
}

enum AvatarType {
  TWO_D_ANIME_PRESET
  TWO_D_ANIME_CUSTOM
  THREE_D_REALISTIC_PRESET
  THREE_D_REALISTIC_CUSTOM
}

enum AvatarStyle {
  BUSINESS
  CASUAL
  FRIENDLY
  FORMAL
}

enum AvatarVisibility {
  PUBLIC
  ORGANIZATION
  PRIVATE
}
```

---

## API仕様

### GET /api/v1/avatars

プリセットアバター一覧を取得

**Query Parameters:**
```typescript
{
  type?: AvatarType; // フィルター: タイプ
  style?: AvatarStyle; // フィルター: スタイル
  category?: string; // フィルター: カテゴリ
  visibility?: 'public' | 'organization' | 'private';
  page?: number; // ページ番号
  limit?: number; // 1ページあたりの件数
}
```

**Response:**
```typescript
{
  avatars: Avatar[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### POST /api/v1/avatars/generate

カスタムアバター生成

**Request Body:**
```typescript
{
  imageUrl: string; // アップロードした画像のURL
  type: '2d_anime_custom' | '3d_realistic_custom';
  name: string;
  style: AvatarStyle;
  visibility: 'organization' | 'private';
}
```

**Response:**
```typescript
{
  jobId: string; // 生成ジョブID
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimatedTime: number; // 推定生成時間（秒）
}
```

### GET /api/v1/avatars/generate/:jobId

生成ジョブのステータス確認

**Response:**
```typescript
{
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  avatar?: Avatar; // 完了時のみ
  error?: string; // 失敗時のみ
}
```

### GET /api/v1/avatars/:id

特定アバターの詳細取得

**Response:**
```typescript
{
  avatar: Avatar;
}
```

### DELETE /api/v1/avatars/:id

カスタムアバターの削除

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

## 実装ガイド

### フロントエンド実装

#### 1. アバター選択コンポーネント

```typescript
// components/avatar/AvatarSelector.tsx
import { useState, useEffect } from 'react';
import { Avatar, AvatarType, AvatarStyle } from '@/types';

export function AvatarSelector({
  onSelect,
}: {
  onSelect: (avatar: Avatar) => void;
}) {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [filters, setFilters] = useState({
    type: 'all' as AvatarType | 'all',
    style: 'all' as AvatarStyle | 'all',
  });
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);

  useEffect(() => {
    fetchAvatars();
  }, [filters]);

  async function fetchAvatars() {
    const response = await fetch('/api/v1/avatars?' + new URLSearchParams({
      ...(filters.type !== 'all' && { type: filters.type }),
      ...(filters.style !== 'all' && { style: filters.style }),
    }));
    const data = await response.json();
    setAvatars(data.avatars);
  }

  function handleSelect(avatar: Avatar) {
    setSelectedAvatar(avatar);
    onSelect(avatar);
  }

  return (
    <div className="avatar-selector">
      {/* フィルター */}
      <div className="filters">
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
        >
          <option value="all">すべて</option>
          <option value="2d_anime_preset">2Dアニメ</option>
          <option value="3d_realistic_preset">3Dリアル</option>
        </select>

        <select
          value={filters.style}
          onChange={(e) => setFilters({ ...filters, style: e.target.value as any })}
        >
          <option value="all">すべて</option>
          <option value="business">ビジネス</option>
          <option value="casual">カジュアル</option>
          <option value="friendly">フレンドリー</option>
          <option value="formal">フォーマル</option>
        </select>
      </div>

      {/* アバターグリッド */}
      <div className="avatar-grid">
        {avatars.map((avatar) => (
          <AvatarCard
            key={avatar.id}
            avatar={avatar}
            isSelected={selectedAvatar?.id === avatar.id}
            onSelect={() => handleSelect(avatar)}
          />
        ))}
      </div>

      {/* プレビュー */}
      {selectedAvatar && (
        <AvatarPreview avatar={selectedAvatar} />
      )}
    </div>
  );
}
```

#### 2. アバタープレビューコンポーネント

```typescript
// components/avatar/AvatarPreview.tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export function AvatarPreview({ avatar }: { avatar: Avatar }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Three.jsシーン初期化
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current });

    renderer.setSize(400, 400);
    camera.position.z = 2;

    // ライト追加
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 1, 1);
    scene.add(light);

    // アバターモデル読み込み
    if (avatar.type.includes('3d')) {
      loadGLBModel(avatar.assetUrl, scene);
    } else {
      loadLive2DModel(avatar.assetUrl, scene);
    }

    // アニメーションループ
    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    sceneRef.current = scene;

    return () => {
      // クリーンアップ
      renderer.dispose();
    };
  }, [avatar]);

  async function loadGLBModel(url: string, scene: THREE.Scene) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    scene.add(gltf.scene);
  }

  async function loadLive2DModel(url: string, scene: THREE.Scene) {
    // Live2D読み込み実装
    // ...
  }

  async function playSampleAudio() {
    // サンプル音声でリップシンクテスト
    const audio = new Audio('/assets/sample-speech.mp3');
    audio.play();
    // リップシンク実行
  }

  return (
    <div className="avatar-preview">
      <h3>プレビュー</h3>
      <canvas ref={canvasRef} />
      <div className="preview-controls">
        <button onClick={playSampleAudio}>サンプル音声再生</button>
        <button>表情テスト</button>
      </div>
      <div className="avatar-info">
        <p><strong>名前:</strong> {avatar.name}</p>
        <p><strong>タイプ:</strong> {avatar.type}</p>
        <p><strong>スタイル:</strong> {avatar.style}</p>
      </div>
    </div>
  );
}
```

### バックエンド実装

#### Lambda関数: アバター生成

```typescript
// lambda/avatars/generate/index.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { StepFunctions } from 'aws-sdk';
import { generateAvatarSchema } from './validation';

const stepfunctions = new StepFunctions();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // リクエストボディ検証
    const body = JSON.parse(event.body || '{}');
    const validatedBody = generateAvatarSchema.parse(body);

    // Step Functionsでアバター生成ワークフロー開始
    const execution = await stepfunctions.startExecution({
      stateMachineArn: process.env.AVATAR_GENERATION_STATE_MACHINE_ARN!,
      input: JSON.stringify({
        userId: event.requestContext.authorizer?.userId,
        organizationId: event.requestContext.authorizer?.organizationId,
        ...validatedBody,
      }),
    }).promise();

    return {
      statusCode: 202,
      body: JSON.stringify({
        jobId: execution.executionArn.split(':').pop(),
        status: 'queued',
        estimatedTime: validatedBody.type === '2d_anime_custom' ? 45 : 90,
      }),
    };
  } catch (error) {
    console.error('Avatar generation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
```

#### Step Functions: アバター生成ワークフロー

```json
{
  "Comment": "Avatar Generation Workflow",
  "StartAt": "ValidateImage",
  "States": {
    "ValidateImage": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:xxx:function:avatar-validate-image",
      "Next": "CheckAvatarType"
    },
    "CheckAvatarType": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.type",
          "StringEquals": "2d_anime_custom",
          "Next": "Generate2DAnime"
        },
        {
          "Variable": "$.type",
          "StringEquals": "3d_realistic_custom",
          "Next": "Generate3DRealistic"
        }
      ]
    },
    "Generate2DAnime": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:xxx:function:avatar-generate-2d",
      "Next": "SaveToDatabase"
    },
    "Generate3DRealistic": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:xxx:function:avatar-generate-3d",
      "Next": "SaveToDatabase"
    },
    "SaveToDatabase": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:xxx:function:avatar-save",
      "End": true
    }
  }
}
```

---

## セキュリティとパフォーマンス

### セキュリティ対策

1. **画像アップロード検証**
   - ファイル形式検証（MIME type + マジックナンバー）
   - ファイルサイズ制限（最大10MB）
   - ウイルススキャン（ClamAV on Lambda）

2. **アクセス制御**
   - プリセットアバター: 公開
   - カスタムアバター: 作成者または組織メンバーのみ
   - S3バケット: プライベート、CloudFront署名付きURL

3. **レート制限**
   - カスタムアバター生成: 1時間に3回まで（Proプラン）
   - APIコール: 100リクエスト/分

### パフォーマンス最適化

1. **モデルファイルサイズ削減**
   - GLBモデル: Draco圧縮適用
   - テクスチャ: WebP形式、適切な解像度

2. **CDN活用**
   - CloudFrontでアセット配信
   - エッジロケーションでキャッシュ

3. **レンダリング最適化**
   - LOD (Level of Detail) 実装
   - Frustum Culling（視野外カリング）
   - 60fps維持のためのパフォーマンス監視

---

## まとめ

アバターモジュールは、Pranceプラットフォームのユーザー体験の中核を担います。2D/3Dの多様なアバタータイプ、画像からのカスタム生成、リアルタイムリップシンク、感情に応じた表情変化により、リアルで魅力的なAI会話体験を提供します。

**次のステップ:**
- [音声モジュール](VOICE_MODULE.md) - TTS/STT、音声クローニング
- [シナリオエンジン](SCENARIO_ENGINE.md) - 会話フロー制御
- [セッション録画](SESSION_RECORDING.md) - 録画・再生機能

---

**最終更新:** 2026-03-05
**次回レビュー予定:** Phase 1 完了時
