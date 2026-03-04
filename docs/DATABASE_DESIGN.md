# データベース設計

Pranceプラットフォームの詳細なデータベース設計ドキュメント。

## 目次

- [データベース構成](#データベース構成)
- [テーブル詳細設計](#テーブル詳細設計)
- [リレーションシップ](#リレーションシップ)
- [インデックス戦略](#インデックス戦略)
- [セキュリティ・アクセス制御](#セキュリティアクセス制御)
- [スケーリング戦略](#スケーリング戦略)

---

## データベース構成

### 使用するデータストア

```
┌──────────────────────────────────────────────────────────┐
│ Aurora Serverless v2 (PostgreSQL 15)                      │
│ - マスターデータ                                          │
│ - トランザクショナルデータ                                │
│ - リレーショナルデータ                                    │
└──────────────────────────────────────────────────────────┘
        │
        ├─ 0.5 ACU ~ 16 ACU (自動スケール)
        ├─ Multi-AZ (高可用性)
        ├─ 自動バックアップ (PITR: 35日)
        └─ Prisma ORM経由でアクセス

┌──────────────────────────────────────────────────────────┐
│ DynamoDB                                                  │
│ - セッション状態管理                                      │
│ - WebSocket接続管理                                       │
│ - ベンチマークキャッシュ                                  │
│ - APIレート制限カウンター                                 │
└──────────────────────────────────────────────────────────┘
        │
        ├─ オンデマンドモード (自動スケール)
        ├─ TTL (Time To Live) 自動削除
        └─ DynamoDB Streams (リアルタイム通知)

┌──────────────────────────────────────────────────────────┐
│ ElastiCache Serverless (Redis)                           │
│ - セッションキャッシュ                                    │
│ - レート制限 (Sliding Window)                            │
│ - リアルタイム通知キュー                                  │
└──────────────────────────────────────────────────────────┘
        │
        └─ サブミリ秒レスポンス
```

---

## テーブル詳細設計

### 1. プラットフォーム管理

#### platform_settings

プラットフォーム全体の設定（スーパー管理者）

```sql
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- グローバルAPI制限
  global_api_rate_limits JSONB DEFAULT '{
    "monthly": 10000000,
    "daily": 500000,
    "hourly": 50000
  }'::jsonb,

  -- プランデフォルト制限
  plan_default_limits JSONB DEFAULT '{
    "free": {...},
    "pro": {...},
    "enterprise": {...}
  }'::jsonb,

  -- システム設定
  system_config JSONB DEFAULT '{
    "maintenance_mode": false,
    "allowed_signup_domains": [],
    "default_avatar_library_version": "1.0"
  }'::jsonb,

  -- サポート言語
  supported_languages JSONB DEFAULT '["ja", "en"]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_platform_settings_updated ON platform_settings(updated_at DESC);

-- RLS (Row Level Security)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_settings_super_admin_only
  ON platform_settings
  FOR ALL
  USING (auth.role() = 'super_admin');
```

#### plans

サブスクリプションプラン定義

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_id VARCHAR(50) UNIQUE NOT NULL, -- 'free', 'pro', 'enterprise'
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- ステータス
  status VARCHAR(20) DEFAULT 'public' CHECK (status IN ('public', 'draft', 'deprecated')),
  display_order INT DEFAULT 0,
  is_recommended BOOLEAN DEFAULT FALSE,
  highlight_color VARCHAR(7) DEFAULT '#4F46E5', -- Hex color code

  -- 価格設定
  pricing JSONB DEFAULT '{
    "monthly": 0,
    "annual": 0,
    "trial_days": 0,
    "setup_fee": 0,
    "currency": "USD"
  }'::jsonb,

  -- クォータ設定
  quotas JSONB DEFAULT '{
    "sessions_per_month": 5,
    "recording_retention_days": 7,
    "concurrent_users": 3,
    "preset_avatars": 10,
    "custom_avatars": false,
    "custom_voices": 1,
    "scenarios": 3,
    "api_keys": 0,
    "api_monthly_calls": 0
  }'::jsonb,

  -- 機能設定
  features JSONB DEFAULT '{
    "emotion_analysis": false,
    "report_generation": false,
    "custom_reports": false,
    "benchmark": true,
    "ai_prompt_management": "none",
    "ai_provider_selection": "none",
    "api_access": false,
    "ats_integrations": 0,
    "sso": false,
    "support_level": "community"
  }'::jsonb,

  -- Stripe統合（将来実装）
  stripe_price_id VARCHAR(100),
  stripe_product_id VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_plans_status_order ON plans(status, display_order);
CREATE INDEX idx_plans_internal_id ON plans(internal_id);

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_super_admin_write
  ON plans
  FOR ALL
  USING (auth.role() = 'super_admin');
CREATE POLICY plans_public_read
  ON plans
  FOR SELECT
  USING (status = 'public');
```

#### subscriptions

組織のサブスクリプション状態

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),

  -- ステータス
  status VARCHAR(20) DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'suspended')),

  -- 期間
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 month',
  trial_end_date TIMESTAMPTZ,

  -- キャンセル
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,

  -- Stripe統合（将来実装）
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_customer_id VARCHAR(100),

  -- 使用量追跡
  usage_current_period JSONB DEFAULT '{
    "sessions": 0,
    "api_calls": 0,
    "storage_gb": 0
  }'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_org_members
  ON subscriptions
  FOR SELECT
  USING (org_id = auth.current_org_id());
CREATE POLICY subscriptions_admins_write
  ON subscriptions
  FOR ALL
  USING (
    org_id = auth.current_org_id() AND
    auth.role() IN ('super_admin', 'client_admin')
  );
```

### 2. 組織・ユーザー管理

#### organizations

テナント（組織）

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL, -- URL friendly name

  -- サブスクリプション
  subscription_id UUID REFERENCES subscriptions(id),

  -- 設定
  settings JSONB DEFAULT '{
    "timezone": "UTC",
    "date_format": "YYYY-MM-DD",
    "session_retention_days": 90
  }'::jsonb,

  -- ブランディング
  branding JSONB DEFAULT '{
    "logo_url": null,
    "primary_color": "#4F46E5",
    "secondary_color": "#06B6D4"
  }'::jsonb,

  -- ベンチマーク設定
  benchmark_settings JSONB DEFAULT '{
    "enabled": true,
    "comparison_scope": ["org"],
    "min_users_for_display": 10
  }'::jsonb,

  -- API設定
  api_settings JSONB DEFAULT '{
    "rate_limit_override": null,
    "webhook_url": null
  }'::jsonb,

  -- 多言語設定
  locale VARCHAR(10) DEFAULT 'ja',
  supported_locales JSONB DEFAULT '["ja", "en"]'::jsonb,

  -- Stripe（将来実装）
  stripe_customer_id VARCHAR(100) UNIQUE,

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- ソフトデリート
);

-- インデックス
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_subscription ON organizations(subscription_id);
CREATE INDEX idx_organizations_created ON organizations(created_at DESC);

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_members_read
  ON organizations
  FOR SELECT
  USING (id = auth.current_org_id() OR auth.role() = 'super_admin');
CREATE POLICY organizations_admins_write
  ON organizations
  FOR UPDATE
  USING (
    id = auth.current_org_id() AND
    auth.role() IN ('super_admin', 'client_admin')
  );
```

#### users

ユーザー

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- 認証情報（Cognitoと同期）
  cognito_sub UUID UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,

  -- 基本情報
  name VARCHAR(200) NOT NULL,
  avatar_url TEXT,

  -- ロール
  role VARCHAR(20) DEFAULT 'client_user' CHECK (role IN ('super_admin', 'client_admin', 'client_user')),

  -- プロフィール
  profile JSONB DEFAULT '{
    "bio": null,
    "department": null,
    "job_title": null
  }'::jsonb,

  -- 設定
  preferences JSONB DEFAULT '{
    "theme": "light",
    "notifications_enabled": true,
    "email_digest": "weekly"
  }'::jsonb,

  -- 言語設定
  locale VARCHAR(10) DEFAULT 'ja',

  -- ベンチマーク
  benchmark_opt_in BOOLEAN DEFAULT TRUE,

  -- ATS連携
  ats_candidate_id VARCHAR(100),
  ats_application_id VARCHAR(100),
  ats_metadata JSONB,

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ -- ソフトデリート
);

-- インデックス
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_cognito_sub ON users(cognito_sub);
CREATE INDEX idx_users_ats_candidate ON users(ats_candidate_id) WHERE ats_candidate_id IS NOT NULL;

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_own_read
  ON users
  FOR SELECT
  USING (
    id = auth.user_id() OR
    (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
  );
CREATE POLICY users_admins_write
  ON users
  FOR ALL
  USING (
    org_id = auth.current_org_id() AND
    auth.role() IN ('super_admin', 'client_admin')
  );
```

### 3. アバター・音声

#### avatars

アバターモデル

```sql
CREATE TABLE avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- 基本情報
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- タイプ
  type VARCHAR(10) CHECK (type IN ('2d', '3d')),
  style VARCHAR(20) CHECK (style IN ('anime', 'real', 'custom')),
  source VARCHAR(20) CHECK (source IN ('preset', 'generated', 'org_custom', 'user_custom')),

  -- モデルファイル
  model_url TEXT NOT NULL, -- S3 URL (GLB/Live2D)
  thumbnail_url TEXT,

  -- 設定
  config JSONB DEFAULT '{
    "blendshapes_mapping": {},
    "default_expression": "neutral",
    "scale": 1.0
  }'::jsonb,

  -- メタデータ
  tags TEXT[],
  visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'org', 'public')),

  -- 統計
  usage_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_avatars_user ON avatars(user_id);
CREATE INDEX idx_avatars_org ON avatars(org_id);
CREATE INDEX idx_avatars_visibility ON avatars(visibility);
CREATE INDEX idx_avatars_type_style ON avatars(type, style);
CREATE INDEX idx_avatars_tags ON avatars USING GIN(tags);

-- RLS
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
CREATE POLICY avatars_read
  ON avatars
  FOR SELECT
  USING (
    visibility = 'public' OR
    (visibility = 'org' AND org_id = auth.current_org_id()) OR
    user_id = auth.user_id() OR
    auth.role() = 'super_admin'
  );
CREATE POLICY avatars_write
  ON avatars
  FOR ALL
  USING (
    user_id = auth.user_id() OR
    (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
  );
```

#### voices

音声プロファイル

```sql
CREATE TABLE voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- 基本情報
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- ソース
  source VARCHAR(20) CHECK (source IN ('preset', 'clone', 'upload', 'record')),

  -- プロバイダ設定
  elevenlabs_voice_id VARCHAR(100),
  azure_voice_name VARCHAR(100),
  provider VARCHAR(50) DEFAULT 'elevenlabs',

  -- サンプルファイル
  sample_url TEXT,
  sample_duration_sec FLOAT,

  -- メタデータ
  language VARCHAR(10) DEFAULT 'ja',
  gender VARCHAR(10),
  age_range VARCHAR(20),
  accent VARCHAR(50),

  -- 同意情報（クローニング時）
  consent_confirmed BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,

  -- 統計
  usage_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_voices_user ON voices(user_id);
CREATE INDEX idx_voices_org ON voices(org_id);
CREATE INDEX idx_voices_provider ON voices(provider, elevenlabs_voice_id);
CREATE INDEX idx_voices_language ON voices(language);

-- RLS
ALTER TABLE voices ENABLE ROW LEVEL SECURITY;
CREATE POLICY voices_read
  ON voices
  FOR SELECT
  USING (
    user_id = auth.user_id() OR
    (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
  );
CREATE POLICY voices_write
  ON voices
  FOR ALL
  USING (user_id = auth.user_id());
```

### 4. シナリオ・プロンプト管理

#### scenarios

会話シナリオ

```sql
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- 基本情報
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'job_interview', 'language', 'customer_service', 'survey'
  language VARCHAR(10) DEFAULT 'ja',

  -- 公開範囲
  visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'org', 'public')),

  -- シナリオ設定
  config JSONB DEFAULT '{
    "max_duration_min": 30,
    "avatar_persona": {...},
    "conversation_flow": {...},
    "interaction_params": {...},
    "evaluation_criteria": [...]
  }'::jsonb,

  -- 関連リソース
  report_template_id UUID REFERENCES report_templates(id),
  prompt_template_id UUID REFERENCES prompt_templates(id),

  -- 統計
  usage_count INT DEFAULT 0,
  avg_rating FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_scenarios_user ON scenarios(user_id);
CREATE INDEX idx_scenarios_org ON scenarios(org_id);
CREATE INDEX idx_scenarios_category ON scenarios(category);
CREATE INDEX idx_scenarios_visibility ON scenarios(visibility);
CREATE INDEX idx_scenarios_language ON scenarios(language);

-- RLS
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY scenarios_read
  ON scenarios
  FOR SELECT
  USING (
    visibility = 'public' OR
    (visibility = 'org' AND org_id = auth.current_org_id()) OR
    user_id = auth.user_id() OR
    auth.role() = 'super_admin'
  );
CREATE POLICY scenarios_write
  ON scenarios
  FOR ALL
  USING (
    user_id = auth.user_id() OR
    (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
  );
```

#### prompt_templates

AIプロンプトテンプレート

```sql
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- 基本情報
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'job_interview', 'language', etc.

  -- プロンプト内容
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT,

  -- 変数定義
  variables_schema JSONB DEFAULT '[]'::jsonb,

  -- パフォーマンス設定
  performance_config JSONB DEFAULT '{
    "temperature": 0.7,
    "max_tokens": 2000,
    "top_p": 0.9
  }'::jsonb,

  -- バージョン管理
  version INT DEFAULT 1,
  parent_version_id UUID REFERENCES prompt_templates(id),
  is_active BOOLEAN DEFAULT TRUE,

  -- メタデータ
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_prompt_templates_org ON prompt_templates(org_id);
CREATE INDEX idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX idx_prompt_templates_active ON prompt_templates(is_active);

-- RLS
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY prompt_templates_read
  ON prompt_templates
  FOR SELECT
  USING (
    org_id = auth.current_org_id() OR
    auth.role() = 'super_admin'
  );
CREATE POLICY prompt_templates_write
  ON prompt_templates
  FOR ALL
  USING (
    org_id = auth.current_org_id() AND
    auth.role() IN ('super_admin', 'client_admin')
  );
```

### 5. AIプロバイダ管理

#### ai_providers

AIプロバイダ設定

```sql
CREATE TABLE ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- プロバイダ情報
  type VARCHAR(20) CHECK (type IN ('conversation', 'tts', 'stt', 'emotion')),
  provider_name VARCHAR(50) NOT NULL, -- 'claude', 'gpt4', 'elevenlabs', 'azure', etc.

  -- ステータス
  is_active BOOLEAN DEFAULT FALSE,
  priority_order INT DEFAULT 0, -- フォールバック優先順位

  -- 設定（暗号化）
  config JSONB DEFAULT '{
    "api_key_encrypted": null,
    "endpoint": null,
    "region": null,
    "model": null
  }'::jsonb,

  -- コスト設定
  cost_config JSONB DEFAULT '{
    "pricing_model": "per_token",
    "unit_cost": 0.0,
    "currency": "USD"
  }'::jsonb,

  -- 使用量制限
  usage_limits JSONB DEFAULT '{
    "monthly_budget": null,
    "daily_calls_limit": null
  }'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_ai_providers_org_type ON ai_providers(org_id, type);
CREATE INDEX idx_ai_providers_active ON ai_providers(is_active, priority_order);

-- RLS
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_providers_read
  ON ai_providers
  FOR SELECT
  USING (
    org_id = auth.current_org_id() OR
    auth.role() = 'super_admin'
  );
CREATE POLICY ai_providers_write
  ON ai_providers
  FOR ALL
  USING (
    org_id = auth.current_org_id() AND
    auth.role() IN ('super_admin', 'client_admin')
  );
```

#### ai_provider_usage

AIプロバイダ使用量追跡

```sql
CREATE TABLE ai_provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,

  -- 使用タイプ
  usage_type VARCHAR(20) CHECK (usage_type IN ('conversation', 'tts', 'stt', 'emotion')),

  -- 使用量
  tokens_used INT DEFAULT 0,
  characters_used INT DEFAULT 0,
  minutes_used FLOAT DEFAULT 0.0,
  images_processed INT DEFAULT 0,

  -- コスト
  estimated_cost DECIMAL(10, 4) DEFAULT 0.0,
  currency VARCHAR(3) DEFAULT 'USD',

  -- タイムスタンプ
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス (時系列データ最適化)
CREATE INDEX idx_ai_usage_org_timestamp ON ai_provider_usage(org_id, timestamp DESC);
CREATE INDEX idx_ai_usage_provider_timestamp ON ai_provider_usage(provider_id, timestamp DESC);
CREATE INDEX idx_ai_usage_session ON ai_provider_usage(session_id);

-- パーティショニング（月ごと）
CREATE TABLE ai_provider_usage_y2026m03 PARTITION OF ai_provider_usage
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
-- 以降の月も同様にパーティション作成
```

### 6. セッション・録画

#### sessions

セッション実行データ

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- シナリオ設定
  scenario_id UUID NOT NULL REFERENCES scenarios(id),
  avatar_id UUID NOT NULL REFERENCES avatars(id),
  voice_id UUID NOT NULL REFERENCES voices(id),

  -- AI設定スナップショット
  prompt_template_id UUID REFERENCES prompt_templates(id),
  provider_snapshot JSONB, -- 使用時のプロバイダ設定スナップショット

  -- ステータス
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'processing', 'completed', 'error', 'canceled')),
  error_message TEXT,

  -- タイミング
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_sec INT,

  -- 統計
  turn_count INT DEFAULT 0, -- 会話のターン数

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_org ON sessions(org_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX idx_sessions_scenario ON sessions(scenario_id);

-- RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_own_read
  ON sessions
  FOR SELECT
  USING (
    user_id = auth.user_id() OR
    (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
  );
CREATE POLICY sessions_own_write
  ON sessions
  FOR INSERT
  USING (user_id = auth.user_id());
CREATE POLICY sessions_own_update
  ON sessions
  FOR UPDATE
  USING (user_id = auth.user_id());
```

#### recordings

録画ファイル

```sql
CREATE TABLE recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- ファイル情報
  type VARCHAR(20) CHECK (type IN ('user', 'avatar', 'combined', 'audio')),
  s3_url TEXT NOT NULL,
  cdn_url TEXT,
  thumbnail_url TEXT,

  -- メタデータ
  file_size_bytes BIGINT,
  duration_sec FLOAT,
  format VARCHAR(10), -- 'webm', 'mp4', 'wav'
  resolution VARCHAR(20), -- '1920x1080', etc.

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_recordings_session ON recordings(session_id);
CREATE INDEX idx_recordings_type ON recordings(type);

-- RLS
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY recordings_session_owner
  ON recordings
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.user_id() OR
      (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
    )
  );
```

#### transcripts

トランスクリプト（発話記録）

```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- 発話情報
  speaker VARCHAR(10) CHECK (speaker IN ('AI', 'USER')),
  text TEXT NOT NULL,

  -- タイミング
  timestamp_start FLOAT NOT NULL, -- 秒単位
  timestamp_end FLOAT NOT NULL,

  -- 品質
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),

  -- ハイライト
  highlight VARCHAR(20) CHECK (highlight IN ('positive', 'negative', 'important')) DEFAULT NULL,

  -- 感情スナップショット（その瞬間の感情データ）
  emotion_snapshot JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_transcripts_session ON transcripts(session_id);
CREATE INDEX idx_transcripts_timestamp ON transcripts(session_id, timestamp_start);
CREATE INDEX idx_transcripts_highlight ON transcripts(highlight) WHERE highlight IS NOT NULL;

-- 全文検索
CREATE INDEX idx_transcripts_text_fts ON transcripts USING GIN(to_tsvector('english', text));

-- RLS
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY transcripts_session_owner
  ON transcripts
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.user_id() OR
      (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
    )
  );
```

### 7. 解析データ

#### emotion_data

感情解析結果（フレームごと）

```sql
CREATE TABLE emotion_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- フレーム情報
  frame_number INT NOT NULL,
  timestamp_sec FLOAT NOT NULL,

  -- 感情スコア (0.0 - 1.0)
  happiness FLOAT CHECK (happiness BETWEEN 0 AND 1),
  sadness FLOAT CHECK (sadness BETWEEN 0 AND 1),
  anger FLOAT CHECK (anger BETWEEN 0 AND 1),
  surprise FLOAT CHECK (surprise BETWEEN 0 AND 1),
  fear FLOAT CHECK (fear BETWEEN 0 AND 1),
  disgust FLOAT CHECK (disgust BETWEEN 0 AND 1),
  contempt FLOAT CHECK (contempt BETWEEN 0 AND 1),
  neutral FLOAT CHECK (neutral BETWEEN 0 AND 1),

  -- 頭の向き (度)
  head_pitch FLOAT,
  head_roll FLOAT,
  head_yaw FLOAT,

  -- 視線方向
  gaze_x FLOAT,
  gaze_y FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス（時系列データ）
CREATE INDEX idx_emotion_data_session_timestamp ON emotion_data(session_id, timestamp_sec);

-- RLS
ALTER TABLE emotion_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY emotion_data_session_owner
  ON emotion_data
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.user_id() OR
      (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
    )
  );
```

#### audio_analysis

音声解析結果

```sql
CREATE TABLE audio_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- 話速
  avg_wpm FLOAT, -- Words Per Minute
  wpm_variance FLOAT,

  -- ピッチ
  avg_pitch_hz FLOAT,
  pitch_variance FLOAT,

  -- フィラーワード
  filler_word_count INT DEFAULT 0,
  filler_words JSONB, -- { "あー": 5, "えー": 3, ... }

  -- 無音
  silence_ratio FLOAT, -- 全体に占める無音の割合
  avg_pause_duration_sec FLOAT,

  -- トーンスコア
  tone_scores JSONB DEFAULT '{
    "confident": 0.0,
    "nervous": 0.0,
    "enthusiastic": 0.0,
    "monotone": 0.0
  }'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_audio_analysis_session ON audio_analysis(session_id);

-- RLS
ALTER TABLE audio_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY audio_analysis_session_owner
  ON audio_analysis
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.user_id() OR
      (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
    )
  );
```

### 8. レポート

#### reports

自動生成レポート

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES report_templates(id),

  -- スコア
  overall_score INT CHECK (overall_score BETWEEN 0 AND 100),

  -- セクション別スコア
  section_scores JSONB DEFAULT '[]'::jsonb,

  -- AIフィードバック
  ai_feedback TEXT,

  -- ハイライト
  highlights JSONB DEFAULT '[]'::jsonb,

  -- 改善提案
  recommendations JSONB DEFAULT '[]'::jsonb,

  -- PDF
  pdf_url TEXT,

  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_reports_session ON reports(session_id);
CREATE INDEX idx_reports_generated ON reports(generated_at DESC);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_session_owner
  ON reports
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.user_id() OR
      (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
    )
  );
```

#### report_templates

レポートテンプレート

```sql
CREATE TABLE report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- 基本情報
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,

  -- テンプレート構成
  sections JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_report_templates_org ON report_templates(org_id);
CREATE INDEX idx_report_templates_default ON report_templates(is_default);

-- RLS
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_templates_read
  ON report_templates
  FOR SELECT
  USING (
    org_id = auth.current_org_id() OR
    is_default = TRUE OR
    auth.role() = 'super_admin'
  );
CREATE POLICY report_templates_write
  ON report_templates
  FOR ALL
  USING (
    org_id = auth.current_org_id() AND
    auth.role() IN ('super_admin', 'client_admin')
  );
```

### 9. ベンチマーク

#### user_profiles

ユーザープロファイル（ベンチマーク）

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- 総合スコア
  overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
  overall_percentile INT CHECK (overall_percentile BETWEEN 0 AND 100),

  -- 項目別スコア
  metrics JSONB DEFAULT '{
    "logical_explanation": 0,
    "eye_contact": 0,
    "speaking_pace": 0,
    "vocabulary": 0,
    "confidence": 0,
    "emotional_stability": 0
  }'::jsonb,

  -- プロファイルタイプ
  profile_type VARCHAR(100),
  profile_description TEXT,
  similar_users_percentage FLOAT,

  -- 成長データ
  growth_trend VARCHAR(20) CHECK (growth_trend IN ('improving', 'stable', 'declining')),
  monthly_change INT,
  six_month_change INT,

  -- 推奨・バッジ
  recommendations JSONB DEFAULT '[]'::jsonb,
  achievements JSONB DEFAULT '[]'::jsonb,

  -- メタデータ
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 一意性制約
  UNIQUE(user_id, org_id)
);

-- インデックス
CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_org ON user_profiles(org_id);
CREATE INDEX idx_user_profiles_overall_score ON user_profiles(overall_score DESC);
CREATE INDEX idx_user_profiles_calculated ON user_profiles(last_calculated_at DESC);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_profiles_own_read
  ON user_profiles
  FOR SELECT
  USING (
    user_id = auth.user_id() OR
    (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
  );
```

#### benchmark_aggregates

ベンチマーク集約データ（キャッシュ）

```sql
CREATE TABLE benchmark_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- スコープ
  scope VARCHAR(20) CHECK (scope IN ('org', 'industry', 'global')),
  timeframe VARCHAR(20) CHECK (timeframe IN ('month', 'quarter', 'year')),

  -- 統計データ
  score_distribution JSONB NOT NULL, -- ヒストグラム
  percentile_thresholds JSONB NOT NULL, -- { "10": 45, "25": 55, ... }
  avg_metrics JSONB NOT NULL, -- 項目別平均
  clusters JSONB, -- クラスタリング結果

  -- メタデータ
  user_count INT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',

  -- 一意性制約
  UNIQUE(org_id, scope, timeframe)
);

-- インデックス
CREATE INDEX idx_benchmark_aggregates_org_scope ON benchmark_aggregates(org_id, scope);
CREATE INDEX idx_benchmark_aggregates_expires ON benchmark_aggregates(expires_at);

-- 自動削除（有効期限切れ）
CREATE OR REPLACE FUNCTION delete_expired_benchmarks()
RETURNS void AS $$
BEGIN
  DELETE FROM benchmark_aggregates WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Cron ジョブ（日次実行）
-- SELECT cron.schedule('delete-expired-benchmarks', '0 2 * * *', 'SELECT delete_expired_benchmarks();');
```

### 10. 外部連携API

#### api_keys

APIキー管理

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- キー情報
  key_name VARCHAR(200) NOT NULL,
  description TEXT,
  key_hash VARCHAR(128) UNIQUE NOT NULL, -- SHA-256ハッシュ
  key_prefix VARCHAR(20) NOT NULL, -- 表示用 (例: sk_live_xxxx)

  -- 環境
  environment VARCHAR(10) CHECK (environment IN ('live', 'test')),
  is_active BOOLEAN DEFAULT TRUE,

  -- 権限スコープ
  scopes JSONB DEFAULT '[]'::jsonb, -- ["sessions.read", "sessions.write", ...]

  -- レート制限
  rate_limit_monthly INT,
  rate_limit_daily INT,
  rate_limit_hourly INT,

  -- IPアドレス制限
  ip_whitelist JSONB, -- ["192.168.1.100", "10.0.0.0/8"]

  -- Webhook
  webhook_url TEXT,

  -- メタデータ
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- インデックス
CREATE INDEX idx_api_keys_org ON api_keys(org_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at);

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_keys_admins
  ON api_keys
  FOR ALL
  USING (
    org_id = auth.current_org_id() AND
    auth.role() IN ('super_admin', 'client_admin')
  );
```

#### api_key_usage

APIキー使用ログ

```sql
CREATE TABLE api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- リクエスト情報
  endpoint VARCHAR(200) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INT NOT NULL,

  -- メタデータ
  request_id UUID DEFAULT gen_random_uuid(),
  response_time_ms INT,

  -- タイミング
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- クライアント情報
  ip_address INET,
  user_agent TEXT
);

-- インデックス（時系列データ）
CREATE INDEX idx_api_key_usage_key_timestamp ON api_key_usage(api_key_id, timestamp DESC);
CREATE INDEX idx_api_key_usage_org_timestamp ON api_key_usage(org_id, timestamp DESC);

-- パーティショニング（月ごと）
CREATE TABLE api_key_usage_y2026m03 PARTITION OF api_key_usage
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

### 11. ATS連携

#### ats_integrations

ATS連携設定

```sql
CREATE TABLE ats_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- プロバイダ
  provider VARCHAR(50) CHECK (provider IN ('greenhouse', 'lever', 'workday', 'hrmos', 'jobkan', 'kanri')),

  -- ステータス
  is_active BOOLEAN DEFAULT FALSE,

  -- 認証設定（暗号化）
  config JSONB DEFAULT '{
    "api_key_encrypted": null,
    "endpoint": null,
    "oauth_tokens": null
  }'::jsonb,

  -- フィールドマッピング
  field_mappings JSONB DEFAULT '[]'::jsonb,

  -- 同期設定
  sync_settings JSONB DEFAULT '{
    "auto_sync_candidates": true,
    "auto_export_results": true,
    "sync_interval_minutes": 60
  }'::jsonb,

  -- Webhook
  webhook_secret VARCHAR(128),

  -- メタデータ
  last_sync_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_ats_integrations_org ON ats_integrations(org_id);
CREATE INDEX idx_ats_integrations_provider ON ats_integrations(provider);
CREATE INDEX idx_ats_integrations_active ON ats_integrations(is_active);

-- RLS
ALTER TABLE ats_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ats_integrations_admins
  ON ats_integrations
  FOR ALL
  USING (
    org_id = auth.current_org_id() AND
    auth.role() IN ('super_admin', 'client_admin')
  );
```

#### ats_candidate_mappings

ATS候補者マッピング

```sql
CREATE TABLE ats_candidate_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES ats_integrations(id) ON DELETE CASCADE,

  -- マッピング
  prance_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ats_candidate_id VARCHAR(100) NOT NULL,
  ats_application_id VARCHAR(100),

  -- メタデータ
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 一意性制約
  UNIQUE(integration_id, ats_candidate_id)
);

-- インデックス
CREATE INDEX idx_ats_mappings_user ON ats_candidate_mappings(prance_user_id);
CREATE INDEX idx_ats_mappings_integration ON ats_candidate_mappings(integration_id);
CREATE INDEX idx_ats_mappings_candidate ON ats_candidate_mappings(ats_candidate_id);
```

### 12. プラグインシステム

#### plugins

プラグイン定義

```sql
CREATE TABLE plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(100) UNIQUE NOT NULL, -- 'greenhouse-integration'

  -- 基本情報
  name VARCHAR(200) NOT NULL,
  version VARCHAR(20) NOT NULL,
  author VARCHAR(200),
  description TEXT,
  type VARCHAR(50) CHECK (type IN ('ats', 'hris', 'auth', 'report', 'webhook', 'custom')),

  -- ステータス
  status VARCHAR(20) CHECK (status IN ('approved', 'review', 'deprecated')) DEFAULT 'review',

  -- マニフェスト
  manifest JSONB NOT NULL,
  config_schema JSONB,

  -- リソース
  icon_url TEXT,
  documentation_url TEXT,
  license VARCHAR(50),

  -- 統計
  install_count INT DEFAULT 0,
  rating_avg FLOAT CHECK (rating_avg BETWEEN 0 AND 5),
  review_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_plugins_plugin_id ON plugins(plugin_id);
CREATE INDEX idx_plugins_type ON plugins(type);
CREATE INDEX idx_plugins_status ON plugins(status);
CREATE INDEX idx_plugins_rating ON plugins(rating_avg DESC);
```

#### plugin_installations

プラグインインストール情報

```sql
CREATE TABLE plugin_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,

  -- ステータス
  status VARCHAR(20) CHECK (status IN ('installed', 'enabled', 'disabled', 'uninstalled')) DEFAULT 'installed',

  -- 設定
  config JSONB,
  permissions_granted JSONB,

  -- メタデータ
  installed_by UUID NOT NULL REFERENCES users(id),
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,

  -- 一意性制約
  UNIQUE(org_id, plugin_id)
);

-- インデックス
CREATE INDEX idx_plugin_installations_org ON plugin_installations(org_id);
CREATE INDEX idx_plugin_installations_status ON plugin_installations(status);
```

### 13. 多言語対応

#### translations

翻訳データ

```sql
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- エンティティ
  entity_type VARCHAR(50) NOT NULL, -- 'scenario', 'avatar', 'report_template'
  entity_id UUID NOT NULL,

  -- 言語
  locale VARCHAR(10) NOT NULL, -- 'ja', 'en', 'zh-CN', etc.

  -- 翻訳
  field_name VARCHAR(100) NOT NULL, -- 'title', 'description', etc.
  translated_value TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 一意性制約
  UNIQUE(entity_type, entity_id, locale, field_name)
);

-- インデックス
CREATE INDEX idx_translations_entity ON translations(entity_type, entity_id);
CREATE INDEX idx_translations_locale ON translations(locale);
```

---

## リレーションシップ

### ER図（主要テーブル）

```
platform_settings
       │
       ▼
┌─────────────┐
│    plans    │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  subscriptions   │
└────────┬─────────┘
         │
         ▼
┌─────────────────────┐
│  organizations      │
└──────────┬──────────┘
           │
           ├──< users
           ├──< avatars (org_custom)
           ├──< scenarios
           ├──< prompt_templates
           ├──< ai_providers
           ├──< api_keys
           ├──< ats_integrations
           └──< plugin_installations

users ──┬──< user_profiles
        ├──< achievements
        ├──< sessions
        ├──< avatars (user_custom)
        └──< voices

scenarios ──< sessions

sessions ──┬──< recordings
           ├──< transcripts
           ├──< emotion_data
           ├──< audio_analysis
           └──< reports

avatars ──< sessions
voices ──< sessions
prompt_templates ──< sessions
```

---

## インデックス戦略

### 1. B-tree インデックス（デフォルト）

```sql
-- 主キー（自動作成）
-- 外部キー
-- タイムスタンプフィールド（範囲検索）
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX idx_emotion_data_timestamp ON emotion_data(session_id, timestamp_sec);

-- 複合インデックス（クエリパターン最適化）
CREATE INDEX idx_users_org_role ON users(org_id, role);
CREATE INDEX idx_avatars_type_style ON avatars(type, style);
```

### 2. GIN インデックス（JSONB/配列）

```sql
-- JSONB全体
CREATE INDEX idx_scenarios_config_gin ON scenarios USING GIN(config);

-- 配列
CREATE INDEX idx_avatars_tags_gin ON avatars USING GIN(tags);

-- 全文検索
CREATE INDEX idx_transcripts_text_fts ON transcripts USING GIN(to_tsvector('english', text));
```

### 3. パーシャルインデックス

```sql
-- 条件付きインデックス（ストレージ節約）
CREATE INDEX idx_sessions_active ON sessions(status) WHERE status = 'active';
CREATE INDEX idx_users_ats ON users(ats_candidate_id) WHERE ats_candidate_id IS NOT NULL;
```

### 4. カバリングインデックス

```sql
-- SELECT でよく使うカラムを含める
CREATE INDEX idx_sessions_user_status_started
  ON sessions(user_id, status, started_at DESC)
  INCLUDE (scenario_id, duration_sec);
```

---

## セキュリティ・アクセス制御

### Row Level Security (RLS)

```sql
-- 有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ポリシー例
CREATE POLICY users_own_read
  ON users
  FOR SELECT
  USING (
    id = auth.user_id() OR
    (org_id = auth.current_org_id() AND auth.role() IN ('client_admin', 'super_admin'))
  );

-- INSERT制限
CREATE POLICY users_admins_create
  ON users
  FOR INSERT
  WITH CHECK (
    org_id = auth.current_org_id() AND
    auth.role() IN ('super_admin', 'client_admin')
  );
```

### 暗号化

```sql
-- 機密データの暗号化（アプリケーション層）
-- - APIキー: AES-256 + AWS KMS
-- - 個人情報: 列レベル暗号化

-- 例: pgcrypto拡張
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 暗号化関数
CREATE OR REPLACE FUNCTION encrypt_api_key(plain_text TEXT, secret TEXT)
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(plain_text, secret);
END;
$$ LANGUAGE plpgsql;

-- 復号化関数
CREATE OR REPLACE FUNCTION decrypt_api_key(encrypted_data BYTEA, secret TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_data, secret);
END;
$$ LANGUAGE plpgsql;
```

---

## スケーリング戦略

### 1. Aurora Serverless v2 スケーリング

```yaml
# CDK設定例
AuroraCluster:
  ServerlessV2ScalingConfiguration:
    MinCapacity: 0.5 ACU  # アイドル時
    MaxCapacity: 16 ACU   # ピーク時
```

### 2. 読み取りレプリカ

```yaml
# 読み取り負荷分散
AuroraCluster:
  Writer: ClusterInstance.serverlessV2('writer')
  Readers:
    - ClusterInstance.serverlessV2('reader1', scaleWithWriter: true)
    - ClusterInstance.serverlessV2('reader2', scaleWithWriter: true)
```

### 3. コネクションプール（Prisma Data Proxy）

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Lambda環境でコネクションプール管理
```

### 4. パーティショニング（時系列データ）

```sql
-- ai_provider_usage の月次パーティション
CREATE TABLE ai_provider_usage (
  id UUID,
  timestamp TIMESTAMPTZ,
  ...
) PARTITION BY RANGE (timestamp);

CREATE TABLE ai_provider_usage_y2026m03 PARTITION OF ai_provider_usage
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- 自動パーティション作成（pg_partman等使用）
```

### 5. キャッシュ戦略

```
┌──────────────────────────────────────────┐
│ Application Layer                         │
│                                           │
│ 1. Redis (ElastiCache) - ホットデータ     │
│    - セッション状態                       │
│    - レート制限カウンター                 │
│    - ベンチマーク集約（頻繁アクセス）     │
│    TTL: 数分 ~ 数時間                     │
│                                           │
│ 2. DynamoDB - 準ホットデータ             │
│    - ベンチマークキャッシュ               │
│    TTL: 30日                              │
│                                           │
│ 3. Aurora - コールドデータ                │
│    - マスターデータ                       │
│    - 履歴データ                           │
└──────────────────────────────────────────┘
```

---

## データベース管理

### マイグレーション

```bash
# Prisma Migrate
npx prisma migrate dev --name add_benchmark_tables
npx prisma migrate deploy  # Production

# ロールバック
npx prisma migrate resolve --rolled-back <migration_name>
```

### バックアップ

```yaml
Aurora Serverless v2:
  AutomatedBackups:
    RetentionPeriod: 35 days
    PreferredBackupWindow: "03:00-04:00"

  PITR (Point-in-Time Recovery):
    Enabled: true
    RecoveryWindow: 35 days

  Snapshots:
    Manual: 本番デプロイ前
    Automated: 日次
```

### モニタリング

```sql
-- スロークエリ検出
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- テーブルサイズ
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- インデックス使用状況
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

---

次のステップ: [API仕様](API_SPECIFICATION.md) → [ビジネス概要](BUSINESS_OVERVIEW.md)
