# AIプロンプト・プロバイダ管理システム

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [なぜ管理者UIで実装するか](#なぜ管理者uiで実装するか)
3. [AIプロンプト管理](#aiプロンプト管理)
4. [AIプロバイダ管理](#aiプロバイダ管理)
5. [システムアーキテクチャ](#システムアーキテクチャ)
6. [実装ガイド](#実装ガイド)
7. [セキュリティ](#セキュリティ)

---

## 概要

AIプロンプト・プロバイダ管理システムは、**管理者専用**の機能として、コード変更なしでAI会話の挙動を制御・最適化するための中核システムです。

### 主要機能

| 機能 | 説明 | アクセス権限 |
| ---- | ---- | ---------- |
| **プロンプトテンプレート管理** | システムプロンプト、役割設定、会話ルールの動的管理 | スーパー管理者、組織管理者 |
| **プロバイダ管理** | AI Provider（Bedrock, OpenAI, Google AI等）の切り替え・設定 | スーパー管理者のみ |
| **バージョン管理** | プロンプト変更履歴、A/Bテスト、ロールバック | 組織管理者以上 |
| **テスト実行** | プロンプト変更前のリアルタイムテスト | 組織管理者以上 |
| **コスト管理** | プロバイダ別コスト追跡、予算アラート | スーパー管理者 |
| **フォールバック設定** | プロバイダ障害時の自動切り替え | スーパー管理者 |

### 設計の背景

従来の方式では、AIプロンプトやプロバイダ設定を変更する際に以下の課題がありました：

❌ **従来の方式（コードに直接記述）**
- プロンプト変更 → コード修正 → ビルド → テスト → デプロイ（1-2日）
- 顧客要望への迅速な対応が困難
- プロバイダ障害時の切り替えに時間がかかる
- Enterprise顧客の独自カスタマイズが不可能

✅ **管理者UI方式（本システム）**
- プロンプト変更 → 管理画面で編集 → 即座に反映（5分）
- リアルタイムテスト → 本番適用がスムーズ
- プロバイダ障害時の自動フォールバック
- 組織ごとの独自プロンプト設定が可能

---

## なぜ管理者UIで実装するか

### ビジネス上のメリット

#### 1. 開発サイクルの短縮

```
コード変更方式:  2-3日（修正 → レビュー → テスト → デプロイ）
管理UI方式:      5-10分（編集 → テスト → 適用）

→ 90%以上の時間短縮
```

#### 2. 顧客要望への柔軟な対応

**ユースケース例:**

```yaml
# Enterprise顧客A社の要望
要望: "面接官アバターの口調をもっとフレンドリーに"
対応: 管理画面でA社専用プロンプトを編集 → 5分で反映

# 従来方式の場合
対応: コード修正 → 本番デプロイ → 全顧客に影響（リスク大）
```

#### 3. リスク管理

```
プロバイダ障害発生
  ↓
自動フォールバック（Bedrock → OpenAI → Google AI）
  ↓
サービス継続（ダウンタイム最小化）
```

#### 4. コスト最適化

```typescript
// プロバイダごとのコスト比較（1Mトークンあたり）
const providerCosts = {
  'bedrock-claude-sonnet-4.6': { input: 3.0, output: 15.0 },  // $18 / 1M tokens
  'openai-gpt-4-turbo': { input: 10.0, output: 30.0 },        // $40 / 1M tokens
  'google-gemini-pro': { input: 0.5, output: 1.5 },           // $2 / 1M tokens
};

// 使用量に応じて自動切り替え
if (monthlyUsage > budgetThreshold) {
  switchToProvider('google-gemini-pro'); // コスト削減
}
```

---

## AIプロンプト管理

### プロンプトテンプレート構造

```typescript
interface PromptTemplate {
  id: string; // 'tpl_interview_default'
  name: string; // '面接官プロンプト（標準）'
  category: PromptCategory; // 'system' | 'scenario' | 'evaluation'
  organizationId?: string; // 組織固有のカスタムプロンプト
  isDefault: boolean; // デフォルトテンプレートか
  version: number; // バージョン番号
  status: 'draft' | 'active' | 'archived';

  // プロンプト本体
  systemPrompt: string; // システムプロンプト（役割定義）
  userPromptTemplate: string; // ユーザー入力テンプレート（変数含む）

  // 変数定義
  variables: PromptVariable[];

  // AI設定
  modelSettings: {
    temperature: number; // 0.0 - 1.0
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };

  // メタデータ
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  tags: string[];
}

interface PromptVariable {
  key: string; // '{{scenario_name}}'
  label: string; // 'シナリオ名'
  type: 'text' | 'number' | 'select' | 'multiline';
  required: boolean;
  defaultValue?: any;
  options?: string[]; // select型の場合
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}
```

### システムプロンプト例

```yaml
# 面接官アバター用システムプロンプト
systemPrompt: |
  あなたは{{company_name}}の{{job_position}}採用面接を担当するHRマネージャーです。

  **役割と責任:**
  - 候補者の{{evaluation_criteria}}を評価する
  - {{pressure_level}}の圧迫度で質問を行う
  - 専門性と親しみやすさのバランスを保つ

  **会話スタイル:**
  - {{conversation_style}}（例: フレンドリー、プロフェッショナル、厳格）
  - 1つの質問に対して、候補者の回答を深掘りする追加質問を最大{{max_follow_up}}回まで行う
  - 候補者が緊張している場合は、リラックスできるよう配慮する

  **必ず守るルール:**
  1. 不適切な質問（年齢、性別、家族構成等）は絶対に行わない
  2. 候補者の回答時間は最大{{response_timeout}}秒待つ
  3. 面接時間は{{max_duration}}分を超えないよう調整する
  4. 全ての必須トピック（{{required_topics}}）をカバーする

  **評価基準:**
  {{evaluation_rubric}}

variables:
  - company_name: "デフォルト株式会社"
  - job_position: "ソフトウェアエンジニア"
  - evaluation_criteria: "技術力、コミュニケーション能力、チームワーク"
  - pressure_level: "中程度（3/5）"
  - conversation_style: "プロフェッショナル"
  - max_follow_up: 2
  - response_timeout: 30
  - max_duration: 30
  - required_topics: "自己紹介、技術スキル、志望動機、キャリアビジョン"
  - evaluation_rubric: "5段階評価（1=不十分、5=優秀）"
```

### プロンプト管理UI

```
┌──────────────────────────────────────────────────────────────┐
│ AIプロンプト管理                        [+ 新規作成] [テスト実行] │
├──────────────────────────────────────────────────────────────┤
│ 📂 フィルター                                                 │
│ カテゴリ: [すべて] [システム] [シナリオ] [評価]              │
│ ステータス: [すべて] [有効] [下書き] [アーカイブ]            │
│ 組織: [デフォルト] [カスタム]                                │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ テンプレート一覧                                       │   │
│ │ ┌─────────────────────────────────────────────────┐  │   │
│ │ │ 📄 面接官プロンプト（標準）              [v3.2] │  │   │
│ │ │ カテゴリ: システム | ステータス: 有効          │  │   │
│ │ │ 使用中: 120セッション | 最終更新: 2026-03-04  │  │   │
│ │ │ [編集] [複製] [バージョン履歴] [削除]         │  │   │
│ │ └─────────────────────────────────────────────────┘  │   │
│ │                                                        │   │
│ │ ┌─────────────────────────────────────────────────┐  │   │
│ │ │ 📄 語学学習プロンプト（カジュアル）      [v2.0] │  │   │
│ │ │ カテゴリ: システム | ステータス: 有効          │  │   │
│ │ │ 使用中: 85セッション | 最終更新: 2026-03-01   │  │   │
│ │ │ [編集] [複製] [バージョン履歴] [削除]         │  │   │
│ │ └─────────────────────────────────────────────────┘  │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### プロンプト編集画面

```
┌──────────────────────────────────────────────────────────────┐
│ プロンプト編集: 面接官プロンプト（標準）v3.2                 │
├──────────────────────────────────────────────────────────────┤
│ 基本情報                                                      │
│ 名前: [面接官プロンプト（標準）                    ]         │
│ カテゴリ: [システム ▼]                                       │
│ 説明: [標準的な採用面接用のプロンプトテンプート ]           │
│ タグ: [面接] [採用] [標準]                                  │
│                                                               │
│ ─────────────────────────────────────────────────────────    │
│ システムプロンプト                        [変数挿入 ▼]       │
│ ┌──────────────────────────────────────────────────────┐     │
│ │ あなたは{{company_name}}の{{job_position}}採用       │     │
│ │ 面接を担当するHRマネージャーです。                   │     │
│ │                                                      │     │
│ │ **役割と責任:**                                      │     │
│ │ - 候補者の{{evaluation_criteria}}を評価する          │     │
│ │ - {{pressure_level}}の圧迫度で質問を行う            │     │
│ │ ...                                                  │     │
│ └──────────────────────────────────────────────────────┘     │
│                                                    [全画面表示] │
│ ─────────────────────────────────────────────────────────    │
│ 変数定義                                          [+ 追加]     │
│ ┌──────────────────────────────────────────────────────┐     │
│ │ 変数名: {{company_name}}                            │     │
│ │ ラベル: [会社名                       ]             │     │
│ │ タイプ: [テキスト ▼]                               │     │
│ │ 必須: ☑  デフォルト値: [デフォルト株式会社]        │     │
│ │ [保存] [削除]                                       │     │
│ └──────────────────────────────────────────────────────┘     │
│                                                               │
│ ─────────────────────────────────────────────────────────    │
│ AI設定                                                        │
│ Temperature: [0.7] (0.0 = 確定的、1.0 = 創造的)              │
│ Max Tokens: [2048]                                            │
│ Top P: [0.9]                                                  │
│                                                               │
│ ─────────────────────────────────────────────────────────    │
│ [キャンセル] [下書き保存] [テスト実行] [公開]                │
└──────────────────────────────────────────────────────────────┘
```

### バージョン管理

```typescript
interface PromptVersion {
  id: string;
  templateId: string;
  version: number;
  changelog: string; // 変更内容の説明
  createdBy: string;
  createdAt: Date;

  // スナップショット
  snapshot: {
    systemPrompt: string;
    variables: PromptVariable[];
    modelSettings: any;
  };

  // 統計情報
  stats?: {
    totalSessions: number; // このバージョンを使用したセッション数
    avgRating: number; // 平均評価
    errorRate: number; // エラー率
  };
}

// バージョン比較機能
interface VersionComparison {
  templateId: string;
  versionA: number;
  versionB: number;
  diff: {
    systemPrompt: DiffResult;
    variables: VariableDiff[];
    modelSettings: SettingsDiff;
  };
}
```

### テスト実行機能

```
┌──────────────────────────────────────────────────────────────┐
│ プロンプトテスト実行                              [閉じる]     │
├──────────────────────────────────────────────────────────────┤
│ テンプレート: 面接官プロンプト（標準）v3.2-draft            │
│ プロバイダ: [AWS Bedrock (Claude Sonnet 4.6) ▼]              │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ シナリオ設定（テスト用）                                      │
│ 会社名: [テスト株式会社           ]                          │
│ 職種: [バックエンドエンジニア      ]                         │
│ 評価基準: [技術力、問題解決能力    ]                         │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ テスト会話                                       [実行] [クリア] │
│ ┌──────────────────────────────────────────────────────┐     │
│ │ 🤖 AI: こんにちは。本日は面接にお越しいただき        │     │
│ │        ありがとうございます。まずは自己紹介を        │     │
│ │        お願いできますか？                            │     │
│ │                                                      │     │
│ │ 👤 You: [テスト用ユーザー入力を記入]                 │     │
│ │         [送信]                                       │     │
│ └──────────────────────────────────────────────────────┘     │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ デバッグ情報                                                  │
│ レスポンス時間: 1.2秒                                        │
│ 使用トークン数: 145 input + 89 output = 234 total           │
│ コスト: $0.0042 (1リクエストあたり)                          │
│                                                               │
│ [本番環境に公開]                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## AIプロバイダ管理

### サポートプロバイダ

| プロバイダ | モデル | 入力コスト | 出力コスト | 特徴 |
| ---------- | ------ | ---------- | ---------- | ---- |
| **AWS Bedrock** | Claude Sonnet 4.6 | $3.0/1M | $15.0/1M | 高品質、低レイテンシ、AWS統合 |
| **OpenAI** | GPT-4 Turbo | $10.0/1M | $30.0/1M | 高性能、広範な知識 |
| **Google AI** | Gemini Pro | $0.5/1M | $1.5/1M | コスト効率、多言語対応 |
| **Azure OpenAI** | GPT-4 | $10.0/1M | $30.0/1M | Enterprise向け、SLA保証 |

### プロバイダ設定UI

```
┌──────────────────────────────────────────────────────────────┐
│ AIプロバイダ管理（スーパー管理者専用）                        │
├──────────────────────────────────────────────────────────────┤
│ 有効なプロバイダ                                [+ 追加]       │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🟢 AWS Bedrock (Claude Sonnet 4.6)         [優先度: 1] │   │
│ │ ステータス: 有効 | API正常                              │   │
│ │ 使用率: 78% (今月) | コスト: $1,234.56                  │   │
│ │ [設定] [テスト] [無効化]                                │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🟡 OpenAI (GPT-4 Turbo)                    [優先度: 2] │   │
│ │ ステータス: フォールバック | API正常                    │   │
│ │ 使用率: 12% (今月) | コスト: $345.67                    │   │
│ │ [設定] [テスト] [無効化]                                │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ⚪ Google AI (Gemini Pro)                 [優先度: 3] │   │
│ │ ステータス: 待機中 | API正常                            │   │
│ │ 使用率: 0% (今月) | コスト: $0.00                       │   │
│ │ [設定] [テスト] [有効化]                                │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ フォールバック設定                                            │
│ ☑ プロバイダ障害時の自動切り替えを有効にする                 │
│ 切り替え条件:                                                 │
│   - エラー率が5%を超えた場合                                 │
│   - レスポンス時間が5秒を超えた場合                          │
│   - API Quota超過の場合                                      │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ コスト管理                                                    │
│ 月間予算: [$5,000]                                            │
│ 今月の使用: $1,580.23 (31.6%)                                │
│ アラート設定: 80%到達時に通知                                │
│                                                               │
│ [変更を保存]                                                  │
└──────────────────────────────────────────────────────────────┘
```

### プロバイダ設定データモデル

```typescript
interface AIProvider {
  id: string; // 'bedrock-claude-sonnet-4.6'
  name: string; // 'AWS Bedrock (Claude Sonnet 4.6)'
  provider: 'bedrock' | 'openai' | 'google' | 'azure';
  modelId: string; // 'us.anthropic.claude-sonnet-4-6'

  // 接続設定
  config: {
    apiKey?: string; // Secrets Managerから取得
    endpoint?: string;
    region?: string; // AWS専用
    version?: string;
  };

  // 優先順位（フォールバック用）
  priority: number; // 1 = 最優先、2 = 第2候補...
  status: 'active' | 'standby' | 'disabled' | 'error';

  // コスト設定
  pricing: {
    inputCostPer1M: number; // $3.0
    outputCostPer1M: number; // $15.0
    currency: 'USD';
  };

  // 制限設定
  limits: {
    maxTokensPerRequest: number;
    maxRequestsPerMinute: number;
    maxRequestsPerDay: number;
  };

  // 健全性チェック
  health: {
    lastCheck: Date;
    isHealthy: boolean;
    latency: number; // ms
    errorRate: number; // 0.0 - 1.0
  };

  // 統計情報
  stats: {
    totalRequests: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    totalCost: number;
    lastUsed: Date;
  };
}
```

### フォールバックロジック

```typescript
// プロバイダ選択ロジック
async function selectAIProvider(
  organizationId: string,
  scenario: Scenario
): Promise<AIProvider> {
  // 1. 組織固有のプロバイダ設定を確認
  const orgProviders = await getOrganizationProviders(organizationId);

  // 2. 優先順位順にソート
  const sortedProviders = orgProviders
    .filter(p => p.status === 'active' || p.status === 'standby')
    .sort((a, b) => a.priority - b.priority);

  // 3. 各プロバイダの健全性をチェック
  for (const provider of sortedProviders) {
    const health = await checkProviderHealth(provider);

    if (health.isHealthy && health.errorRate < 0.05 && health.latency < 5000) {
      // 健全性OK → このプロバイダを使用
      return provider;
    } else {
      // 健全性NG → 次の候補へ
      logger.warn(`Provider ${provider.id} unhealthy, trying fallback`);
      await sendAlert({
        type: 'PROVIDER_FALLBACK',
        providerId: provider.id,
        reason: health,
      });
      continue;
    }
  }

  // 4. すべてのプロバイダが使用不可の場合
  throw new Error('No healthy AI provider available');
}

// 健全性チェック
async function checkProviderHealth(provider: AIProvider): Promise<HealthCheck> {
  try {
    const startTime = Date.now();

    // 簡単なテストリクエストを送信
    const response = await provider.client.generate({
      prompt: 'Test health check',
      maxTokens: 10,
      temperature: 0,
    });

    const latency = Date.now() - startTime;

    return {
      isHealthy: true,
      latency,
      errorRate: provider.health.errorRate,
    };
  } catch (error) {
    return {
      isHealthy: false,
      latency: 0,
      errorRate: 1.0,
      error: error.message,
    };
  }
}
```

---

## システムアーキテクチャ

### データフロー

```
┌────────────────┐
│ 管理者UI       │
│ (Next.js)      │
└────────┬───────┘
         │ REST API
         ▼
┌────────────────────────────────────┐
│ Lambda: Prompt Management          │
│ - CRUD操作                         │
│ - バージョン管理                    │
│ - テスト実行                        │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Aurora Serverless v2               │
│ テーブル:                          │
│ - prompt_templates                 │
│ - prompt_versions                  │
│ - ai_providers                     │
│ - provider_usage_stats             │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Lambda: Session Handler            │
│ 1. プロンプト取得                  │
│ 2. 変数置換                        │
│ 3. プロバイダ選択（フォールバック）│
│ 4. AI API呼び出し                  │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ AI Provider (Bedrock/OpenAI/etc)   │
└────────────────────────────────────┘
```

### データベーススキーマ

```sql
-- プロンプトテンプレート
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'system', 'scenario', 'evaluation'
  organization_id UUID REFERENCES organizations(id), -- NULL = グローバルテンプレート
  is_default BOOLEAN DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'archived'

  -- プロンプト内容
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT,
  variables JSONB, -- PromptVariable[]
  model_settings JSONB, -- { temperature, maxTokens, etc. }

  -- メタデータ
  description TEXT,
  tags TEXT[],
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(organization_id, name, version)
);

-- プロンプトバージョン履歴
CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  changelog TEXT,
  snapshot JSONB NOT NULL, -- 完全なスナップショット
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- 統計情報（後から更新）
  total_sessions INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2),
  error_rate DECIMAL(5,4),

  UNIQUE(template_id, version)
);

-- AIプロバイダ設定
CREATE TABLE ai_providers (
  id VARCHAR(100) PRIMARY KEY, -- 'bedrock-claude-sonnet-4.6'
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'bedrock', 'openai', 'google', 'azure'
  model_id VARCHAR(255) NOT NULL,

  -- 接続設定（暗号化推奨）
  config JSONB, -- { endpoint, region, version }
  secret_arn VARCHAR(255), -- Secrets Manager ARN for API keys

  -- 優先順位
  priority INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'standby', 'disabled', 'error'

  -- コスト設定
  pricing JSONB, -- { inputCostPer1M, outputCostPer1M }

  -- 制限設定
  limits JSONB, -- { maxTokensPerRequest, maxRPM, maxRPD }

  -- 健全性
  health JSONB, -- { lastCheck, isHealthy, latency, errorRate }

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- プロバイダ使用統計
CREATE TABLE provider_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id VARCHAR(100) REFERENCES ai_providers(id),
  organization_id UUID REFERENCES organizations(id),
  date DATE NOT NULL,

  total_requests INTEGER DEFAULT 0,
  total_tokens_input BIGINT DEFAULT 0,
  total_tokens_output BIGINT DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  avg_latency INTEGER, -- ms
  error_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(provider_id, organization_id, date)
);

-- インデックス
CREATE INDEX idx_prompt_templates_org ON prompt_templates(organization_id, status);
CREATE INDEX idx_prompt_templates_category ON prompt_templates(category, is_default);
CREATE INDEX idx_prompt_versions_template ON prompt_versions(template_id, version);
CREATE INDEX idx_provider_stats_date ON provider_usage_stats(provider_id, date DESC);
```

---

## 実装ガイド

### 1. プロンプト取得と変数置換

```typescript
// Lambda: Session Handler
import { PromptEngine } from '@/lib/prompt-engine';

async function handleSessionStart(event: SessionStartEvent) {
  const { scenarioId, organizationId, userId } = event;

  // 1. シナリオ情報を取得
  const scenario = await getScenario(scenarioId);

  // 2. プロンプトテンプレートを取得（組織カスタム → デフォルトの順）
  const promptTemplate = await PromptEngine.getTemplate({
    category: 'system',
    organizationId,
    scenarioCategory: scenario.category,
  });

  // 3. 変数を置換
  const resolvedPrompt = await PromptEngine.resolve(promptTemplate, {
    company_name: scenario.avatar_persona.company_name,
    job_position: scenario.avatar_persona.job_position,
    evaluation_criteria: scenario.evaluation_criteria.map(c => c.metric).join(', '),
    // ... その他の変数
  });

  // 4. プロバイダを選択
  const provider = await selectAIProvider(organizationId, scenario);

  // 5. セッション状態を保存
  await saveSessionState({
    sessionId: event.sessionId,
    promptTemplateId: promptTemplate.id,
    providerId: provider.id,
    resolvedPrompt,
  });

  return {
    systemPrompt: resolvedPrompt.systemPrompt,
    modelSettings: resolvedPrompt.modelSettings,
    provider,
  };
}
```

### 2. AI APIコール（プロバイダ抽象化）

```typescript
// lib/ai-client/index.ts
export interface AIClient {
  generate(params: GenerateParams): Promise<GenerateResponse>;
  stream(params: GenerateParams): AsyncIterable<StreamChunk>;
}

export interface GenerateParams {
  systemPrompt: string;
  messages: Message[];
  temperature: number;
  maxTokens: number;
  // ...
}

export interface GenerateResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  latency: number;
}

// プロバイダファクトリ
export function createAIClient(provider: AIProvider): AIClient {
  switch (provider.provider) {
    case 'bedrock':
      return new BedrockClient(provider);
    case 'openai':
      return new OpenAIClient(provider);
    case 'google':
      return new GoogleAIClient(provider);
    case 'azure':
      return new AzureOpenAIClient(provider);
    default:
      throw new Error(`Unknown provider: ${provider.provider}`);
  }
}

// Bedrock実装例
class BedrockClient implements AIClient {
  private client: BedrockRuntimeClient;

  constructor(private provider: AIProvider) {
    this.client = new BedrockRuntimeClient({
      region: provider.config.region || 'us-east-1',
    });
  }

  async generate(params: GenerateParams): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.send(new InvokeModelCommand({
        modelId: this.provider.modelId,
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          system: params.systemPrompt,
          messages: params.messages,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
        }),
      }));

      const result = JSON.parse(new TextDecoder().decode(response.body));

      // 統計情報を記録
      await recordProviderUsage({
        providerId: this.provider.id,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        latency: Date.now() - startTime,
        success: true,
      });

      return {
        text: result.content[0].text,
        usage: {
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
        },
        latency: Date.now() - startTime,
      };
    } catch (error) {
      // エラーを記録
      await recordProviderUsage({
        providerId: this.provider.id,
        success: false,
        error: error.message,
      });

      throw error;
    }
  }
}
```

### 3. プロンプトテンプレートCRUD API

```typescript
// Lambda: Prompt Management
import { APIGatewayProxyHandler } from 'aws-lambda';

// プロンプトテンプレート一覧取得
export const listTemplates: APIGatewayProxyHandler = async (event) => {
  const { organizationId, category, status } = event.queryStringParameters || {};

  const templates = await prisma.promptTemplate.findMany({
    where: {
      OR: [
        { organizationId }, // 組織固有
        { organizationId: null, isDefault: true }, // グローバルデフォルト
      ],
      ...(category && { category }),
      ...(status && { status }),
    },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ templates }),
  };
};

// プロンプトテンプレート作成
export const createTemplate: APIGatewayProxyHandler = async (event) => {
  const data = JSON.parse(event.body);
  const { userId, organizationId } = event.requestContext.authorizer;

  // 権限チェック（組織管理者以上）
  await checkPermission(userId, organizationId, 'manage_prompts');

  const template = await prisma.promptTemplate.create({
    data: {
      ...data,
      organizationId,
      createdBy: userId,
      updatedBy: userId,
      version: 1,
    },
  });

  // 初期バージョンを記録
  await prisma.promptVersion.create({
    data: {
      templateId: template.id,
      version: 1,
      changelog: 'Initial version',
      snapshot: {
        systemPrompt: template.systemPrompt,
        variables: template.variables,
        modelSettings: template.modelSettings,
      },
      createdBy: userId,
    },
  });

  return {
    statusCode: 201,
    body: JSON.stringify({ template }),
  };
};

// プロンプトテンプレート更新（新バージョン作成）
export const updateTemplate: APIGatewayProxyHandler = async (event) => {
  const { id } = event.pathParameters;
  const data = JSON.parse(event.body);
  const { userId, organizationId } = event.requestContext.authorizer;

  const current = await prisma.promptTemplate.findUnique({ where: { id } });

  // 権限チェック
  await checkPermission(userId, organizationId, 'manage_prompts');

  // 新バージョンを作成
  const newVersion = current.version + 1;

  const updated = await prisma.promptTemplate.update({
    where: { id },
    data: {
      ...data,
      version: newVersion,
      updatedBy: userId,
      updatedAt: new Date(),
    },
  });

  // バージョン履歴を記録
  await prisma.promptVersion.create({
    data: {
      templateId: id,
      version: newVersion,
      changelog: data.changelog || 'Updated',
      snapshot: {
        systemPrompt: updated.systemPrompt,
        variables: updated.variables,
        modelSettings: updated.modelSettings,
      },
      createdBy: userId,
    },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ template: updated }),
  };
};
```

---

## セキュリティ

### アクセス制御

```typescript
// 権限レベル
enum PromptPermission {
  VIEW = 'prompts:view',           // 閲覧（すべてのユーザー）
  MANAGE = 'prompts:manage',       // 管理（組織管理者以上）
  MANAGE_PROVIDERS = 'providers:manage', // プロバイダ管理（スーパー管理者のみ）
}

// 権限チェック
async function checkPromptPermission(
  userId: string,
  organizationId: string,
  permission: PromptPermission
): Promise<boolean> {
  const user = await getUser(userId);

  switch (permission) {
    case PromptPermission.VIEW:
      // すべてのユーザーが閲覧可能
      return true;

    case PromptPermission.MANAGE:
      // 組織管理者以上
      return user.role === 'client_admin' || user.role === 'super_admin';

    case PromptPermission.MANAGE_PROVIDERS:
      // スーパー管理者のみ
      return user.role === 'super_admin';

    default:
      return false;
  }
}
```

### API Key管理

```typescript
// AWS Secrets Managerを使用
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getProviderAPIKey(provider: AIProvider): Promise<string> {
  if (!provider.secret_arn) {
    throw new Error(`No secret ARN configured for provider ${provider.id}`);
  }

  const client = new SecretsManagerClient({ region: 'us-east-1' });

  const response = await client.send(new GetSecretValueCommand({
    SecretId: provider.secret_arn,
  }));

  const secret = JSON.parse(response.SecretString);
  return secret.api_key;
}

// Lambda環境変数には保存しない（セキュリティリスク）
```

### 監査ログ

```sql
-- プロンプト変更履歴
CREATE TABLE prompt_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES prompt_templates(id),
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'published'
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),

  -- 変更内容
  changes JSONB, -- { before, after }

  -- メタデータ
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- プロバイダアクセスログ
CREATE TABLE provider_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id VARCHAR(100) REFERENCES ai_providers(id),
  session_id UUID REFERENCES sessions(id),

  -- リクエスト情報
  request_data JSONB, -- { prompt, settings }
  response_data JSONB, -- { text, usage }

  -- 結果
  success BOOLEAN,
  error_message TEXT,
  latency INTEGER, -- ms

  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_audit_logs_template ON prompt_audit_logs(template_id, timestamp DESC);
CREATE INDEX idx_access_logs_provider ON provider_access_logs(provider_id, timestamp DESC);
```

---

## まとめ

AIプロンプト・プロバイダ管理システムは、以下の価値を提供します：

✅ **開発速度の向上**: プロンプト変更を5分で反映（従来比90%短縮）
✅ **顧客要望への柔軟な対応**: 組織ごとの独自カスタマイズが可能
✅ **リスク管理**: プロバイダ障害時の自動フォールバック
✅ **コスト最適化**: プロバイダ別コスト追跡・予算管理
✅ **品質向上**: A/Bテスト、バージョン管理、ロールバック機能

このシステムにより、**コード変更なし**でAI会話の挙動を制御・最適化でき、ビジネスの成長に合わせて柔軟に対応できるプラットフォームが実現します。

---

**関連ドキュメント:**
- [システムアーキテクチャ](../architecture/SYSTEM_ARCHITECTURE.md)
- [API設計](../development/API_DESIGN.md)
- [データベース設計](../development/DATABASE_DESIGN.md)
