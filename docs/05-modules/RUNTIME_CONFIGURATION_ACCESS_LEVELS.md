# Runtime Configuration Access Levels

**目的:** システム破壊・セキュリティリスクを防ぐための環境変数アクセスレベル設計

## アクセスレベル定義

### Level 0: DEVELOPER_ONLY (UI非表示)
**対象:** 開発チームのみ、直接DB操作
**特徴:** システムの根幹、変更すると即座にサービス停止
**権限:** DEVELOPER (DB直接操作)

**カテゴリ:**
- インフラエンドポイント
- 機密情報（APIキー、シークレット）
- データベース接続情報
- AWS リソース名

**変数一覧 (45個):**

```
# AWS Infrastructure
AWS_ACCOUNT_ID
AWS_REGION
AWS_ENDPOINT_SUFFIX
BEDROCK_REGION
BEDROCK_MODEL_ID
ENVIRONMENT

# Endpoints & URLs
BASE_URL
FRONTEND_URL
WEBSOCKET_ENDPOINT
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_WS_ENDPOINT

# Database
DATABASE_URL

# Secrets & Keys
JWT_SECRET
JWT_ACCESS_TOKEN_EXPIRES_IN
JWT_REFRESH_TOKEN_EXPIRES_IN
AZURE_SPEECH_KEY
AZURE_SPEECH_REGION
ELEVENLABS_API_KEY
ELEVENLABS_MODEL_ID
ELEVENLABS_VOICE_ID
CLOUDFRONT_PRIVATE_KEY
CLOUDFRONT_KEY_PAIR_ID
GITHUB_ACCESS_TOKEN
READY_PLAYER_ME_APP_ID

# AWS Resource Names
S3_BUCKET
DB_QUERIES_BUCKET
CLOUDFRONT_DOMAIN
CONNECTIONS_TABLE_NAME
DYNAMODB_RATE_LIMIT_TABLE
DYNAMODB_BENCHMARK_CACHE_TABLE
DYNAMODB_USER_SESSION_HISTORY_TABLE
GUEST_RATE_LIMIT_TABLE
AWS_LAMBDA_FUNCTION_NAME
ANALYSIS_LAMBDA_FUNCTION_NAME

# Media Settings (変更すると既存データ破損)
AUDIO_CONTENT_TYPE
AUDIO_SAMPLE_RATE
VIDEO_CONTENT_TYPE
VIDEO_FORMAT
VIDEO_RESOLUTION

# System Paths
FFMPEG_PATH
FFPROBE_PATH
GITHUB_REPO_URL

# AI Voice Settings (契約依存)
POLLY_VOICE_ID
POLLY_ENGINE
POLLY_REGION
REKOGNITION_REGION
```

### Level 1: SUPER_ADMIN_READ_ONLY
**対象:** スーパー管理者は参照のみ、変更は開発チームが慎重に実施
**特徴:** システム安定性・セキュリティに直接影響

**変数一覧 (10個):**

```
# Security (不適切な変更でアカウントロック多発)
BCRYPT_SALT_ROUNDS               # 8-14 (変更後は既存パスワード無効化)
RATE_LIMIT_LOCKOUT_DURATION_MS   # 変更するとユーザー体験に大きく影響

# System Stability
DYNAMODB_CONNECTION_TTL_SECONDS  # 不適切な値でWebSocket切断多発
DYNAMODB_VIDEO_LOCK_TTL_SECONDS  # 不適切な値で録画失敗
MIN_SAMPLE_SIZE                   # ベンチマークのk-anonymity保護

# Data Retention
BENCHMARK_CACHE_TTL_DAYS         # DynamoDB容量に影響
SESSION_HISTORY_TTL_DAYS         # DynamoDB容量に影響

# System Behavior
ENABLE_AUTO_ANALYSIS             # 全セッションに影響
STT_LANGUAGE                     # 既存シナリオと不整合
STT_AUTO_DETECT_LANGUAGES        # 既存シナリオと不整合
```

### Level 2: SUPER_ADMIN_READ_WRITE
**対象:** スーパー管理者が変更可能
**特徴:** パフォーマンス・システム全体の調整、全テナントに影響
**権限:** SUPER_ADMIN

**変数一覧 (10個):**

```
# Query & Processing
MAX_RESULTS                      # 1-10000 (全テナント共通)
VIDEO_CHUNK_BATCH_SIZE          # 1-100 (全テナント共通)
ANALYSIS_BATCH_SIZE             # 1-100 (全テナント共通)

# AI Processing (全テナント共通)
CLAUDE_TEMPERATURE              # 0.0-1.0
CLAUDE_MAX_TOKENS               # 128-4096
MAX_AUTO_DETECT_LANGUAGES       # 1-10

# Rate Limiting (全テナント共通)
RATE_LIMIT_MAX_ATTEMPTS         # 1-100
RATE_LIMIT_ATTEMPT_WINDOW_MS    # 60000-3600000

# Audio Processing (インフラレベル)
DEFAULT_CHUNK_DURATION_MS      # 100-10000
MIN_PAUSE_DURATION_SEC         # 0.1-10.0
```

### Level 3: CLIENT_ADMIN_READ_WRITE (🆕)
**対象:** クライアント管理者が変更可能
**特徴:** 自組織のユーザー体験最適化、システム破壊リスクなし
**権限:** SUPER_ADMIN, CLIENT_ADMIN
**将来:** Organization単位で値を保持（現在は全テナント共通）

**変数一覧 (14個):**

```
# Audio Quality (ユーザー体験直接影響)
TTS_STABILITY                   # 0.3-1.0 (安定性重視)
TTS_SIMILARITY_BOOST           # 0.5-1.0 (類似性重視)
SILENCE_THRESHOLD              # 0.05-0.3 (環境ノイズ考慮)
OPTIMAL_PAUSE_SEC              # 1.0-5.0 (会話テンポ)

# Score Weights (組織のポリシーに合わせて調整可能)
AUDIO_WEIGHT                   # 0.1-0.4 (合計1.0制約)
CONTENT_WEIGHT                 # 0.1-0.4 (合計1.0制約)
DELIVERY_WEIGHT                # 0.1-0.4 (合計1.0制約)
EMOTION_WEIGHT                 # 0.1-0.4 (合計1.0制約)

# Score Thresholds (組織基準)
SCORE_THRESHOLD_EXCELLENT       # 60-90
SCORE_THRESHOLD_GOOD            # 40-80

# Score Base Weights (組織ポリシー)
SCORE_WEIGHT_COMMUNICATION      # 0.15-0.35 (合計1.0制約)
SCORE_WEIGHT_PROBLEM_SOLVING    # 0.15-0.35 (合計1.0制約)
SCORE_WEIGHT_TECHNICAL          # 0.15-0.35 (合計1.0制約)
SCORE_WEIGHT_PRESENTATION       # 0.15-0.35 (合計1.0制約)
```

**🔐 不正値チェック (3層防御):**

1. **データベース層:**
   - CHECK制約: 範囲検証
   - TRIGGER: 相互依存検証

2. **API層 (Lambda):**
   - 型検証 (NUMBER, 0.0-1.0)
   - 範囲検証 (min/max)
   - 相互依存検証:
     - `AUDIO_WEIGHT + CONTENT_WEIGHT + DELIVERY_WEIGHT + EMOTION_WEIGHT = 1.0`
     - `SCORE_WEIGHT_* の合計 = 1.0`
     - `SCORE_THRESHOLD_GOOD < SCORE_THRESHOLD_EXCELLENT`
   - 変更履歴強制（reason必須）

3. **UI層:**
   - リアルタイムバリデーション
   - 相互依存を可視化（円グラフ）
   - 変更前の確認ダイアログ

### Level 4: CLIENT_ADMIN_READ_ONLY
**対象:** クライアント管理者は参照のみ
**特徴:** システムパフォーマンスへの影響理解
**権限:** SUPER_ADMIN (R/W), CLIENT_ADMIN (R)

**変数一覧 (3個):**

```
# Quality Thresholds (システム全体に影響)
MIN_QUALITY_THRESHOLD          # 0.0-1.0
MIN_CONFIDENCE_THRESHOLD       # 0.0-1.0
DEFAULT_STT_CONFIDENCE         # 0.0-1.0
```

**参照可能範囲:**
- Level 2 (SUPER_ADMIN_READ_WRITE) の全て
- Level 3 (CLIENT_ADMIN_READ_WRITE) の全て
- Level 4 (CLIENT_ADMIN_READ_ONLY) の全て

**参照不可:**
- Level 0 (DEVELOPER_ONLY)
- Level 1 (SUPER_ADMIN_READ_ONLY)

---

## 実装設計

### 1. Prismaスキーマ拡張

```prisma
enum RuntimeConfigAccessLevel {
  DEVELOPER_ONLY          // UI非表示、直接DB操作のみ
  SUPER_ADMIN_READ_ONLY   // SUPER_ADMINは参照のみ
  SUPER_ADMIN_READ_WRITE  // SUPER_ADMINは変更可能
  CLIENT_ADMIN_READ_ONLY  // CLIENT_ADMINは参照のみ
}

model RuntimeConfig {
  key          String                      @id
  value        Json
  dataType     RuntimeConfigDataType
  category     RuntimeConfigCategory
  accessLevel  RuntimeConfigAccessLevel    @default(SUPER_ADMIN_READ_WRITE) @map("access_level")
  defaultValue Json
  minValue     Float?
  maxValue     Float?
  description  String
  updatedAt    DateTime                    @updatedAt
  updatedBy    String?

  history RuntimeConfigHistory[]

  @@index([category])
  @@index([accessLevel])
  @@index([updatedAt])
  @@map("runtime_configs")
}
```

### 2. 認可ロジック (5段階アクセス制御)

| User Role | Level 0 | Level 1 | Level 2 | Level 3 | Level 4 |
|-----------|---------|---------|---------|---------|---------|
| **DEVELOPER** | ✅ R/W | ✅ R/W | ✅ R/W | ✅ R/W | ✅ R/W |
| **SUPER_ADMIN** | ❌ | ✅ R | ✅ R/W | ✅ R/W | ✅ R/W |
| **CLIENT_ADMIN** | ❌ | ❌ | ✅ R | **✅ R/W** | ✅ R |
| **CLIENT_USER** | ❌ | ❌ | ❌ | ❌ | ❌ |

**凡例:**
- ✅ R/W: 読み取り・書き込み可能
- ✅ R: 読み取りのみ可能
- ❌: アクセス不可（UIに表示されない）

**Level 3 (CLIENT_ADMIN_READ_WRITE) の特徴:**
- CLIENT_ADMINが自組織のユーザー体験を最適化
- システム破壊リスクなし（厳格な不正値チェック）
- 変更履歴・理由記録必須
- ロールバック機能で安全性確保

### 3. UI設計

#### 一覧画面
```typescript
// accessLevelでフィルタ
const visibleConfigs = configs.filter(config => {
  if (user.role === 'SUPER_ADMIN') {
    return config.accessLevel !== 'DEVELOPER_ONLY';
  }
  if (user.role === 'CLIENT_ADMIN') {
    return ['SUPER_ADMIN_READ_WRITE', 'CLIENT_ADMIN_READ_ONLY'].includes(config.accessLevel);
  }
  return false;
});
```

#### 詳細画面
```typescript
// 編集可否判定
const canEdit = () => {
  if (config.accessLevel === 'DEVELOPER_ONLY') return false;
  if (config.accessLevel === 'SUPER_ADMIN_READ_ONLY') return false;
  if (user.role === 'CLIENT_ADMIN') return false;
  if (user.role === 'SUPER_ADMIN' &&
      ['SUPER_ADMIN_READ_WRITE'].includes(config.accessLevel)) return true;
  return false;
};
```

#### アクセスレベルバッジ
```typescript
const AccessLevelBadge = ({ level }: { level: RuntimeConfigAccessLevel }) => {
  const variants = {
    DEVELOPER_ONLY: { color: 'red', icon: '🔒', text: 'Developer Only' },
    SUPER_ADMIN_READ_ONLY: { color: 'orange', icon: '👀', text: 'Read Only' },
    SUPER_ADMIN_READ_WRITE: { color: 'green', icon: '✏️', text: 'Editable' },
    CLIENT_ADMIN_READ_ONLY: { color: 'blue', icon: '👁️', text: 'View Only' },
  };

  const variant = variants[level];
  return (
    <Badge variant={variant.color}>
      {variant.icon} {variant.text}
    </Badge>
  );
};
```

### 4. セキュリティ対策

#### API層での強制 + 不正値チェック
```typescript
// Lambda: GET /admin/runtime-config
export const handler = async (event: APIGatewayProxyEvent) => {
  const payload = verifyToken(token);

  // アクセスレベルフィルタ
  const accessibleLevels = getAccessibleLevels(payload.role);

  const configs = await prisma.runtimeConfig.findMany({
    where: {
      accessLevel: { in: accessibleLevels }
    }
  });

  return { statusCode: 200, body: JSON.stringify({ data: { configs } }) };
};

// Lambda: PUT /admin/runtime-config/:key
export const handler = async (event: APIGatewayProxyEvent) => {
  const payload = verifyToken(token);
  const config = await prisma.runtimeConfig.findUnique({ where: { key } });
  const body = JSON.parse(event.body);

  // 書き込み権限チェック
  if (!canWrite(payload.role, config.accessLevel)) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Insufficient permissions',
        required: getRequiredRole(config.accessLevel)
      })
    };
  }

  // 🔐 不正値チェック (3段階)

  // 1. 基本検証（型・範囲）
  const basicValidation = validateValue(body.value, config);
  if (basicValidation.error) {
    return { statusCode: 400, body: JSON.stringify(basicValidation) };
  }

  // 2. 相互依存検証
  const dependencyValidation = await validateDependencies(config.key, body.value);
  if (dependencyValidation.error) {
    return { statusCode: 400, body: JSON.stringify(dependencyValidation) };
  }

  // 3. ビジネスルール検証
  const businessValidation = validateBusinessRules(config.key, body.value);
  if (businessValidation.error) {
    return { statusCode: 400, body: JSON.stringify(businessValidation) };
  }

  // CLIENT_ADMINの場合は理由必須
  if (payload.role === 'CLIENT_ADMIN' && !body.reason) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Reason is required for CLIENT_ADMIN',
        field: 'reason'
      })
    };
  }

  // 更新処理...
  const updated = await prisma.runtimeConfig.update({
    where: { key: config.key },
    data: { value: body.value, updatedBy: payload.userId }
  });

  // 変更履歴記録
  await prisma.runtimeConfigHistory.create({
    data: {
      key: config.key,
      oldValue: config.value,
      newValue: body.value,
      changedBy: payload.userId,
      reason: body.reason || 'Updated via UI',
      ipAddress: event.requestContext.identity.sourceIp
    }
  });

  // キャッシュ更新
  await setCacheValue(`runtime:${config.key}`, body.value, 60);
  clearMemoryCache(config.key);

  return { statusCode: 200, body: JSON.stringify({ data: updated }) };
};

// 🔐 相互依存検証
async function validateDependencies(key: string, value: any): Promise<ValidationResult> {
  // Weight合計検証 (AUDIO_WEIGHT, CONTENT_WEIGHT, DELIVERY_WEIGHT, EMOTION_WEIGHT)
  if (['AUDIO_WEIGHT', 'CONTENT_WEIGHT', 'DELIVERY_WEIGHT', 'EMOTION_WEIGHT'].includes(key)) {
    const weights = await getWeightGroup(key);
    weights[key] = value;

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      return {
        error: 'Weight sum must equal 1.0',
        details: {
          current: weights,
          sum,
          expected: 1.0
        }
      };
    }
  }

  // Score Weight合計検証
  if (key.startsWith('SCORE_WEIGHT_')) {
    const weights = await getScoreWeightGroup(key);
    weights[key] = value;

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      return {
        error: 'Score weight sum must equal 1.0',
        details: {
          current: weights,
          sum,
          expected: 1.0
        }
      };
    }
  }

  // Threshold順序検証
  if (key === 'SCORE_THRESHOLD_GOOD') {
    const excellent = await getRuntimeConfig('SCORE_THRESHOLD_EXCELLENT');
    if (value >= excellent) {
      return {
        error: 'SCORE_THRESHOLD_GOOD must be less than SCORE_THRESHOLD_EXCELLENT',
        details: {
          good: value,
          excellent
        }
      };
    }
  }

  if (key === 'SCORE_THRESHOLD_EXCELLENT') {
    const good = await getRuntimeConfig('SCORE_THRESHOLD_GOOD');
    if (value <= good) {
      return {
        error: 'SCORE_THRESHOLD_EXCELLENT must be greater than SCORE_THRESHOLD_GOOD',
        details: {
          excellent: value,
          good
        }
      };
    }
  }

  return { success: true };
}

// 🔐 ビジネスルール検証
function validateBusinessRules(key: string, value: any): ValidationResult {
  // TTS_STABILITY: 低すぎると音声が不安定
  if (key === 'TTS_STABILITY' && value < 0.3) {
    return {
      error: 'TTS_STABILITY below 0.3 may cause unstable audio',
      recommendation: 'Use 0.5-0.8 for best results'
    };
  }

  // SILENCE_THRESHOLD: 高すぎると会話が検出されない
  if (key === 'SILENCE_THRESHOLD' && value > 0.3) {
    return {
      error: 'SILENCE_THRESHOLD above 0.3 may miss speech detection',
      recommendation: 'Use 0.05-0.15 for normal environments'
    };
  }

  return { success: true };
}
```

#### 監査ログ強化
```typescript
// 不正アクセス試行をログ
if (!canAccess(user.role, config.accessLevel)) {
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      resource: `runtime_config:${config.key}`,
      accessLevel: config.accessLevel,
      userRole: user.role,
      ipAddress: event.requestContext.identity.sourceIp,
      timestamp: new Date()
    }
  });
}
```

---

## マイグレーション計画

### Phase 5.4.1: スキーマ拡張
1. Prismaスキーマに `accessLevel` 追加
2. マイグレーション作成
3. 既存15個のデータに `SUPER_ADMIN_READ_WRITE` 設定

### Phase 5.4.2: 認可ロジック実装
1. Lambda関数の認可ロジック追加
2. `getAccessibleLevels()` ユーティリティ実装
3. `canWrite()` ユーティリティ実装

### Phase 5.4.3: UI更新
1. アクセスレベルバッジ追加
2. フィルタロジック実装
3. 編集可否制御

### Phase 5.4.4: DEVELOPER_ONLY変数の除外
1. Level 0変数をRuntime Configから除外
2. 環境変数のまま維持
3. ドキュメント更新

---

## リスク評価

| リスク | 影響度 | 対策 |
|--------|--------|------|
| SUPER_ADMINがLevel 1を変更 | High | UI非表示、API拒否、監査ログ |
| CLIENT_ADMINがLevel 2を変更 | Medium | API拒否、監査ログ |
| accessLevel設定ミス | Critical | コードレビュー必須、デフォルトREAD_ONLY |
| 既存データの不整合 | Medium | マイグレーション時に全件検証 |

---

## 推奨される初期設定

**現在実装済み15個 → SUPER_ADMIN_READ_WRITE**
- MAX_RESULTS
- VIDEO_CHUNK_BATCH_SIZE
- ANALYSIS_BATCH_SIZE
- CLAUDE_TEMPERATURE
- CLAUDE_MAX_TOKENS
- MAX_AUTO_DETECT_LANGUAGES
- RATE_LIMIT_MAX_ATTEMPTS
- RATE_LIMIT_LOCKOUT_DURATION_MS
- BCRYPT_SALT_ROUNDS → **SUPER_ADMIN_READ_ONLY** (変更後パスワード無効化)
- SCORE_WEIGHT_* (4個)
- SCORE_THRESHOLD_* (2個)

**合計:** 14個 SUPER_ADMIN_READ_WRITE + 1個 SUPER_ADMIN_READ_ONLY

---

**次のアクション:**
1. このアクセスレベル設計を承認
2. Phase 5.4.1-5.4.4を実装
3. 追加変数（Audio/Quality 13個）を投入時にアクセスレベル設定

**推定時間:** 2-3時間
