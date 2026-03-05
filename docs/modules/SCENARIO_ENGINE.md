# シナリオエンジン

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [シナリオ設定スキーマ](#シナリオ設定スキーマ)
3. [シナリオビルダーUI構成](#シナリオビルダーui構成)
4. [System Prompt生成ロジック](#system-prompt生成ロジック)
5. [会話フロー制御](#会話フロー制御)
6. [データ構造](#データ構造)
7. [API仕様](#api仕様)
8. [実装ガイド](#実装ガイド)

---

## 概要

シナリオエンジンは、AIアバターとユーザーの会話をガイドするための中核システムです。ユーザーは特定の状況（面接、語学学習、営業トレーニング等）に合わせたシナリオを作成・管理し、AIアバターの役割、性格、会話フロー、評価基準をカスタマイズできます。

### 主要機能

| 機能 | 説明 | アクセス権限 |
| ---- | ---- | ---------- |
| **シナリオビルダー** | ノーコードでシナリオを作成・編集 | 全ユーザー |
| **プリセットシナリオ** | 即座に使える事前定義シナリオ | 全ユーザー |
| **カスタムシナリオ** | ユーザー独自のシナリオ作成 | 全ユーザー |
| **組織共有シナリオ** | 組織内でシナリオを共有 | Pro以上 |
| **System Prompt動的生成** | シナリオ設定からAIプロンプトを自動生成 | 全ユーザー |
| **会話フロー制御** | トピックの順序、深掘り質問の制御 | 全ユーザー |
| **評価基準設定** | カスタム評価指標と重み付け | Pro以上 |

### 設計方針

- **ノーコード**: プログラミング知識不要で誰でもシナリオ作成可能
- **柔軟性**: 多様な業界・用途に対応
- **再利用性**: シナリオのテンプレート化・共有
- **品質保証**: プレビュー機能でシナリオをテスト実行

---

## シナリオ設定スキーマ

### 基本スキーマ構造

```yaml
scenario:
  id: 'scenario_uuid'
  title: 'エンジニア採用面接 - 中級レベル'
  category: 'job_interview' # job_interview / language / customer_service / survey / sales / custom
  language: 'ja'
  max_duration_min: 30
  visibility: 'private' # private / organization / public

  # アバターキャラクター設定
  avatar_persona:
    role: 'HR Manager' # 役割
    personality: 'professional' # friendly / professional / strict / casual / skeptical
    pressure_level: 3 # 1-5 (圧力レベル)
    background: |
      IT企業の人事マネージャー。10年の採用経験があり、
      技術的な採用を専門とし、論理的思考を重視する。

  # 会話フロー設定
  conversation_flow:
    opening: '本日はお越しいただき、ありがとうございます。まずは自己紹介からお願いします。'
    required_topics:
      - '自己紹介・経歴'
      - '技術スキルの確認'
      - 'チームワーク経験'
      - '応募動機'
      - 'キャリアビジョン'
    follow_up_questions: true # 深掘り質問を有効化
    transition_style: 'natural' # natural / structured

  # インタラクション設定
  interaction_params:
    style: 'structured' # structured / free / mixed
    response_wait_sec: 30 # ユーザー応答の最大待機時間
    interruption: false # 割り込み許可

  # 評価基準（オプション）
  evaluation_criteria:
    - metric: '論理的説明力'
      weight: 0.30
      rubric: '具体例を用いて論理的に説明できている'
    - metric: 'アイコンタクト'
      weight: 0.20
      rubric: 'カメラを見ている時間の割合'
    - metric: '話す速度・間合い'
      weight: 0.20
      rubric: '適切なWPM (120-160) を維持している'
    - metric: '語彙・表現力'
      weight: 0.30
      rubric: 'ポジションに適した語彙を使用している'

  # レポートテンプレート
  report_template_id: 'tpl_interview_standard'
```

### カテゴリ別設定例

#### 1. 面接練習 (job_interview)

```yaml
scenario:
  title: '営業職採用面接'
  category: 'job_interview'
  avatar_persona:
    role: '営業部長'
    personality: 'friendly'
    pressure_level: 2
  conversation_flow:
    required_topics:
      - '営業経験・実績'
      - '顧客対応事例'
      - 'チーム協力'
      - '目標達成へのアプローチ'
  evaluation_criteria:
    - metric: 'コミュニケーション能力'
      weight: 0.40
    - metric: '実績の具体性'
      weight: 0.30
    - metric: '顧客志向'
      weight: 0.30
```

#### 2. 語学学習 (language)

```yaml
scenario:
  title: '英会話レッスン - ビジネス英語'
  category: 'language'
  language: 'en'
  avatar_persona:
    role: 'English Teacher'
    personality: 'friendly'
    pressure_level: 1
  conversation_flow:
    required_topics:
      - 'Self-introduction'
      - 'Daily activities'
      - 'Business situations'
      - 'Meeting scenarios'
  evaluation_criteria:
    - metric: '発音の正確性'
      weight: 0.30
    - metric: '文法の正確性'
      weight: 0.30
    - metric: '語彙の豊富さ'
      weight: 0.20
    - metric: '流暢さ'
      weight: 0.20
```

#### 3. カスタマーサービス (customer_service)

```yaml
scenario:
  title: 'クレーム対応トレーニング'
  category: 'customer_service'
  avatar_persona:
    role: '不満を持つ顧客'
    personality: 'strict'
    pressure_level: 4
  conversation_flow:
    opening: '先週購入した商品が壊れていました。どうしてくれるんですか？'
    required_topics:
      - '状況の確認'
      - '共感の表現'
      - '解決策の提案'
      - 'フォローアップ'
  evaluation_criteria:
    - metric: '共感力'
      weight: 0.35
    - metric: '問題解決力'
      weight: 0.35
    - metric: '冷静さ'
      weight: 0.30
```

#### 4. 営業トレーニング (sales)

```yaml
scenario:
  title: '新規顧客開拓ロールプレイ'
  category: 'sales'
  avatar_persona:
    role: '購買担当者'
    personality: 'skeptical'
    pressure_level: 3
    background: '予算に厳しく、具体的なROIデータを求める。過去に似た商品で失敗経験あり。'
  conversation_flow:
    required_topics:
      - '商品・サービス説明'
      - '価格・導入コスト'
      - 'ROI・効果測定'
      - '競合比較'
      - '導入事例'
  evaluation_criteria:
    - metric: '論理的説得力'
      weight: 0.40
    - metric: '顧客理解度'
      weight: 0.30
    - metric: '提案力'
      weight: 0.30
```

---

## シナリオビルダーUI構成

### メイン画面

```
┌──────────────────────────────────────────────────────────────┐
│ シナリオビルダー                      [プレビュー] [保存]     │
├──────────────────────────────────────────────────────────────┤
│ ① 基本設定                                                    │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ タイトル: [営業ロールプレイング - 新規顧客開拓       ]│   │
│ │ カテゴリ: [カスタマーサービス ▼]                      │   │
│ │ 言語:     [日本語 ▼]                                  │   │
│ │ 制限時間: [20    ] 分                                 │   │
│ │ 公開範囲: ○ 自分のみ  ○ 組織内共有  ○ 公開           │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ② アバターキャラクター設定                                    │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 役割:    [購買担当者                              ]   │   │
│ │ 性格:    [skeptical ▼] (懐疑的)                      │   │
│ │ 圧力レベル: ●●●○○ (3/5)                             │   │
│ │ 背景設定:                                             │   │
│ │ [大手企業の購買担当。予算に厳しく、具体的な      ]   │   │
│ │ [ROIデータを求める。過去に似た商品で失敗した     ]   │   │
│ │ [経験があり、慎重な姿勢。                        ]   │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ③ 会話フロー設定                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 開始の一言:                                           │   │
│ │ [お忙しいところすみません。どのようなご用件      ]   │   │
│ │ [でしょうか？                                    ]   │   │
│ │                                                        │   │
│ │ 必須トピック: (ドラッグで並び替え)                    │   │
│ │ ☰ 商品・サービス説明                                  │   │
│ │ ☰ 価格・導入コスト                                    │   │
│ │ ☰ ROI・効果測定                                       │   │
│ │ ☰ 競合比較                                            │   │
│ │ ☰ 導入事例                                            │   │
│ │ [+ トピック追加]                                      │   │
│ │                                                        │   │
│ │ 深掘り質問: ☑ 有効                                   │   │
│ │ 移行スタイル: ○ 自然  ○ 構造的                      │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ④ 評価基準設定（オプション）                                  │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ☑ 評価機能を有効化                                    │   │
│ │                                                        │   │
│ │ 論理的説明力: ████░░░░░░ 40%                        │   │
│ │ 顧客理解度:   ██████░░░░ 30%                        │   │
│ │ 提案力:       ██████░░░░ 30%                        │   │
│ │              合計: 100%                              │   │
│ │ [+ 評価基準追加]                                      │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ [キャンセル]                          [下書き保存] [公開]     │
└──────────────────────────────────────────────────────────────┘
```

### プレビュー画面

```
┌──────────────────────────────────────────────────────────────┐
│ シナリオプレビュー: 営業ロールプレイング          [✕ 閉じる] │
├──────────────────────────────────────────────────────────────┤
│ 📋 シナリオ情報                                               │
│ タイトル: 営業ロールプレイング - 新規顧客開拓                │
│ カテゴリ: カスタマーサービス                                  │
│ 制限時間: 20分                                                │
│                                                               │
│ 👤 アバターキャラクター                                       │
│ 役割: 購買担当者                                              │
│ 性格: 懐疑的 (Skeptical)                                      │
│ 圧力レベル: ●●●○○ (3/5)                                     │
│                                                               │
│ 💬 会話フロー                                                 │
│ 開始: 「お忙しいところすみません。どのようなご用件でしょうか？」 │
│ トピック:                                                     │
│   1. 商品・サービス説明                                       │
│   2. 価格・導入コスト                                         │
│   3. ROI・効果測定                                            │
│   4. 競合比較                                                 │
│   5. 導入事例                                                 │
│                                                               │
│ 📊 評価基準                                                   │
│   - 論理的説明力 (40%)                                        │
│   - 顧客理解度 (30%)                                          │
│   - 提案力 (30%)                                              │
│                                                               │
│ 🧪 テスト実行                                                 │
│ テストメッセージを入力してAIの応答を確認できます:             │
│ [メッセージを入力...]                           [送信]        │
│                                                               │
│ AIアバターの応答:                                             │
│ (テスト実行後に表示)                                          │
│                                                               │
│                           [編集に戻る]    [このシナリオで開始] │
└──────────────────────────────────────────────────────────────┘
```

### シナリオ一覧画面

```
┌──────────────────────────────────────────────────────────────┐
│ マイシナリオ                         [+ 新規作成] [プリセット] │
├──────────────────────────────────────────────────────────────┤
│ 🔍 検索・フィルター                                           │
│ [検索...]  カテゴリ: [すべて ▼]  公開範囲: [すべて ▼]       │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 📄 営業ロールプレイング - 新規顧客開拓        [編集][削除]│   │
│ │    カテゴリ: カスタマーサービス | 作成: 2026-03-01      │   │
│ │    使用回数: 12回 | 最終実施: 2026-03-04                │   │
│ │                                              [開始]       │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ 📄 エンジニア採用面接 - 中級                 [編集][削除]│   │
│ │    カテゴリ: 面接 | 作成: 2026-02-25                    │   │
│ │    使用回数: 5回 | 最終実施: 2026-03-03                 │   │
│ │                                              [開始]       │   │
│ ├────────────────────────────────────────────────────────┤   │
│ │ 📄 ビジネス英会話レッスン                    [編集][削除]│   │
│ │    カテゴリ: 語学学習 | 作成: 2026-02-20                │   │
│ │    使用回数: 23回 | 最終実施: 2026-03-05                │   │
│ │                                              [開始]       │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ページ: 1 / 3                                      [次へ →]   │
└──────────────────────────────────────────────────────────────┘
```

---

## System Prompt生成ロジック

シナリオ設定から、AI会話に使用するSystem Promptを動的に生成します。

### プロンプトテンプレート

```typescript
// プロンプトテンプレート（Handlebars形式）
const SCENARIO_PROMPT_TEMPLATE = `
あなたは{{avatar_persona.role}}です。

【キャラクター設定】
性格: {{avatar_persona.personality}}
背景: {{avatar_persona.background}}
圧力レベル: {{avatar_persona.pressure_level}}/5

【会話の目標】
以下のトピックを{{#if conversation_flow.follow_up_questions}}自然な流れでカバー{{else}}順番に確認{{/if}}すること:
{{#each conversation_flow.required_topics}}
- {{this}}
{{/each}}

【インタラクション規則】
- 制限時間: {{max_duration_min}}分を意識すること
- 一度に1つの質問のみする
{{#if interaction_params.follow_up_questions}}
- ユーザーの回答に基づいて深掘り質問をする
{{/if}}
{{#if interaction_params.transition_style}}
  {{#eq interaction_params.transition_style 'natural'}}
- トピック間の移行は自然に行う
  {{else}}
- トピックは構造的に順番に進める
  {{/eq}}
{{/if}}

【開始の一言】
{{conversation_flow.opening}}

【会話スタイル】
- ユーザーが{{interaction_params.response_wait_sec}}秒以内に応答しない場合は、促す
- {{#unless interaction_params.interruption}}ユーザーが話し終わるまで待つ{{/unless}}
- 性格「{{avatar_persona.personality}}」に忠実に振る舞う

【評価観点】（内部メモ）
{{#each evaluation_criteria}}
- {{this.metric}} (重み: {{this.weight}}) - {{this.rubric}}
{{/each}}
`;

// プロンプト生成関数
function generateSystemPrompt(scenario: Scenario): string {
  const template = Handlebars.compile(SCENARIO_PROMPT_TEMPLATE);
  return template(scenario);
}
```

### 生成例

**入力シナリオ:**

```yaml
avatar_persona:
  role: 'HR Manager'
  personality: 'professional'
  pressure_level: 3
  background: 'IT企業の人事マネージャー、10年の採用経験'
conversation_flow:
  opening: 'ありがとうございます。自己紹介からお願いします。'
  required_topics:
    - '自己紹介・経歴'
    - '技術スキル'
  follow_up_questions: true
  transition_style: 'natural'
interaction_params:
  response_wait_sec: 30
  interruption: false
max_duration_min: 30
evaluation_criteria:
  - metric: '論理的説明力'
    weight: 0.30
    rubric: '具体例を用いて論理的に説明'
```

**生成されたSystem Prompt:**

```
あなたはHR Managerです。

【キャラクター設定】
性格: professional
背景: IT企業の人事マネージャー、10年の採用経験
圧力レベル: 3/5

【会話の目標】
以下のトピックを自然な流れでカバーすること:
- 自己紹介・経歴
- 技術スキル

【インタラクション規則】
- 制限時間: 30分を意識すること
- 一度に1つの質問のみする
- ユーザーの回答に基づいて深掘り質問をする
- トピック間の移行は自然に行う

【開始の一言】
ありがとうございます。自己紹介からお願いします。

【会話スタイル】
- ユーザーが30秒以内に応答しない場合は、促す
- ユーザーが話し終わるまで待つ
- 性格「professional」に忠実に振る舞う

【評価観点】（内部メモ）
- 論理的説明力 (重み: 0.3) - 具体例を用いて論理的に説明
```

### カスタムプロンプト拡張

管理者は組織専用のプロンプトテンプレートをカスタマイズできます。

```typescript
// 組織カスタムプロンプトテンプレート
interface PromptTemplate {
  id: string;
  organizationId: string;
  name: string;
  template: string; // Handlebars テンプレート
  variables: PromptVariable[];
  category: 'interview' | 'language' | 'customer_service' | 'sales' | 'custom';
}

// プロンプトテンプレート管理API
async function applyCustomPromptTemplate(
  scenario: Scenario,
  templateId?: string
): Promise<string> {
  if (templateId) {
    // カスタムテンプレート使用
    const template = await prisma.promptTemplate.findUnique({
      where: { id: templateId },
    });
    return Handlebars.compile(template.template)(scenario);
  } else {
    // デフォルトテンプレート使用
    return generateSystemPrompt(scenario);
  }
}
```

---

## 会話フロー制御

シナリオエンジンは、AIアバターの会話進行を制御し、必須トピックをカバーしながら自然な対話を実現します。

### 会話状態管理

```typescript
// 会話状態の型定義
interface ConversationState {
  sessionId: string;
  scenarioId: string;
  currentTopicIndex: number; // 現在のトピック番号
  coveredTopics: string[]; // カバー済みトピック
  pendingTopics: string[]; // 未カバートピック
  totalTurns: number; // 会話ターン数
  startTime: Date;
  elapsedMinutes: number;
  userSilenceCount: number; // ユーザーの沈黙回数
}

// 会話状態コントローラー
class ConversationController {
  private state: ConversationState;
  private scenario: Scenario;

  constructor(sessionId: string, scenario: Scenario) {
    this.scenario = scenario;
    this.state = {
      sessionId,
      scenarioId: scenario.id,
      currentTopicIndex: 0,
      coveredTopics: [],
      pendingTopics: [...scenario.conversation_flow.required_topics],
      totalTurns: 0,
      startTime: new Date(),
      elapsedMinutes: 0,
      userSilenceCount: 0,
    };
  }

  /**
   * 次のAI発話を生成
   */
  async generateNextAIResponse(userInput: string): Promise<string> {
    // 会話状態を更新
    this.updateState(userInput);

    // トピックカバレッジをチェック
    const topicProgress = this.analyzeTopicCoverage(userInput);

    // AI応答を生成
    const systemPrompt = this.buildDynamicPrompt(topicProgress);
    const aiResponse = await this.callAIProvider(systemPrompt, userInput);

    // トピック移行判定
    if (topicProgress.currentTopicCovered) {
      this.moveToNextTopic();
    }

    return aiResponse;
  }

  /**
   * トピックカバレッジ分析
   */
  private analyzeTopicCoverage(userInput: string): TopicProgress {
    const currentTopic = this.state.pendingTopics[0];

    // ユーザーの回答が現在のトピックをカバーしているか判定
    const isCovered = this.checkTopicCovered(userInput, currentTopic);

    return {
      currentTopic,
      currentTopicCovered: isCovered,
      remainingTopics: this.state.pendingTopics.length,
      progress: this.state.coveredTopics.length /
                this.scenario.conversation_flow.required_topics.length,
    };
  }

  /**
   * 動的プロンプト構築
   */
  private buildDynamicPrompt(progress: TopicProgress): string {
    let prompt = this.scenario.systemPrompt;

    // 進捗に応じた指示を追加
    if (progress.remainingTopics > 0) {
      prompt += `\n\n【現在のフォーカス】\n次のトピックに焦点を当てること: ${progress.currentTopic}`;
    }

    // 時間制限の警告
    if (this.state.elapsedMinutes > this.scenario.max_duration_min * 0.8) {
      prompt += `\n\n【時間制限】\n残り時間が少ないため、簡潔に会話をまとめること。`;
    }

    // ユーザーの沈黙対応
    if (this.state.userSilenceCount > 2) {
      prompt += `\n\n【ユーザーサポート】\nユーザーが返答に困っているようです。具体例やヒントを提供してください。`;
    }

    return prompt;
  }

  /**
   * 次のトピックへ移行
   */
  private moveToNextTopic(): void {
    const completedTopic = this.state.pendingTopics.shift();
    if (completedTopic) {
      this.state.coveredTopics.push(completedTopic);
      this.state.currentTopicIndex++;
    }
  }

  /**
   * トピックカバー判定（簡易版）
   */
  private checkTopicCovered(userInput: string, topic: string): boolean {
    // 実際にはAIを使ってより高度な判定を行う
    const keywords = this.extractKeywords(topic);
    const userWords = userInput.toLowerCase();

    // キーワードの50%以上が含まれていればカバーと判定
    const matchCount = keywords.filter(kw => userWords.includes(kw)).length;
    return matchCount >= keywords.length * 0.5;
  }

  /**
   * 会話状態の更新
   */
  private updateState(userInput: string): void {
    this.state.totalTurns++;
    this.state.elapsedMinutes =
      (Date.now() - this.state.startTime.getTime()) / (1000 * 60);

    // ユーザーの沈黙カウント
    if (!userInput || userInput.trim().length < 10) {
      this.state.userSilenceCount++;
    } else {
      this.state.userSilenceCount = 0;
    }
  }

  /**
   * セッション完了判定
   */
  isSessionComplete(): boolean {
    return (
      this.state.pendingTopics.length === 0 ||
      this.state.elapsedMinutes >= this.scenario.max_duration_min
    );
  }
}
```

### 会話フロー例

```
トピック: ['自己紹介', '技術スキル', '応募動機']

Turn 1:
  AI: "ありがとうございます。自己紹介からお願いします。"
  User: "田中太郎と申します。5年間バックエンド開発をしています。"
  → トピック「自己紹介」カバー済み
  → pendingTopics: ['技術スキル', '応募動機']

Turn 2:
  AI: "ありがとうございます。では、具体的にどのような技術スタックを使用されてきましたか？"
  User: "主にNode.js、TypeScript、PostgreSQLを使用しています。"
  → トピック「技術スキル」カバー済み
  → pendingTopics: ['応募動機']

Turn 3:
  AI: "なるほど。それでは、今回弊社に応募された理由を教えていただけますか？"
  User: "御社のAI活用に興味があり、成長企業で挑戦したいと思いました。"
  → トピック「応募動機」カバー済み
  → pendingTopics: []
  → 会話完了
```

---

## データ構造

### Scenariosテーブル

```typescript
interface Scenario {
  id: string; // UUID
  userId: string; // 作成者ID
  organizationId: string;
  title: string; // シナリオタイトル
  category: ScenarioCategory;
  language: string; // 'ja', 'en'
  maxDurationMin: number; // 制限時間（分）
  visibility: 'private' | 'organization' | 'public';

  // アバターキャラクター
  avatarPersona: AvatarPersona;

  // 会話フロー
  conversationFlow: ConversationFlow;

  // インタラクション設定
  interactionParams: InteractionParams;

  // 評価基準（オプション）
  evaluationCriteria?: EvaluationCriterion[];

  // レポートテンプレート
  reportTemplateId?: string;

  // メタデータ
  metadata: ScenarioMetadata;

  // タイムスタンプ
  createdAt: Date;
  updatedAt: Date;
}

type ScenarioCategory =
  | 'job_interview'
  | 'language'
  | 'customer_service'
  | 'sales'
  | 'survey'
  | 'custom';

interface AvatarPersona {
  role: string; // 'HR Manager', 'Teacher', 'Customer'
  personality: 'friendly' | 'professional' | 'strict' | 'skeptical' | 'casual';
  pressureLevel: 1 | 2 | 3 | 4 | 5;
  background: string;
}

interface ConversationFlow {
  opening: string; // 開始の一言
  requiredTopics: string[]; // 必須トピック
  followUpQuestions: boolean; // 深掘り質問を有効化
  transitionStyle: 'natural' | 'structured';
}

interface InteractionParams {
  style: 'structured' | 'free' | 'mixed';
  responseWaitSec: number; // ユーザー応答待機時間
  interruption: boolean; // 割り込み許可
}

interface EvaluationCriterion {
  metric: string; // '論理的説明力'
  weight: number; // 0.0 - 1.0
  rubric: string; // 評価基準の説明
}

interface ScenarioMetadata {
  usageCount?: number; // 使用回数
  lastUsedAt?: Date;
  averageRating?: number; // 平均評価
  tags?: string[];
}
```

### Prismaスキーマ

```prisma
model Scenario {
  id                String   @id @default(uuid())
  userId            String
  organizationId    String
  title             String
  category          ScenarioCategory
  language          String
  maxDurationMin    Int
  visibility        ScenarioVisibility

  avatarPersona     Json
  conversationFlow  Json
  interactionParams Json
  evaluationCriteria Json?
  reportTemplateId  String?

  metadata          Json

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  user              User         @relation(fields: [userId], references: [id])
  organization      Organization @relation(fields: [organizationId], references: [id])
  sessions          Session[]

  @@index([userId])
  @@index([organizationId])
  @@index([category])
  @@index([visibility])
  @@map("scenarios")
}

enum ScenarioCategory {
  JOB_INTERVIEW
  LANGUAGE
  CUSTOMER_SERVICE
  SALES
  SURVEY
  CUSTOM
}

enum ScenarioVisibility {
  PRIVATE
  ORGANIZATION
  PUBLIC
}
```

---

## API仕様

### GET /api/v1/scenarios

シナリオ一覧取得

**Query Parameters:**
```typescript
{
  category?: ScenarioCategory;
  visibility?: 'private' | 'organization' | 'public';
  page?: number;
  limit?: number;
}
```

**Response:**
```typescript
{
  scenarios: Scenario[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}
```

### POST /api/v1/scenarios

シナリオ作成

**Request Body:**
```typescript
{
  title: string;
  category: ScenarioCategory;
  language: string;
  maxDurationMin: number;
  visibility: 'private' | 'organization' | 'public';
  avatarPersona: AvatarPersona;
  conversationFlow: ConversationFlow;
  interactionParams: InteractionParams;
  evaluationCriteria?: EvaluationCriterion[];
}
```

**Response:**
```typescript
{
  scenario: Scenario;
}
```

### PUT /api/v1/scenarios/:id

シナリオ更新

**Request Body:**
```typescript
Partial<Scenario>
```

**Response:**
```typescript
{
  scenario: Scenario;
}
```

### DELETE /api/v1/scenarios/:id

シナリオ削除

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

### POST /api/v1/scenarios/:id/test

シナリオテスト実行

**Request Body:**
```typescript
{
  message: string; // テストメッセージ
}
```

**Response:**
```typescript
{
  aiResponse: string;
  systemPrompt: string; // デバッグ用
}
```

---

## 実装ガイド

### フロントエンド: シナリオビルダー

```typescript
// components/scenario/ScenarioBuilder.tsx
import { useState } from 'react';
import { Scenario, AvatarPersona, ConversationFlow } from '@/types';

export function ScenarioBuilder() {
  const [scenario, setScenario] = useState<Partial<Scenario>>({
    title: '',
    category: 'job_interview',
    language: 'ja',
    maxDurationMin: 30,
    visibility: 'private',
    avatarPersona: {
      role: '',
      personality: 'professional',
      pressureLevel: 3,
      background: '',
    },
    conversationFlow: {
      opening: '',
      requiredTopics: [],
      followUpQuestions: true,
      transitionStyle: 'natural',
    },
    interactionParams: {
      style: 'structured',
      responseWaitSec: 30,
      interruption: false,
    },
  });

  async function saveScenario() {
    const response = await fetch('/api/v1/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    });
    const data = await response.json();
    console.log('Scenario created:', data.scenario);
  }

  return (
    <div className="scenario-builder">
      {/* 基本設定 */}
      <section>
        <h2>① 基本設定</h2>
        <input
          type="text"
          placeholder="タイトル"
          value={scenario.title}
          onChange={(e) => setScenario({ ...scenario, title: e.target.value })}
        />
        {/* ... その他の入力フィールド */}
      </section>

      {/* アバターキャラクター設定 */}
      <section>
        <h2>② アバターキャラクター設定</h2>
        <input
          type="text"
          placeholder="役割"
          value={scenario.avatarPersona?.role}
          onChange={(e) =>
            setScenario({
              ...scenario,
              avatarPersona: { ...scenario.avatarPersona!, role: e.target.value },
            })
          }
        />
        {/* ... その他の設定 */}
      </section>

      {/* 会話フロー設定 */}
      <section>
        <h2>③ 会話フロー設定</h2>
        <textarea
          placeholder="開始の一言"
          value={scenario.conversationFlow?.opening}
          onChange={(e) =>
            setScenario({
              ...scenario,
              conversationFlow: {
                ...scenario.conversationFlow!,
                opening: e.target.value,
              },
            })
          }
        />
        {/* トピック管理 */}
        <TopicList
          topics={scenario.conversationFlow?.requiredTopics || []}
          onChange={(topics) =>
            setScenario({
              ...scenario,
              conversationFlow: {
                ...scenario.conversationFlow!,
                requiredTopics: topics,
              },
            })
          }
        />
      </section>

      {/* 保存ボタン */}
      <button onClick={saveScenario}>保存</button>
    </div>
  );
}
```

### バックエンド: Lambda関数

```typescript
// lambda/scenarios/create/index.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const userId = event.requestContext.authorizer?.userId;

    // シナリオ作成
    const scenario = await prisma.scenario.create({
      data: {
        userId,
        organizationId: event.requestContext.authorizer?.organizationId,
        title: body.title,
        category: body.category,
        language: body.language,
        maxDurationMin: body.maxDurationMin,
        visibility: body.visibility,
        avatarPersona: body.avatarPersona,
        conversationFlow: body.conversationFlow,
        interactionParams: body.interactionParams,
        evaluationCriteria: body.evaluationCriteria,
        metadata: {},
      },
    });

    return {
      statusCode: 201,
      body: JSON.stringify({ scenario }),
    };
  } catch (error) {
    console.error('Scenario creation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
```

---

## まとめ

シナリオエンジンは、Pranceプラットフォームの多様な用途を実現する柔軟なシステムです。ノーコードのシナリオビルダーにより、誰でも簡単にカスタムシナリオを作成でき、AIアバターの振る舞いを細かく制御できます。

**次のステップ:**
- [アバターモジュール](AVATAR_MODULE.md) - アバター選択とリップシンク
- [音声モジュール](VOICE_MODULE.md) - TTS/STT統合
- [セッション録画](SESSION_RECORDING.md) - リアルタイムセッション実行

---

**最終更新:** 2026-03-05
**次回レビュー予定:** Phase 1 完了時
