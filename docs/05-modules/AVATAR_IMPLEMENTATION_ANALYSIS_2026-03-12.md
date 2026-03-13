# アバター機能 実装状況分析・仕様ドキュメント

**作成日:** 2026-03-12
**最終更新:** 2026-03-12 (リップシンク・表情・画像生成を追加)
**分析者:** Claude Sonnet 4.5
**ステータス:** ✅ 分析完了

---

## エグゼクティブサマリー

アバター機能の基盤（Prisma Schema, Lambda CRUD API, Frontend API）は**100%整合性が取れており、完全に実装されています**。

**コア機能要件:**
1. **リップシンク** - 音声に合わせた口の動き（リアルタイム）
2. **表情制御** - 感情に応じた表情変化（喜怒哀楽）
3. **画像生成** - アップロードした人物画像からアバター生成
4. **スタイル選択** - 実写的表現とアニメ・漫画的表現の切り替え

**Critical Gap:**
1. プリセットアバターデータがDBに存在しない（推定）
2. セッション作成時のアバター選択UIが未実装（推定）
3. 画像アップロード・生成パイプラインが未実装
4. **リップシンク機能が未実装** 🔴
5. **表情制御システムが未実装** 🔴

**推奨アクション:** Phase 1（1-2週間）でプリセットデータ作成とUI実装に集中

---

## 🎭 コア機能仕様

### 1. リップシンク（Lip Sync）

**目的:** 音声に合わせてアバターの口を自然に動かす

**技術アプローチ:**

#### Option A: ARKit準拠（3D REALISTIC向け）
```typescript
interface BlendshapeWeights {
  // 口の動き（ARKit 52 Blendshapes）
  jawOpen: number;           // 0.0-1.0 (あ)
  mouthFunnel: number;       // (う)
  mouthSmileLeft: number;    // (い)
  mouthSmileRight: number;   // (い)
  mouthPucker: number;       // (お)
  // ... 他48パラメータ
}
```

**処理フロー:**
1. ElevenLabs TTS音声生成時にフォネーム情報を取得
2. フォネーム（/a/, /i/, /u/, /e/, /o/）をBlendshape値にマッピング
3. WebSocket経由でフロントエンドに配信
4. Three.js SkinnedMeshのmorphTargetInfluencesを更新

**実装詳細:**
```typescript
// フォネーム → Blendshape マッピング
const PHONEME_TO_BLENDSHAPE: Record<string, Partial<BlendshapeWeights>> = {
  'a': { jawOpen: 0.8, mouthOpen: 0.7 },        // あ
  'i': { mouthSmileLeft: 0.6, mouthSmileRight: 0.6 }, // い
  'u': { mouthFunnel: 0.5, lipsFunnel: 0.5 },   // う
  'e': { jawOpen: 0.4, mouthSmileLeft: 0.3 },   // え
  'o': { mouthPucker: 0.6, jawOpen: 0.3 },      // お
  // 子音パターン...
};
```

#### Option B: Live2D Parameters（2D ANIME向け）
```typescript
interface Live2DParameters {
  PARAM_MOUTH_OPEN_Y: number;    // 口の開き (0.0-1.0)
  PARAM_MOUTH_FORM: number;      // 口の形 (-1.0 ~ 1.0)
  PARAM_MOUTH_SIZE: number;      // 口のサイズ
}
```

**処理フロー:**
1. 音声の振幅を分析
2. 振幅に応じてPARAM_MOUTH_OPEN_Yを制御
3. フォネーム情報からPARAM_MOUTH_FORMを制御
4. Live2D Cubism SDK for Webで描画

**リアルタイム性能:**
- 遅延: <50ms（音声との同期許容範囲）
- フレームレート: 30fps以上
- WebSocket配信頻度: 20-30回/秒

---

### 2. 表情制御（Facial Expression）

**目的:** シナリオ・感情・状況に応じてアバターの表情を変化

**表情パターン（基本6表情）:**
| 表情 | 日本語 | トリガー | Blendshape/Parameter |
|------|--------|----------|----------------------|
| Neutral | 中立 | デフォルト | 全て0 |
| Happy | 喜び | ポジティブ応答、成功 | mouthSmile: 0.7, eyeSquintLeft/Right: 0.3 |
| Sad | 悲しみ | ネガティブ応答、失敗 | mouthFrownLeft/Right: 0.6, browDownLeft/Right: 0.5 |
| Angry | 怒り | 不正解、警告 | browDownLeft/Right: 0.8, mouthFrownLeft/Right: 0.4 |
| Surprised | 驚き | 意外な回答 | eyeWideLeft/Right: 0.8, jawOpen: 0.5 |
| Thinking | 考え中 | 沈黙、AI処理中 | browDownLeft/Right: 0.3, eyeBlinkLeft/Right: 0.1 |

**トリガーシステム:**

#### A. シナリオベース（事前定義）
```typescript
interface ScenarioExpression {
  dialogueId: string;           // シナリオ対話ID
  defaultExpression: Expression; // 基本表情
  triggers: ExpressionTrigger[]; // 条件付き表情変化
}

interface ExpressionTrigger {
  condition: 'keyword' | 'sentiment' | 'silence' | 'time';
  value: string | number;
  expression: Expression;
  duration: number; // ms
}
```

**例:**
```json
{
  "dialogueId": "interview-greeting",
  "defaultExpression": "HAPPY",
  "triggers": [
    {
      "condition": "sentiment",
      "value": "negative",
      "expression": "SAD",
      "duration": 2000
    },
    {
      "condition": "silence",
      "value": 3000,
      "expression": "THINKING",
      "duration": 1000
    }
  ]
}
```

#### B. AI感情分析ベース（動的）
```typescript
// AWS Bedrock Claude応答から感情を抽出
interface AIResponseWithEmotion {
  text: string;
  emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised';
  confidence: number;
}
```

**処理フロー:**
1. AIが応答文を生成
2. 応答文から感情を推測（プロンプト設計）
3. 感情に応じた表情をWebSocket配信
4. フロントエンドで表情アニメーション実行

**アニメーション:**
- イージング: Cubic Bezier (0.4, 0.0, 0.2, 1.0)
- 遷移時間: 300-500ms
- ブレンディング: 複数表情の重み付け合成可能

---

### 3. 画像生成パイプライン（Avatar Generation）

**目的:** ユーザーがアップロードした人物画像から2D/3Dアバターを自動生成

**対応スタイル:**
- **ANIME** - アニメ・漫画的表現（2D）
- **REALISTIC** - 実写的表現（3D）

#### 3.1 ANIMEスタイル生成（2D）

**技術スタック:**
- **AnimeGANv2** - 実写→アニメ変換
- **Live2D Cubism SDK** - アニメ顔のパラメータ化
- **MediaPipe Face Mesh** - 顔パーツ検出

**処理フロー:**
```
User Upload (JPG/PNG)
  ↓
MediaPipe Face Detection (顔の存在確認)
  ↓
AnimeGANv2 Inference (実写→アニメ変換)
  ↓
Face Landmark Detection (目・鼻・口の位置)
  ↓
Live2D Model Generation (パラメータファイル生成)
  ↓
S3保存 (model.live2d.zip)
  ↓
DB登録 (Avatar record)
```

**実装詳細:**

**Lambda関数（または ECS Fargate）:**
```typescript
// infrastructure/lambda/avatar-generation/anime/index.ts
export async function generateAnimeAvatar(uploadedImageKey: string): Promise<AvatarGenerationResult> {
  // 1. S3から元画像をダウンロード
  const sourceImage = await s3.getObject({ Bucket, Key: uploadedImageKey });

  // 2. MediaPipe顔検出
  const faceDetection = await detectFace(sourceImage);
  if (!faceDetection.found) {
    throw new Error('No face detected in image');
  }

  // 3. AnimeGANv2推論（SageMaker Endpoint）
  const animeImage = await invokeAnimeGAN(sourceImage);

  // 4. Live2Dパラメータ生成
  const live2dModel = await generateLive2DModel(animeImage, faceDetection.landmarks);

  // 5. S3保存
  const modelKey = `generated/${orgId}/${avatarId}/model.live2d.zip`;
  await s3.putObject({ Bucket, Key: modelKey, Body: live2dModel });

  // 6. サムネイル生成
  const thumbnail = await generateThumbnail(animeImage);
  const thumbnailKey = `generated/${orgId}/${avatarId}/thumbnail.jpg`;
  await s3.putObject({ Bucket, Key: thumbnailKey, Body: thumbnail });

  return {
    avatarId,
    modelUrl: `https://cdn.prance.ai/${modelKey}`,
    thumbnailUrl: `https://cdn.prance.ai/${thumbnailKey}`,
    status: 'COMPLETED',
  };
}
```

**SageMaker Endpoint:**
- モデル: AnimeGANv2（PyTorch）
- インスタンス: ml.g4dn.xlarge（GPU）
- Auto Scaling: 0-5インスタンス

#### 3.2 REALISTICスタイル生成（3D）

**技術スタック:**
- **Ready Player Me API** - 写真から3Dアバター生成
- **Blender Python API** - 表情モーフターゲット追加（オプション）

**処理フロー:**
```
User Upload (JPG/PNG)
  ↓
Ready Player Me API (POST /avatars)
  ↓
Webhook待機（ジョブ完了通知）
  ↓
GLB Model Download
  ↓
ARKit Blendshapes検証
  ↓
S3保存 (model.glb)
  ↓
DB登録 (Avatar record)
```

**実装詳細:**

**Lambda関数:**
```typescript
// infrastructure/lambda/avatar-generation/realistic/index.ts
export async function generateRealisticAvatar(uploadedImageKey: string): Promise<JobStatus> {
  // 1. S3から元画像をダウンロード
  const sourceImage = await s3.getObject({ Bucket, Key: uploadedImageKey });

  // 2. Ready Player Me APIにPOST
  const rpmResponse = await fetch('https://api.readyplayer.me/v1/avatars', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RPM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: sourceImage.toString('base64'),
      bodyType: 'fullbody',
      morphTargets: ['ARKit', 'Oculus Visemes'], // リップシンク用
    }),
  });

  const { jobId } = await rpmResponse.json();

  // 3. DynamoDBにジョブステータス保存
  await dynamodb.putItem({
    TableName: 'avatar-generation-jobs',
    Item: {
      jobId,
      avatarId,
      status: 'PROCESSING',
      provider: 'READY_PLAYER_ME',
      createdAt: Date.now(),
    },
  });

  return { jobId, status: 'PROCESSING' };
}

// Webhook受信
export async function handleRPMWebhook(event: WebhookEvent): Promise<void> {
  const { jobId, status, modelUrl } = event;

  if (status === 'COMPLETED') {
    // 1. GLBモデルをダウンロード
    const glbModel = await fetch(modelUrl).then(r => r.arrayBuffer());

    // 2. S3保存
    const modelKey = `generated/${orgId}/${avatarId}/model.glb`;
    await s3.putObject({ Bucket, Key: modelKey, Body: glbModel });

    // 3. サムネイル生成（Three.js Headless Rendering）
    const thumbnail = await generateThumbnailFromGLB(glbModel);

    // 4. DB更新
    await prisma.avatar.update({
      where: { id: avatarId },
      data: {
        modelUrl: `https://cdn.prance.ai/${modelKey}`,
        thumbnailUrl: `https://cdn.prance.ai/${thumbnailKey}`,
        configJson: {
          morphTargets: ['ARKit', 'Oculus'],
          provider: 'RPM',
        },
      },
    });

    // 5. WebSocket通知（フロントエンドに完了通知）
    await iotData.publish({
      topic: `avatars/${orgId}/${avatarId}/status`,
      payload: JSON.stringify({ status: 'COMPLETED' }),
    });
  }
}
```

**Ready Player Me API制限:**
- 無料プラン: 10 avatars/月
- Pro: 1000 avatars/月（$99/月）
- Enterprise: カスタム

**代替手段（コスト削減）:**
- Blenderスクリプト + MediaPipe
- PIFuHD（オープンソース3D再構成）

---

### 4. スタイル選択（Character Style）

**UI設計:**

```
┌─────────────────────────────────────────────┐
│ アバタータイプを選択                          │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐    ┌──────────────┐      │
│  │   🎨 ANIME   │    │  👤 REALISTIC │      │
│  │              │    │              │      │
│  │ アニメ・漫画  │    │   実写的      │      │
│  │  キャラクター │    │  キャラクター  │      │
│  │              │    │              │      │
│  │   [選択]     │    │   [選択]     │      │
│  └──────────────┘    └──────────────┘      │
│                                             │
├─────────────────────────────────────────────┤
│ オプション:                                  │
│ ☐ プリセットから選択                         │
│ ☐ 画像をアップロードして生成 (Pro)           │
└─────────────────────────────────────────────┘
```

**選択フロー:**
1. **スタイル選択** → ANIME or REALISTIC
2. **ソース選択**:
   - PRESET: 既存のプリセットギャラリーから選択
   - GENERATED: 画像アップロード → 生成（Pro以上）
   - ORG_CUSTOM: 組織カスタムアバター
3. **プレビュー** → リップシンク・表情のデモ再生
4. **確定** → アバター選択完了

**実装:**
```typescript
// apps/web/components/avatar-selector/index.tsx
export function AvatarSelector({ onSelect }: AvatarSelectorProps) {
  const [style, setStyle] = useState<'ANIME' | 'REALISTIC'>('ANIME');
  const [source, setSource] = useState<'PRESET' | 'GENERATED'>('PRESET');

  const { data: avatars } = useQuery({
    queryKey: ['avatars', { style, source: 'PRESET' }],
    queryFn: () => listAvatars({ style, source: 'PRESET' }),
  });

  return (
    <div>
      <StyleSelector value={style} onChange={setStyle} />
      <SourceSelector value={source} onChange={setSource} />

      {source === 'PRESET' && (
        <PresetGallery avatars={avatars} onSelect={onSelect} />
      )}

      {source === 'GENERATED' && (
        <ImageUploadForm style={style} onGenerated={onSelect} />
      )}
    </div>
  );
}
```

---

## 📊 現状実装の概要

### 実装済みコンポーネント ✅

| コンポーネント | ステータス | 場所 | 整合性 |
|---------------|----------|------|--------|
| **Prisma Schema** | ✅ 完了 | `packages/database/prisma/schema.prisma` | 100% |
| **Lambda CRUD API** | ✅ 完了 | `infrastructure/lambda/avatars/` | 100% |
| **フロントエンドAPI** | ✅ 完了 | `apps/web/lib/api/avatars.ts` | 100% |
| **ダッシュボードUI** | ✅ 存在 | `apps/web/app/dashboard/avatars/` | - |
| **型定義（Enum）** | ✅ 完了 | `@prance/shared` | 100% |

**結論:** **アーキテクチャ設計と基盤実装は完璧です。不足しているのはコア機能（リップシンク・表情・画像生成）とデータ・UIです。**

### 未実装コンポーネント ❌

| コンポーネント | ステータス | 優先度 | 工数見積 |
|---------------|----------|--------|----------|
| **リップシンク機能** | ❌ 未実装 | 🔴 Critical | 5-7日 |
| **表情制御システム** | ❌ 未実装 | 🔴 Critical | 3-5日 |
| **プリセットアバターデータ** | ❌ 未確認 | 🔴 Critical | 3日 |
| **セッション作成時のアバター選択UI** | ❌ 未確認 | 🔴 Critical | 2日 |
| **S3アップロード・サムネイル生成** | ❌ 未実装 | 🔴 Critical | 3日 |
| **画像生成パイプライン（ANIME）** | ❌ 未実装 | 🟠 High | 10-12日 |
| **画像生成パイプライン（REALISTIC）** | ❌ 未実装 | 🟠 High | 5-7日 |
| **Live2D レンダリングエンジン** | ❌ 未実装 | 🟠 High | 7-10日 |
| **Three.js + GLB レンダリング** | ❌ 未実装 | 🟠 High | 5-7日 |

---

## 🔍 詳細分析

### 1. Prisma Schema分析

```prisma
model Avatar {
  id           String       @id @default(uuid())
  userId       String?      @map("user_id")
  orgId        String       @map("org_id")
  name         String
  type         AvatarType   // TWO_D | THREE_D
  style        AvatarStyle  // ANIME | REALISTIC
  source       AvatarSource // PRESET | GENERATED | ORG_CUSTOM
  modelUrl     String       @map("model_url")
  thumbnailUrl String?      @map("thumbnail_url")
  configJson   Json?        @map("config_json")
  tags         String[]     @default([])
  visibility   Visibility   @default(PRIVATE)
  allowCloning Boolean      @default(false) @map("allow_cloning")
  createdAt    DateTime     @default(now()) @map("created_at")
}
```

**設計評価: ⭐⭐⭐⭐⭐ (5/5)**

✅ **優れている点:**
- マルチテナント対応（orgId）
- 細かい権限制御（visibility, allowCloning）
- 柔軟な拡張性（configJson, tags[]）
- 適切なEnum定義

❓ **要検討事項:**
- `modelUrl` / `thumbnailUrl` のS3パス命名規則が文書化されていない
- `configJson` の標準構造が定義されていない → 型安全性の欠如

### 2. Lambda API実装分析

#### GET /avatars (LIST)

**実装状況:** ✅ 完了

```typescript
// フィルタリングパラメータ
- limit: number (default: 20, max: 100)
- offset: number (default: 0)
- type: AvatarType
- style: AvatarStyle
- source: AvatarSource
- visibility: Visibility
```

**権限制御:** ✅ 正しく実装
- 自組織のアバター（PRIVATE/ORGANIZATION）
- PUBLIC設定されたアバター（全テナント共通）

**欠落機能:**
- ❌ `search` パラメータ（name, tags検索）
- ❌ ソート順指定（人気順、作成日順）
- ❌ プリセット優先表示

#### POST /avatars (CREATE)

**実装状況:** ✅ 基本機能完了

**バリデーション:** ✅ 完璧
- 必須フィールドチェック
- Enum値検証
- 型チェック

**欠落機能:**
- ❌ S3 pre-signed URL生成（画像アップロード用）
- ❌ サムネイル自動生成
- ❌ 画像生成パイプライン統合（GENERATED source）
- ❌ プラン制限チェック（Pro以上のみGENERATED可能）

#### GET /avatars/{id} (GET)

**実装状況:** ✅ 完了

**欠落機能:**
- ❌ `modelUrl` の署名付きURL変換（セキュリティ強化）
- ❌ 使用統計（このアバターを使用したセッション数）

#### PUT /avatars/{id} (UPDATE)

**実装状況:** ✅ 完了

**欠落機能:**
- ❌ `modelUrl` 変更時の旧ファイル削除（S3クリーンアップ）
- ❌ サムネイル再生成

#### DELETE /avatars/{id} (DELETE)

**実装状況:** ✅ 完了

**追加すべきチェック:**
- ❌ 使用中のセッションが存在する場合は削除拒否
- ❌ S3ファイルの自動削除

#### POST /avatars/{id}/clone (CLONE)

**実装状況:** ✅ 完了

**動作:** PUBLIC + allowCloning=true のアバターを自組織にコピー

### 3. フロントエンドAPI分析

**ファイル:** `apps/web/lib/api/avatars.ts`

**実装状況:** ✅ 100%完了

```typescript
export async function listAvatars(params?: FilterParams): Promise<AvatarListResponse>
export async function createAvatar(data: CreateAvatarRequest): Promise<Avatar>
export async function getAvatar(id: string): Promise<Avatar>
export async function updateAvatar(id: string, data: UpdateAvatarRequest): Promise<Avatar>
export async function deleteAvatar(id: string): Promise<void>
export async function cloneAvatar(id: string): Promise<Avatar>
```

**型定義:** ✅ 完全に型安全

**問題点:** なし

### 4. フロントエンドUI分析

**存在するページ:**
- `/dashboard/avatars` - 一覧ページ
- `/dashboard/avatars/new` - 新規作成ページ
- `/dashboard/avatars/[id]/edit` - 編集ページ

**要確認事項:**
- ❓ セッション作成時のアバター選択UI
- ❓ プリセットギャラリー表示
- ❓ プレビュー機能
- ❓ 画像アップロードUI

---

## ✅ 整合性チェック結果

### Prisma Schema vs Lambda API

**結果:** ✅ 100%一致

全13フィールドがPrisma定義、Lambda CREATE、Lambda LISTで完全に一致。

### Lambda API vs Frontend API

**結果:** ✅ 100%一致

全6エンドポイントがLambda実装、フロントエンド関数で完全に一致。

### 型定義の整合性

**結果:** ✅ 100%一致

```typescript
// @prance/shared
AvatarType = 'TWO_D' | 'THREE_D'
AvatarStyle = 'ANIME' | 'REALISTIC'
AvatarSource = 'PRESET' | 'GENERATED' | 'ORG_CUSTOM'
Visibility = 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC'

// Prisma Enum
enum AvatarType { TWO_D THREE_D }
enum AvatarStyle { ANIME REALISTIC }
enum AvatarSource { PRESET GENERATED ORG_CUSTOM }
enum Visibility { PRIVATE ORGANIZATION PUBLIC }
```

完全一致。

---

## 📝 プリセットアバターデータ仕様

### データ構造

```typescript
interface PresetAvatarConfig {
  // 基本情報
  gender?: 'male' | 'female' | 'non-binary';
  ageRange?: 'young' | 'adult' | 'senior';
  ethnicity?: string;
  personality?: string;    // "professional", "friendly", "formal"

  // 音声設定
  voiceId: string;         // ElevenLabs voice ID

  // リップシンク設定（3D REALISTIC用）
  lipsync?: {
    type: 'ARKit' | 'Oculus' | 'Live2D';
    phonemeMapping: Record<string, BlendshapeWeights>;
    smoothingFactor: number; // 0.1-1.0（動きの滑らかさ）
  };

  // 表情設定
  expressions: {
    neutral: BlendshapeWeights;
    happy: BlendshapeWeights;
    sad: BlendshapeWeights;
    angry: BlendshapeWeights;
    surprised: BlendshapeWeights;
    thinking: BlendshapeWeights;
  };

  // Live2D固有（2D ANIME用）
  live2dParameters?: {
    lipsync: {
      PARAM_MOUTH_OPEN_Y: { min: number; max: number };
      PARAM_MOUTH_FORM: { min: number; max: number };
    };
    expressions: Record<string, Record<string, number>>;
  };
}

// ARKit Blendshapes（3D用）
interface BlendshapeWeights {
  // 口の動き
  jawOpen?: number;              // 顎の開き
  mouthFunnel?: number;          // 口をすぼめる（う）
  mouthPucker?: number;          // 口を突き出す（お）
  mouthSmileLeft?: number;       // 左口角を上げる（い）
  mouthSmileRight?: number;      // 右口角を上げる（い）
  mouthFrownLeft?: number;       // 左口角を下げる（悲）
  mouthFrownRight?: number;      // 右口角を下げる（悲）

  // 目の動き
  eyeBlinkLeft?: number;         // 左目瞬き
  eyeBlinkRight?: number;        // 右目瞬き
  eyeWideLeft?: number;          // 左目見開く（驚）
  eyeWideRight?: number;         // 右目見開く（驚）
  eyeSquintLeft?: number;        // 左目細める（笑）
  eyeSquintRight?: number;       // 右目細める（笑）

  // 眉の動き
  browDownLeft?: number;         // 左眉下げる（怒・悲）
  browDownRight?: number;        // 右眉下げる（怒・悲）
  browOuterUpLeft?: number;      // 左眉外側上げる（驚）
  browOuterUpRight?: number;     // 右眉外側上げる（驚）

  // ... 他32パラメータ（ARKit 52 Blendshapes完全サポート）
}
```

### 初期データセット

**2D ANIME (20種類)**
| カテゴリ | 性別 | 数量 | タグ例 |
|----------|------|------|--------|
| ビジネス | 男性 | 5 | business, professional, male, formal |
| ビジネス | 女性 | 5 | business, professional, female, formal |
| カジュアル | 男性 | 5 | casual, friendly, male, relaxed |
| カジュアル | 女性 | 5 | casual, friendly, female, relaxed |

**3D REALISTIC (15種類)**
| 性別 | 年齢層 | 民族 | 数量 |
|------|--------|------|------|
| 男性 | Young | アジア系 | 2 |
| 男性 | Adult | 欧米系 | 3 |
| 男性 | Senior | 多様 | 2 |
| 女性 | Young | アジア系 | 2 |
| 女性 | Adult | 欧米系 | 3 |
| 女性 | Senior | 多様 | 2 |
| ノンバイナリー | Adult | 多様 | 1 |

### S3バケット構造

```
s3://prance-avatars-{env}/
├── presets/                      # プリセット（全テナント共通）
│   ├── {avatar-id}/
│   │   ├── model.glb             # 3Dモデル (GLB形式)
│   │   ├── model.live2d.zip      # Live2Dモデル (ZIP圧縮)
│   │   └── thumbnail.jpg         # サムネイル (512x512)
│
├── generated/                    # ユーザー生成
│   ├── {org-id}/
│   │   └── {avatar-id}/
│   │       ├── source.jpg        # 元画像
│   │       ├── model.glb         # 生成モデル
│   │       └── thumbnail.jpg
│
└── uploads/                      # 一時アップロード
    └── {user-id}/
        └── {upload-id}.jpg       # 処理待ち画像
```

**IAMポリシー:**
- `presets/*`: パブリック読み取り（CloudFront経由）
- `generated/{org-id}/*`: 組織メンバーのみ
- `uploads/{user-id}/*`: 本人のみ

### データ投入方法

**1. S3アップロード:**
```bash
aws s3 sync ./preset-avatars/ s3://prance-avatars-dev/presets/ \
  --acl public-read \
  --cache-control "max-age=31536000"
```

**2. Prisma Seed Script:**
```typescript
// packages/database/prisma/seed-avatars.ts
import { PrismaClient } from '@prisma/client';
import avatarData from './data/preset-avatars.json';

const prisma = new PrismaClient();

async function seedAvatars() {
  console.log('Seeding preset avatars...');

  for (const avatar of avatarData) {
    await prisma.avatar.upsert({
      where: { id: avatar.id },
      update: {},
      create: {
        id: avatar.id,
        userId: null,
        orgId: SYSTEM_ORG_ID, // 全テナント共通システム組織
        name: avatar.name,
        type: avatar.type,
        style: avatar.style,
        source: 'PRESET',
        modelUrl: avatar.modelUrl,
        thumbnailUrl: avatar.thumbnailUrl,
        configJson: avatar.configJson,
        tags: avatar.tags,
        visibility: 'PUBLIC',
        allowCloning: true,
      },
    });
  }

  console.log(`✅ ${avatarData.length} avatars seeded`);
}

seedAvatars()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**3. 実行:**
```bash
npm run db:seed:avatars
```

---

## 🚀 実装計画

### Phase 1: コア機能実装（Week 1-2 - Critical）

#### Week 1: リップシンク・表情制御

**Day 1-2: リップシンクシステム（3D REALISTIC）**
- [ ] フォネーム→Blendshapeマッピング実装
- [ ] WebSocketプロトコル拡張（blendshape配信）
- [ ] Three.js SkinnedMesh制御実装
- [ ] ElevenLabs APIからフォネーム情報取得
- [ ] リアルタイム同期テスト（<50ms遅延）

**Day 3: リップシンクシステム（2D ANIME）**
- [ ] 音声振幅分析実装
- [ ] Live2D Parameter制御実装
- [ ] PARAM_MOUTH_OPEN_Y動的制御
- [ ] フォネーム→Live2Dパラメータマッピング

**Day 4-5: 表情制御システム**
- [ ] 6基本表情のBlendshape定義
- [ ] シナリオベース表情トリガー実装
- [ ] AI感情分析統合（Bedrock Claude）
- [ ] 表情アニメーション（イージング、ブレンディング）
- [ ] WebSocket経由の表情配信

**Day 6-7: テスト・最適化**
- [ ] リップシンク精度検証
- [ ] 表情切り替えスムーズネステスト
- [ ] パフォーマンス最適化（30fps維持）
- [ ] ブラウザ互換性テスト

#### Week 2: プリセット基盤・UI

**Day 1-3: データ準備**
- [ ] 2D ANIMEモデル収集（VRoid Studio, Live2D公式サンプル）
- [ ] リップシンク・表情パラメータ設定（各モデル）
- [ ] 3D REALISTICモデル作成（Ready Player Me API）
- [ ] ARKit Blendshapes検証・調整
- [ ] サムネイル生成（512x512, 最適化）
- [ ] 合計35種類のデータセット完成

**Day 4: S3バケット・DB投入**
- [ ] `prance-avatars-dev` バケット作成
- [ ] IAMポリシー設定
- [ ] CloudFront distribution設定（オプション）
- [ ] プリセットファイルアップロード
- [ ] `seed-avatars.ts` スクリプト作成
- [ ] `preset-avatars.json` データファイル作成（リップシンク・表情設定含む）
- [ ] Seed実行・検証

**Day 5: アバター選択UI**
- [ ] スタイル選択UI（ANIME/REALISTIC）
- [ ] プリセットギャラリー表示
- [ ] フィルタリング（type, style, tags）
- [ ] プレビュー機能（リップシンク・表情デモ）
- [ ] セッション作成フローへの統合

### Phase 2: 画像生成パイプライン（Week 3-4 - High Priority）

#### Week 3: ANIME生成

**Day 1-2: インフラ準備**
- [ ] AnimeGANv2 Dockerイメージ作成
- [ ] SageMaker Endpoint デプロイ（ml.g4dn.xlarge）
- [ ] MediaPipe Face Mesh統合
- [ ] Lambda関数作成（`avatar-generation-anime`）

**Day 3-4: パイプライン実装**
- [ ] 画像アップロードAPI（pre-signed URL）
- [ ] 顔検出バリデーション
- [ ] AnimeGAN推論実行
- [ ] Live2Dパラメータ生成
- [ ] S3保存・DB登録

**Day 5: UI実装**
- [ ] 画像アップロードフォーム
- [ ] 進捗表示（処理中・完了）
- [ ] プレビュー・確認
- [ ] エラーハンドリング

#### Week 4: REALISTIC生成

**Day 1-2: Ready Player Me統合**
- [ ] RPM API統合
- [ ] アバター生成ジョブ投稿
- [ ] Webhook受信Lambda実装
- [ ] ジョブステータス管理（DynamoDB）

**Day 3: GLB処理**
- [ ] GLBモデルダウンロード
- [ ] ARKit Blendshapes検証
- [ ] サムネイル生成（Three.js Headless）
- [ ] S3保存・DB登録

**Day 4-5: UI・テスト**
- [ ] 画像アップロードUI（REALISTIC用）
- [ ] ジョブステータスポーリング
- [ ] WebSocket通知（完了時）
- [ ] E2Eテスト（アップロード→生成→使用）

### Phase 3: レンダリングエンジン最適化（Week 5-6 - Medium Priority）

**Day 1-3: Live2D統合**
- [ ] Live2D Cubism SDK for Web統合
- [ ] model3.jsonパース
- [ ] モーションデータ読み込み
- [ ] Canvas描画最適化

**Day 4-5: Three.js最適化**
- [ ] GLBローダー最適化
- [ ] Blendshapeアニメーション
- [ ] ライティング・シャドウ
- [ ] パフォーマンスチューニング

**Day 6-7: クロスブラウザテスト**
- [ ] Chrome, Firefox, Safari, Edge
- [ ] モバイルブラウザ対応
- [ ] WebGL互換性チェック

---

## 📋 チェックリスト

### 即座に確認すべき事項

- [ ] 現在のアバターレンダリング実装状況を確認
  ```bash
  find apps/web/components -name "*.tsx" | xargs grep -l "three\|live2d\|avatar.*render"
  ```

- [ ] WebSocketプロトコルに表情・リップシンクデータが含まれているか確認
  ```bash
  grep -r "blendshape\|expression\|lipsync" infrastructure/lambda/websocket --include="*.ts"
  ```

- [ ] DBに既存のプリセットアバターが存在するか確認
  ```sql
  SELECT COUNT(*) FROM avatars WHERE source = 'PRESET' AND visibility = 'PUBLIC';
  ```

- [ ] セッション作成UIにアバター選択が存在するか確認
  ```bash
  find apps/web -name "*.tsx" | xargs grep -l "avatar.*select\|select.*avatar"
  ```

- [ ] S3バケットが存在するか確認
  ```bash
  aws s3 ls | grep prance-avatars
  ```

### Week 1（Critical - リップシンク・表情）

**Day 1-2: リップシンクシステム（3D）**
- [ ] フォネーム→Blendshapeマッピングテーブル作成
- [ ] WebSocketメッセージ型拡張（`BlendshapeFrame`型追加）
- [ ] Lambda関数でElevenLabs音声+フォネーム取得
- [ ] Three.js SkinnedMesh morphTargetInfluences制御
- [ ] 遅延測定・最適化（<50ms）

**Day 3: リップシンクシステム（2D）**
- [ ] 音声振幅分析アルゴリズム実装
- [ ] Live2D Cubism SDK統合
- [ ] PARAM_MOUTH_OPEN_Y動的制御
- [ ] フォネーム→Live2Dマッピング

**Day 4-5: 表情制御システム**
- [ ] 6基本表情のBlendshape値定義
- [ ] シナリオJSON拡張（`expressionTriggers`追加）
- [ ] AI応答から感情抽出プロンプト作成
- [ ] WebSocket表情配信実装
- [ ] フロントエンド表情アニメーション

**Day 6-7: テスト・デバッグ**
- [ ] リップシンク精度検証（日本語・英語）
- [ ] 表情切り替えスムーズネス確認
- [ ] パフォーマンス測定（CPU・GPU使用率）
- [ ] クロスブラウザテスト

### Week 2（Critical - データ・UI）

**Day 1-3: プリセットデータ準備**
- [ ] 2D ANIMEモデル収集（Live2D公式, VRoid）
- [ ] 各モデルにリップシンク・表情パラメータ設定
- [ ] 3D REALISTICモデル作成（RPM）
- [ ] ARKit Blendshapes調整・検証
- [ ] 合計35種類完成

**Day 4: インフラ・DB**
- [ ] S3バケット作成（`prance-avatars-dev`）
- [ ] CloudFront設定
- [ ] ファイルアップロード
- [ ] Seed script作成・実行

**Day 5: UI実装**
- [ ] スタイル選択UI（ANIME/REALISTIC）
- [ ] プリセットギャラリー
- [ ] プレビュー機能（リップシンク・表情デモ再生）
- [ ] セッション作成フローへの統合

### Week 3-4（High Priority - 画像生成）

**ANIME生成パイプライン:**
- [ ] AnimeGANv2 SageMaker Endpoint
- [ ] 画像アップロードAPI
- [ ] Lambda処理関数
- [ ] UI実装

**REALISTIC生成パイプライン:**
- [ ] Ready Player Me API統合
- [ ] Webhook受信処理
- [ ] ジョブ管理システム
- [ ] UI実装

### Week 5-6（Medium Priority - 最適化）

- [ ] Live2D描画最適化
- [ ] Three.js パフォーマンスチューニング
- [ ] クロスブラウザ対応
- [ ] モバイルブラウザテスト

---

## 🎯 推奨Next Steps

### 1. 現状確認（1時間）

```bash
# 1. アバターレンダリング実装確認
find apps/web/components -name "*.tsx" | xargs grep -l "three\|live2d"

# 2. WebSocketプロトコル確認
cat infrastructure/lambda/websocket/connect/index.ts
cat infrastructure/lambda/websocket/message/index.ts
# blendshape, expression, lipsync等のキーワードを検索

# 3. DB確認
npm run db:studio
# avatars テーブルを開いて確認

# 4. S3確認
aws s3 ls | grep prance-avatars
```

### 2. 即座に開始すべきタスク（Day 1）

**A. リップシンクプロトタイプ（3D）**
1. フォネーム→Blendshapeマッピングテーブル作成（`/a/ → jawOpen: 0.8`）
2. 簡易的なWebSocketメッセージ送信テスト
3. Three.jsで1つのBlendshapeを動的に変更するデモ作成

**B. 表情切り替えプロトタイプ**
1. 6基本表情のBlendshape値をハードコードで定義
2. ボタンクリックで表情切り替えのデモ作成
3. アニメーション（300ms遷移）実装

**C. 技術検証**
1. ElevenLabs APIのフォネーム情報取得方法確認
2. Live2D Cubism SDK for Webのライセンス確認
3. Ready Player Me APIの無料プラン制限確認

### 3. Phase 1完了基準（Week 2終了時）

**必須要件:**
- ✅ リップシンクが動作（3D/2D両方）
- ✅ 6基本表情が切り替え可能
- ✅ プリセットアバター35種類がDB登録済み
- ✅ アバター選択UIが動作
- ✅ セッションで選択したアバターが表示される

**検証方法:**
1. セッションを開始
2. アバターが音声に合わせて口を動かす
3. AIの応答内容に応じて表情が変化する
4. 遅延が50ms以内（リップシンク）
5. 30fps以上のフレームレート維持

---

## 📊 技術的な考慮事項

### パフォーマンス目標

| 指標 | 目標値 | 測定方法 |
|------|--------|----------|
| リップシンク遅延 | <50ms | 音声再生とBlendshape更新のタイムスタンプ差 |
| フレームレート | ≥30fps | `requestAnimationFrame`間隔 |
| Blendshape更新頻度 | 20-30回/秒 | WebSocketメッセージ数 |
| 表情遷移時間 | 300-500ms | アニメーション完了時間 |
| 初回レンダリング時間 | <2秒 | アバター読み込み→表示 |

### ブラウザ互換性

| ブラウザ | バージョン | Three.js | Live2D | WebGL |
|----------|-----------|----------|--------|-------|
| Chrome | ≥90 | ✅ | ✅ | ✅ |
| Firefox | ≥88 | ✅ | ✅ | ✅ |
| Safari | ≥14 | ✅ | ⚠️ | ⚠️ |
| Edge | ≥90 | ✅ | ✅ | ✅ |
| Mobile Safari | ≥14 | ⚠️ | ❌ | ⚠️ |

**注意事項:**
- Safari: WebGL2サポートが限定的、パフォーマンスチューニング必要
- Mobile Safari: Live2Dは非推奨（パフォーマンス不足）

### コスト見積もり

**Ready Player Me API（REALISTIC生成）:**
- 無料プラン: 10 avatars/月（開発環境）
- Pro: $99/月 - 1000 avatars（本番環境想定）

**SageMaker Endpoint（ANIME生成）:**
- ml.g4dn.xlarge: $0.736/時間（オンデマンド）
- 予想生成時間: 30秒/avatar
- 月間1000生成: $12（Auto Scaling 0-1インスタンス）

**S3ストレージ（アバターファイル）:**
- 平均ファイルサイズ: 5MB/avatar（GLB + thumbnail）
- 月間1000生成: 5GB = $0.12/月

**合計概算: $111/月**（1000 avatars/月生成時）

---

---

## 📚 技術リファレンス

### ARKit Blendshapes（52パラメータ完全リスト）

```typescript
// 公式ドキュメント: https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation

export enum ARKitBlendshape {
  // Eye (目)
  EyeBlinkLeft = 'eyeBlinkLeft',
  EyeLookDownLeft = 'eyeLookDownLeft',
  EyeLookInLeft = 'eyeLookInLeft',
  EyeLookOutLeft = 'eyeLookOutLeft',
  EyeLookUpLeft = 'eyeLookUpLeft',
  EyeSquintLeft = 'eyeSquintLeft',
  EyeWideLeft = 'eyeWideLeft',
  EyeBlinkRight = 'eyeBlinkRight',
  EyeLookDownRight = 'eyeLookDownRight',
  EyeLookInRight = 'eyeLookInRight',
  EyeLookOutRight = 'eyeLookOutRight',
  EyeLookUpRight = 'eyeLookUpRight',
  EyeSquintRight = 'eyeSquintRight',
  EyeWideRight = 'eyeWideRight',

  // Brow (眉)
  BrowDownLeft = 'browDownLeft',
  BrowDownRight = 'browDownRight',
  BrowInnerUp = 'browInnerUp',
  BrowOuterUpLeft = 'browOuterUpLeft',
  BrowOuterUpRight = 'browOuterUpRight',

  // Cheek (頬)
  CheekPuff = 'cheekPuff',
  CheekSquintLeft = 'cheekSquintLeft',
  CheekSquintRight = 'cheekSquintRight',

  // Mouth (口)
  JawForward = 'jawForward',
  JawLeft = 'jawLeft',
  JawRight = 'jawRight',
  JawOpen = 'jawOpen',
  MouthClose = 'mouthClose',
  MouthFunnel = 'mouthFunnel',
  MouthPucker = 'mouthPucker',
  MouthLeft = 'mouthLeft',
  MouthRight = 'mouthRight',
  MouthSmileLeft = 'mouthSmileLeft',
  MouthSmileRight = 'mouthSmileRight',
  MouthFrownLeft = 'mouthFrownLeft',
  MouthFrownRight = 'mouthFrownRight',
  MouthDimpleLeft = 'mouthDimpleLeft',
  MouthDimpleRight = 'mouthDimpleRight',
  MouthStretchLeft = 'mouthStretchLeft',
  MouthStretchRight = 'mouthStretchRight',
  MouthRollLower = 'mouthRollLower',
  MouthRollUpper = 'mouthRollUpper',
  MouthShrugLower = 'mouthShrugLower',
  MouthShrugUpper = 'mouthShrugUpper',
  MouthPressLeft = 'mouthPressLeft',
  MouthPressRight = 'mouthPressRight',
  MouthLowerDownLeft = 'mouthLowerDownLeft',
  MouthLowerDownRight = 'mouthLowerDownRight',
  MouthUpperUpLeft = 'mouthUpperUpLeft',
  MouthUpperUpRight = 'mouthUpperUpRight',

  // Nose (鼻)
  NoseSneerLeft = 'noseSneerLeft',
  NoseSneerRight = 'noseSneerRight',

  // Tongue (舌)
  TongueOut = 'tongueOut',
}
```

### Live2D Parameters（主要パラメータ）

```typescript
// 公式ドキュメント: https://docs.live2d.com/cubism-sdk-manual/standard-parametor-list/

export const LIVE2D_PARAMETERS = {
  // 顔の向き
  PARAM_ANGLE_X: 'ParamAngleX',           // 顔の左右
  PARAM_ANGLE_Y: 'ParamAngleY',           // 顔の上下
  PARAM_ANGLE_Z: 'ParamAngleZ',           // 顔の傾き

  // 目
  PARAM_EYE_L_OPEN: 'ParamEyeLOpen',      // 左目の開閉
  PARAM_EYE_R_OPEN: 'ParamEyeROpen',      // 右目の開閉
  PARAM_EYE_BALL_X: 'ParamEyeBallX',      // 目玉X
  PARAM_EYE_BALL_Y: 'ParamEyeBallY',      // 目玉Y

  // 眉
  PARAM_BROW_L_Y: 'ParamBrowLY',          // 左眉の上下
  PARAM_BROW_R_Y: 'ParamBrowRY',          // 右眉の上下
  PARAM_BROW_L_X: 'ParamBrowLX',          // 左眉の傾き
  PARAM_BROW_R_X: 'ParamBrowRX',          // 右眉の傾き
  PARAM_BROW_L_ANGLE: 'ParamBrowLAngle',  // 左眉の角度
  PARAM_BROW_R_ANGLE: 'ParamBrowRAngle',  // 右眉の角度
  PARAM_BROW_L_FORM: 'ParamBrowLForm',    // 左眉の形
  PARAM_BROW_R_FORM: 'ParamBrowRForm',    // 右眉の形

  // 口
  PARAM_MOUTH_OPEN_Y: 'ParamMouthOpenY',  // 口の開閉 (0.0-1.0)
  PARAM_MOUTH_FORM: 'ParamMouthForm',     // 口の形 (-1.0 ~ 1.0)
  PARAM_MOUTH_SIZE: 'ParamMouthSize',     // 口のサイズ

  // 体
  PARAM_BODY_ANGLE_X: 'ParamBodyAngleX',  // 体の左右
  PARAM_BODY_ANGLE_Y: 'ParamBodyAngleY',  // 体の上下
  PARAM_BODY_ANGLE_Z: 'ParamBodyAngleZ',  // 体の傾き
};
```

### ElevenLabs API（フォネーム情報取得）

```typescript
// 公式ドキュメント: https://elevenlabs.io/docs/api-reference/text-to-speech-with-timestamps

interface ElevenLabsResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

// リクエスト例
const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps', {
  method: 'POST',
  headers: {
    'xi-api-key': process.env.ELEVENLABS_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'こんにちは、私はAIアバターです。',
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
  }),
});

// フォネーム変換（文字→音素）
const phonemes = convertToPhonemes(response.alignment.characters);
// ['k', 'o', 'n', 'n', 'i', 'ch', 'i', 'w', 'a', ...]
```

### Ready Player Me API

```typescript
// 公式ドキュメント: https://docs.readyplayer.me/ready-player-me/api-reference/avatars

// アバター生成リクエスト
const rpmResponse = await fetch('https://api.readyplayer.me/v1/avatars', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${RPM_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    partner: 'your-partner-id',
    bodyType: 'fullbody',           // 'halfbody' | 'fullbody'
    gender: 'male',                 // 'male' | 'female'
    assets: {
      morphTargets: ['ARKit', 'Oculus Visemes'],
    },
    base64Image: imageBase64,       // JPG/PNG (base64)
  }),
});

// レスポンス
interface RPMResponse {
  data: {
    id: string;                     // Avatar ID
    partner: string;
    bodyType: string;
    gender: string;
    url: string;                    // GLBモデルURL
    assets: {
      morphTargets: string[];
    };
  };
}

// Webhook通知（完了時）
interface RPMWebhook {
  id: string;                       // Avatar ID
  event: 'avatar.exported';
  timestamp: string;
  data: {
    url: string;                    // GLBモデルURL（7日間有効）
  };
}
```

### Three.js Blendshape制御

```typescript
// Three.js ドキュメント: https://threejs.org/docs/#api/en/objects/SkinnedMesh

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// GLBモデル読み込み
const loader = new GLTFLoader();
const gltf = await loader.loadAsync('/avatars/model.glb');
const avatar = gltf.scene;

// SkinnedMeshを取得（顔のメッシュ）
const faceMesh = avatar.getObjectByName('Face') as THREE.SkinnedMesh;

// Blendshape制御
function setBlendshape(name: string, value: number) {
  const morphTargets = faceMesh.morphTargetDictionary;
  const index = morphTargets[name];
  if (index !== undefined) {
    faceMesh.morphTargetInfluences[index] = value;
  }
}

// リップシンク適用
function applyLipsync(phoneme: string, intensity: number) {
  const mapping = PHONEME_TO_BLENDSHAPE[phoneme];
  Object.entries(mapping).forEach(([blendshape, weight]) => {
    setBlendshape(blendshape, weight * intensity);
  });
}

// 表情適用（アニメーション付き）
function transitionExpression(expression: Expression, duration: number) {
  const targetWeights = EXPRESSION_BLENDSHAPES[expression];
  const startWeights = getCurrentBlendshapeWeights();

  const startTime = Date.now();
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1.0);
    const eased = easeInOutCubic(progress);

    Object.entries(targetWeights).forEach(([blendshape, targetValue]) => {
      const startValue = startWeights[blendshape] || 0;
      const currentValue = startValue + (targetValue - startValue) * eased;
      setBlendshape(blendshape, currentValue);
    });

    if (progress < 1.0) {
      requestAnimationFrame(animate);
    }
  }
  animate();
}

// イージング関数
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
```

### Live2D Cubism SDK for Web

```typescript
// 公式ドキュメント: https://docs.live2d.com/cubism-sdk-manual/top/

import { Live2DCubismFramework as cubismFramework } from '@framework/live2dcubismframework';
import { CubismModel } from '@framework/model/cubismmodel';

// Live2Dモデル読み込み
async function loadLive2DModel(modelPath: string): Promise<CubismModel> {
  const response = await fetch(`${modelPath}/model3.json`);
  const modelJson = await response.json();

  const model = new CubismModel();
  await model.loadModel(modelJson);

  return model;
}

// パラメータ制御
function setParameter(model: CubismModel, paramId: string, value: number) {
  const index = model.getParameterIndex(paramId);
  if (index >= 0) {
    model.setParameterValueByIndex(index, value);
  }
}

// リップシンク適用
function applyLipsyncLive2D(model: CubismModel, audioLevel: number) {
  // 音声レベル（0.0-1.0）から口の開きを計算
  const mouthOpen = Math.min(audioLevel * 2.0, 1.0);
  setParameter(model, 'ParamMouthOpenY', mouthOpen);
}

// 表情適用
function applyExpressionLive2D(model: CubismModel, expression: Expression) {
  const expressionParams = LIVE2D_EXPRESSIONS[expression];
  Object.entries(expressionParams).forEach(([paramId, value]) => {
    setParameter(model, paramId, value);
  });
}

// レンダリングループ
function render(model: CubismModel, canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL not supported');

  function loop() {
    model.update();
    model.draw(gl);
    requestAnimationFrame(loop);
  }
  loop();
}
```

### AnimeGAN v2（SageMaker推論）

```python
# AnimeGANv2 PyTorch実装: https://github.com/bryandlee/animegan2-pytorch

import torch
from model import Generator

# モデル読み込み
model = Generator()
model.load_state_dict(torch.load('weights/face_paint_512_v2.pt'))
model.eval()

# 推論
def generate_anime_avatar(image_path: str) -> torch.Tensor:
    from PIL import Image
    import torchvision.transforms as transforms

    # 前処理
    transform = transforms.Compose([
        transforms.Resize(512),
        transforms.CenterCrop(512),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
    ])

    image = Image.open(image_path).convert('RGB')
    input_tensor = transform(image).unsqueeze(0)

    # 推論
    with torch.no_grad():
        output_tensor = model(input_tensor)

    # 後処理
    output_tensor = (output_tensor.squeeze(0) + 1.0) / 2.0
    output_image = transforms.ToPILImage()(output_tensor)

    return output_image
```

---

## 🔗 関連ドキュメント

- **プロジェクト概要**: `/workspaces/prance-communication-platform/CLAUDE.md`
- **API設計**: `/docs/04-design/API_DESIGN.md`
- **データベース設計**: `/docs/04-design/DATABASE_DESIGN.md`
- **多言語対応**: `/docs/05-modules/MULTILINGUAL_SYSTEM.md`
- **Phase 1.5進捗**: `/docs/09-progress/SESSION_HISTORY.md`

---

**ドキュメントステータス:** ✅ 完成（リップシンク・表情・画像生成・技術リファレンスを追加）
**最終更新:** 2026-03-12
**次のアクション:** 現状確認（1時間） → リップシンクプロトタイプ作成（Day 1） → Phase 1実装開始
