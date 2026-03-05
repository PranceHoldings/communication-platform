# 次回セッション開始ガイド（2026-03-05作成）

**作成日時:** 2026-03-05 11:15 AM
**最終作業:** セッション作成画面（フロントエンド）実装完了

---

## 📊 本日完了した作業サマリー

### ✅ 完了タスク（2026-03-05）

#### Task #20: シナリオ管理API（Lambda関数）を実装
**デプロイ時刻:** 10:59 AM
**デプロイ時間:** 101.4秒

**実装内容:**
- Lambda関数3つ作成
  - `prance-scenarios-list-dev` - シナリオ一覧取得
  - `prance-scenarios-create-dev` - シナリオ作成
  - `prance-scenarios-get-dev` - シナリオ詳細取得
- API Gateway統合、IAM権限設定
- CloudFormation出力（ARN、エンドポイント）

**APIエンドポイント:**
```
GET  /api/v1/scenarios
POST /api/v1/scenarios
GET  /api/v1/scenarios/{id}
```

**主要機能:**
- 組織内シナリオ + PUBLIC シナリオ取得
- ページネーション（limit, offset）
- カテゴリ・可視性フィルター
- アクセス制御（組織内 OR PUBLIC）

---

#### Task #21: アバター管理API（Lambda関数）を実装
**デプロイ時刻:** 11:07 AM
**デプロイ時間:** 112.77秒

**実装内容:**
- Lambda関数3つ作成
  - `prance-avatars-list-dev` - アバター一覧取得
  - `prance-avatars-create-dev` - アバター作成
  - `prance-avatars-get-dev` - アバター詳細取得
- API Gateway統合、IAM権限設定
- CloudFormation出力（ARN、エンドポイント）

**APIエンドポイント:**
```
GET  /api/v1/avatars
POST /api/v1/avatars
GET  /api/v1/avatars/{id}
```

**主要機能:**
- 組織内アバター + PRESET + PUBLIC アバター取得
- タイプ・スタイル・ソースフィルター
- アクセス制御（組織内 OR PRESET OR PUBLIC）
- PRESET作成はSUPER_ADMINのみ可能

---

#### Task #22: セッション作成画面（フロントエンド）を実装
**コミット時刻:** 約11:10 AM

**実装内容:**

1. **APIクライアント作成**
   - `apps/web/lib/api/scenarios.ts` - シナリオAPI統合
   - `apps/web/lib/api/avatars.ts` - アバターAPI統合

2. **セッション作成ページ** (`/dashboard/sessions/new`)
   - 3ステップウィザード形式
   - **Step 1:** シナリオ選択（カード形式、検索機能）
   - **Step 2:** アバター選択（サムネイル、フィルター）
   - **Step 3:** オプション設定（メタデータ入力）
   - プログレスインジケーター、バリデーション

3. **セッション詳細ページ** (`/dashboard/sessions/[id]`)
   - ステータス・日時表示
   - シナリオ・アバター情報表示
   - メタデータ表示
   - セッション操作ボタン（プレイヤーは未実装）

4. **多言語対応**
   - `messages/en/sessions.json` - 英語翻訳
   - `messages/ja/sessions.json` - 日本語翻訳
   - セッション作成画面の全UI文言
   - バリデーションメッセージ

---

## 🏗️ 現在のシステム構成

### デプロイ済みAPI（AWS us-east-1）

**ベースURL:** `https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/`

| カテゴリ | エンドポイント | Lambda関数 | 説明 |
|---------|---------------|-----------|------|
| **ヘルスチェック** | GET /api/v1/health | prance-health-check-dev | API稼働確認 |
| **認証** | POST /api/v1/auth/register | prance-auth-register-dev | ユーザー登録 |
| | POST /api/v1/auth/login | prance-auth-login-dev | ログイン |
| **ユーザー** | GET /api/v1/users/me | prance-users-me-dev | 現在のユーザー情報 |
| **セッション** | GET /api/v1/sessions | prance-sessions-list-dev | セッション一覧 |
| | POST /api/v1/sessions | prance-sessions-create-dev | セッション作成 |
| | GET /api/v1/sessions/{id} | prance-sessions-get-dev | セッション詳細 |
| **シナリオ** | GET /api/v1/scenarios | prance-scenarios-list-dev | シナリオ一覧 ✨NEW |
| | POST /api/v1/scenarios | prance-scenarios-create-dev | シナリオ作成 ✨NEW |
| | GET /api/v1/scenarios/{id} | prance-scenarios-get-dev | シナリオ詳細 ✨NEW |
| **アバター** | GET /api/v1/avatars | prance-avatars-list-dev | アバター一覧 ✨NEW |
| | POST /api/v1/avatars | prance-avatars-create-dev | アバター作成 ✨NEW |
| | GET /api/v1/avatars/{id} | prance-avatars-get-dev | アバター詳細 ✨NEW |

### フロントエンド（Next.js 15）

**開発サーバー:** `http://localhost:3000`
**ステータス:** 実行中（ポート3000）

**実装済みページ:**
- `/` - ホーム（多言語対応）
- `/login` - ログイン
- `/register` - ユーザー登録
- `/dashboard` - ダッシュボード
- `/dashboard/sessions` - セッション一覧
- `/dashboard/sessions/new` - セッション作成 ✨NEW
- `/dashboard/sessions/[id]` - セッション詳細 ✨NEW

---

## ⚠️ 現在の制限事項

### 1. データベースにデータがない

**問題:** シナリオとアバターのデータがないため、セッション作成画面で選択肢が表示されない

**影響:**
- `/dashboard/sessions/new` で「No scenarios found」「No avatars found」と表示される
- セッション作成フローをテストできない

**解決方法（次回作業で対応）:**

#### Option A: APIから直接データ作成
```bash
# 環境変数
API_URL="https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev"

# 1. ユーザー登録してトークン取得
RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123",
    "name": "Admin User",
    "organizationName": "Test Organization"
  }')

TOKEN=$(echo $RESPONSE | jq -r '.tokens.accessToken')

# 2. シナリオ作成
curl -X POST "$API_URL/api/v1/scenarios" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "面接練習 - 基本編",
    "category": "interview",
    "configJson": {"duration": 30, "difficulty": "beginner"},
    "language": "ja",
    "visibility": "PUBLIC"
  }'

curl -X POST "$API_URL/api/v1/scenarios" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Interview Practice - Basic",
    "category": "interview",
    "configJson": {"duration": 30, "difficulty": "beginner"},
    "language": "en",
    "visibility": "PUBLIC"
  }'

# 3. アバター作成
curl -X POST "$API_URL/api/v1/avatars" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "サチコ（アニメ風）",
    "type": "TWO_D",
    "style": "ANIME",
    "source": "PRESET",
    "modelUrl": "https://models.readyplayer.me/example1.glb",
    "thumbnailUrl": "https://models.readyplayer.me/example1.png",
    "visibility": "PUBLIC",
    "tags": ["female", "professional", "friendly"]
  }'

curl -X POST "$API_URL/api/v1/avatars" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John (Realistic)",
    "type": "THREE_D",
    "style": "REALISTIC",
    "source": "PRESET",
    "modelUrl": "https://models.readyplayer.me/example2.glb",
    "thumbnailUrl": "https://models.readyplayer.me/example2.png",
    "visibility": "PUBLIC",
    "tags": ["male", "business", "formal"]
  }'
```

#### Option B: 管理画面実装（推奨、次のステップ）
- シナリオ管理画面 (`/dashboard/scenarios`)
- アバター管理画面 (`/dashboard/avatars`)
- フロントエンドから直接CRUD操作

### 2. セッションプレイヤー未実装

**問題:** セッション詳細ページの「Start Session」ボタンはプレースホルダー

**TODO:**
- リアルタイム会話UI実装
- WebSocket統合（AWS IoT Core）
- 音声・映像録画機能

---

## 🚀 次回セッション時にすぐ始められる作業

### 推奨ステップ

#### **Step 1: 環境確認（5分）**

```bash
# 1. Docker起動確認
docker ps | grep prance-postgres
# 停止している場合:
docker start prance-postgres

# 2. AWS認証確認
aws sts get-caller-identity
# 期待される出力: Account 010438500933

# 3. API稼働確認
curl https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/health
# 期待される出力: {"status":"ok",...}

# 4. 開発サーバー起動確認
ps aux | grep "next dev"
# 実行中でない場合:
cd /workspaces/prance-communication-platform/apps/web
npm run dev
```

---

#### **Step 2: テストデータ作成（15分）**

**目的:** セッション作成フローの動作確認ができるようにする

**作業内容:**
1. 上記「Option A: APIから直接データ作成」のスクリプトを実行
2. ブラウザで確認: `http://localhost:3000/dashboard/sessions/new`
3. シナリオとアバターが表示されることを確認
4. セッション作成フローをテスト

**期待結果:**
- シナリオ選択: 2件表示（日本語・英語）
- アバター選択: 2件表示（アニメ・リアル）
- セッション作成成功 → セッション詳細ページへリダイレクト

---

#### **Step 3A: シナリオ管理画面実装（2-3時間）**

**目的:** フロントエンドからシナリオをCRUD操作できるようにする

**実装内容:**
```
/dashboard/scenarios
├── page.tsx           - シナリオ一覧（テーブル形式）
├── new/
│   └── page.tsx       - シナリオ作成フォーム
└── [id]/
    ├── page.tsx       - シナリオ詳細・編集
    └── delete確認ダイアログ
```

**必要な機能:**
- シナリオ一覧表示（ページネーション）
- 検索・フィルター（カテゴリ、言語、可視性）
- 新規作成フォーム
  - タイトル、カテゴリ、言語、可視性
  - configJson（JSONエディタ）
- 編集機能（UPDATE APIは未実装なので、削除→再作成）
- 削除機能（DELETE APIは未実装なので実装必要）

---

#### **Step 3B: アバター管理画面実装（2-3時間）**

**目的:** フロントエンドからアバターをCRUD操作できるようにする

**実装内容:**
```
/dashboard/avatars
├── page.tsx           - アバター一覧（カード形式）
├── new/
│   └── page.tsx       - アバター作成フォーム
└── [id]/
    ├── page.tsx       - アバター詳細・編集
    └── delete確認ダイアログ
```

**必要な機能:**
- アバター一覧表示（カード形式、サムネイル）
- フィルター（タイプ、スタイル、ソース）
- 新規作成フォーム
  - 名前、タイプ、スタイル、ソース
  - モデルURL、サムネイルURL（手動入力 or 将来的にアップロード）
  - タグ、可視性
- 編集・削除機能

---

#### **Step 4: UPDATE/DELETE API実装（1-2時間）**

**現状:** シナリオとアバターはCREATE/READ/LISTのみ実装済み

**追加が必要なAPI:**
```
PUT    /api/v1/scenarios/{id}  - シナリオ更新
DELETE /api/v1/scenarios/{id}  - シナリオ削除
PUT    /api/v1/avatars/{id}    - アバター更新
DELETE /api/v1/avatars/{id}    - アバター削除
```

**実装場所:**
- `infrastructure/lambda/scenarios/update/index.ts` (新規作成)
- `infrastructure/lambda/scenarios/delete/index.ts` (新規作成)
- `infrastructure/lambda/avatars/update/index.ts` (新規作成)
- `infrastructure/lambda/avatars/delete/index.ts` (新規作成)
- `infrastructure/lib/api-lambda-stack.ts` (Lambda関数追加、ルート追加)

---

## 📋 タスクリスト（優先順位順）

| 優先度 | タスク | 所要時間 | 説明 |
|-------|-------|---------|------|
| 🔴 **必須** | テストデータ作成 | 15分 | セッション作成フローをテストできるようにする |
| 🟠 **高** | シナリオ管理画面実装 | 2-3時間 | フロントエンドからシナリオ管理 |
| 🟠 **高** | アバター管理画面実装 | 2-3時間 | フロントエンドからアバター管理 |
| 🟡 **中** | UPDATE/DELETE API実装 | 1-2時間 | 編集・削除機能の追加 |
| 🟢 **低** | 本番用faviconとアイコン作成 | 1時間 | Task #19、ブランディング |
| 🔵 **将来** | セッションプレイヤー実装 | 1-2週間 | リアルタイム会話UI |
| 🔵 **将来** | WebSocket統合 | 1週間 | AWS IoT Core接続 |
| 🔵 **将来** | 音声処理統合 | 1-2週間 | TTS/STT、録画機能 |

---

## 💾 重要なファイル・ディレクトリ

### 本日作成したファイル

```
infrastructure/lambda/
├── scenarios/
│   ├── list/index.ts         ✨ 新規
│   ├── create/index.ts       ✨ 新規
│   └── get/index.ts          ✨ 新規
└── avatars/
    ├── list/index.ts         ✨ 新規
    ├── create/index.ts       ✨ 新規
    └── get/index.ts          ✨ 新規

apps/web/
├── app/dashboard/sessions/
│   ├── new/page.tsx          ✨ 新規
│   └── [id]/page.tsx         ✨ 新規（更新）
├── lib/api/
│   ├── scenarios.ts          ✨ 新規
│   └── avatars.ts            ✨ 新規
└── messages/
    ├── en/sessions.json      ✨ 新規
    └── ja/sessions.json      ✨ 新規
```

### 更新したファイル

```
infrastructure/lib/api-lambda-stack.ts  ← Lambda関数6つ追加、ルート追加、IAM権限
infrastructure/bin/app.ts               ← props追加（databaseCluster, databaseSecret）
```

---

## 🔗 重要なURL・情報

### API Base URL
```
https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/
```

### フロントエンド開発サーバー
```
http://localhost:3000
```

### データベース接続情報
```
Host: localhost:5432
Database: prance_dev
User: postgres
Password: password
Container: prance-postgres
```

### AWS情報
```
Region: us-east-1
Account: 010438500933
User: kenwakasa
```

### Gitリポジトリ
```
https://github.com/PranceHoldings/communication-platform.git
Branch: main
```

---

## 🎯 次回セッション開始時の第一声

**推奨開始コマンド:**

```markdown
次回セッション開始時に以下のように伝えてください：

「前回の続きから始めます。
NEXT_SESSION.mdを確認して、Step 1の環境確認から進めてください」
```

Claude（AI）が自動的に：
1. NEXT_SESSION.mdを読み込む
2. 環境確認（Docker、AWS、開発サーバー）を実行
3. テストデータ作成スクリプトを提案
4. 次の作業（シナリオ管理画面実装）を開始

---

## 📝 技術的メモ

### Prismaスキーマの重要なフィールド名

**⚠️ データベース操作前に必ず確認:**

| モデル | 間違いやすいフィールド | 正しいフィールド名 |
|-------|----------------------|------------------|
| User | updatedAt | lastLoginAt |
| User | organizationId | orgId（DBは snake_case: org_id） |
| Session | createdAt | startedAt |
| Session | duration | durationSec |
| Scenario | description | category |
| Avatar | imageUrl | thumbnailUrl |

**ルール:**
- データベース作業前に `packages/database/prisma/schema.prisma` を必ず確認
- Enum値は全て大文字（ACTIVE, SUPER_ADMIN, TWO_D, ANIME, PRESET など）
- DBカラム名は snake_case、Prismaフィールド名は camelCase

### Lambda関数の共通パターン

**すべてのLambda関数で統一:**
```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import { prisma } from '../../shared/database/prisma';
import { getUserFromEvent } from '../../shared/auth/jwt';
import { successResponse, errorResponse } from '../../shared/utils/response';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    // 1. 認証チェック
    const user = getUserFromEvent(event);
    if (!user) {
      return errorResponse(401, 'Unauthorized');
    }

    // 2. バリデーション
    // ...

    // 3. Prisma操作
    const result = await prisma.model.operation(...);

    // 4. アクセス制御
    if (result.orgId !== user.organizationId) {
      return errorResponse(403, 'Access denied');
    }

    // 5. レスポンス
    return successResponse(result);
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal error', error.message);
  }
};
```

---

## ✅ 完了タスク一覧（全体）

- ✅ Task #1-18: Phase 0完了（インフラ基盤、認証システム、多言語対応）
- ✅ **Task #20:** シナリオ管理API（Lambda関数）を実装
- ✅ **Task #21:** アバター管理API（Lambda関数）を実装
- ✅ **Task #22:** セッション作成画面（フロントエンド）を実装
- ⏳ Task #19: 本番用faviconとブランドアイコンの作成（保留）

---

## 🎉 達成した成果

**今日（2026-03-05）だけで:**
- Lambda関数6つ実装・デプロイ
- APIエンドポイント6つ追加
- フロントエンド画面3つ実装
- 多言語対応（セッション作成画面）
- TypeScript型定義2ファイル

**Phase 1の進捗:**
- セッション作成機能の基盤完成（MVP相当）
- 次はデータ投入→管理画面実装でフル機能化

---

**このファイルは次回セッション開始時に最初に参照してください！**
**作業の継続性を保つため、このファイルの内容に沿って進めることを推奨します。**
