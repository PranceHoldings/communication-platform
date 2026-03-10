# サブスクリプション・プラン管理

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [プラン構成](#プラン構成)
3. [プラン管理UI](#プラン管理ui)
4. [Stripe統合](#stripe統合)
5. [プラン制限の実装](#プラン制限の実装)
6. [アップグレード・ダウングレード](#アップグレードダウングレード)
7. [請求管理](#請求管理)
8. [実装ガイド](#実装ガイド)

---

## 概要

サブスクリプション・プラン管理システムは、**スーパー管理者**がプラットフォーム全体のサブスクリプションプランを柔軟に設定・管理できる機能を提供します。

### 主要機能

| 機能                   | 説明                                                   |
| ---------------------- | ------------------------------------------------------ |
| **プラン設定UI**       | プラン名、価格、機能制限をGUIで設定                    |
| **デフォルトプラン**   | 新規組織の自動割り当てプラン設定                       |
| **機能制限管理**       | プランごとのリソース制限（セッション数、ストレージ等） |
| **Stripe統合**         | サブスクリプション決済、自動請求                       |
| **使用量トラッキング** | プラン制限に対する使用状況の監視                       |
| **アップグレード促進** | 制限到達時のアップグレード通知                         |
| **トライアル管理**     | 無料トライアル期間の設定・管理                         |

### 設計の背景

従来のSaaSプラットフォームでは、プラン変更にコードデプロイが必要でした。本システムでは、**コード変更なし**でプラン設定を変更できるよう、データベース駆動の設計を採用しています。

---

## プラン構成

### 標準プランテンプレート

| プラン         | 月額     | セッション数 | ストレージ | 同時接続 | サポート     | 主な機能                                         |
| -------------- | -------- | ------------ | ---------- | -------- | ------------ | ------------------------------------------------ |
| **Free**       | $0       | 10/月        | 1 GB       | 1        | コミュニティ | 基本アバター、標準シナリオ                       |
| **Pro**        | $99      | 100/月       | 10 GB      | 5        | メール       | カスタムアバター、音声クローニング、ベンチマーク |
| **Business**   | $299     | 500/月       | 50 GB      | 20       | 優先メール   | API連携、Webhook、詳細解析                       |
| **Enterprise** | カスタム | 無制限       | 500 GB+    | 100+     | 専任担当     | SLA保証、SSO、カスタムプロンプト、専用環境       |

### プランデータモデル

```typescript
interface SubscriptionPlan {
  id: string; // 'plan_free', 'plan_pro', 'plan_business', 'plan_enterprise'
  name: string; // 'Free Plan'
  displayName: string; // 'フリープラン'（多言語対応）
  description: string;

  // 価格設定
  pricing: {
    currency: 'USD' | 'JPY';
    amount: number; // 月額（セント単位）
    billingPeriod: 'month' | 'year';
    trialDays?: number; // 無料トライアル日数
  };

  // 機能制限
  limits: {
    // セッション関連
    sessionsPerMonth: number | null; // null = 無制限
    concurrentSessions: number;
    sessionDurationMax: number; // 分

    // ストレージ
    storageGB: number;
    recordingRetentionDays: number; // 録画保持期間

    // ユーザー・組織
    usersPerOrganization: number | null;
    subOrganizations: boolean; // サブ組織作成可否

    // 機能フラグ
    customAvatars: boolean;
    voiceCloning: boolean;
    apiAccess: boolean;
    webhooks: boolean;
    benchmark: boolean;
    advancedAnalytics: boolean;
    customPrompts: boolean;
    ssoIntegration: boolean;
    dedicatedSupport: boolean;
  };

  // 表示設定
  featured: boolean; // おすすめプラン
  sortOrder: number; // 表示順序
  status: 'active' | 'deprecated' | 'hidden';

  // Stripe連携
  stripeProductId?: string;
  stripePriceId?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

### 組織のサブスクリプション

```typescript
interface OrganizationSubscription {
  id: string;
  organizationId: string;
  planId: string; // 'plan_pro'

  // 状態
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date; // キャンセル予定日
  canceledAt?: Date; // キャンセル実行日

  // トライアル
  trialStart?: Date;
  trialEnd?: Date;

  // Stripe連携
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;

  // 使用量トラッキング
  usage: {
    sessionsThisMonth: number;
    storageUsedGB: number;
    usersCount: number;
    apiRequestsThisMonth: number;
  };

  // 請求情報
  billingDetails: {
    email: string;
    companyName?: string;
    taxId?: string;
    address?: Address;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

---

## プラン管理UI

### プラン一覧・編集画面（スーパー管理者専用）

```
┌──────────────────────────────────────────────────────────────┐
│ サブスクリプションプラン管理                  [+ 新規作成]   │
├──────────────────────────────────────────────────────────────┤
│ デフォルトプラン: Free Plan                   [変更]         │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 有効なプラン                                                  │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ ⭐ Free Plan                            [有効] [編集]   │   │
│ │ $0 / 月                                                │   │
│ │ - セッション: 10/月                                    │   │
│ │ - ストレージ: 1 GB                                     │   │
│ │ - 同時接続: 1                                          │   │
│ │ 契約中: 324組織                                        │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Pro Plan                                [有効] [編集]   │   │
│ │ $99 / 月                                               │   │
│ │ - セッション: 100/月                                   │   │
│ │ - ストレージ: 10 GB                                    │   │
│ │ - 同時接続: 5                                          │   │
│ │ - カスタムアバター、音声クローニング、ベンチマーク     │   │
│ │ 契約中: 87組織 | MRR: $8,613                           │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Business Plan                          [有効] [編集]   │   │
│ │ $299 / 月                                              │   │
│ │ - セッション: 500/月                                   │   │
│ │ - ストレージ: 50 GB                                    │   │
│ │ - 同時接続: 20                                         │   │
│ │ - API連携、Webhook、詳細解析                           │   │
│ │ 契約中: 23組織 | MRR: $6,877                           │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ Enterprise Plan                        [有効] [編集]   │   │
│ │ カスタム価格                                           │   │
│ │ - すべての機能を無制限で利用可能                       │   │
│ │ - SLA保証、SSO、専任サポート                           │   │
│ │ 契約中: 5組織 | MRR: $12,500（平均）                   │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 📊 サマリー                                                   │
│ 総組織数: 439                                                 │
│ MRR（月間経常収益）: $28,000                                  │
│ 平均LTV（顧客生涯価値）: $2,340                               │
└──────────────────────────────────────────────────────────────┘
```

### プラン編集画面

```
┌──────────────────────────────────────────────────────────────┐
│ プラン編集: Pro Plan                           [保存] [キャンセル] │
├──────────────────────────────────────────────────────────────┤
│ 基本情報                                                      │
│ プラン名: [Pro Plan                           ]              │
│ 表示名 (日本語): [プロプラン                  ]              │
│ 説明: [個人・小規模チーム向けの標準プラン    ]              │
│ ステータス: [有効 ▼]                                         │
│ おすすめプラン: ☑                                            │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 価格設定                                                      │
│ 通貨: [USD ▼]                                                │
│ 月額: [$99.00                ] / 月                           │
│ 年額: [$950.00               ] / 年 (20% OFF)                │
│ 無料トライアル: [14] 日                                      │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 機能制限                                                      │
│ セッション制限                                                │
│ 月間セッション数: [100] (無制限の場合は空欄)                 │
│ 同時セッション数: [5]                                        │
│ 最大セッション時間: [60] 分                                  │
│                                                               │
│ ストレージ制限                                                │
│ ストレージ容量: [10] GB                                       │
│ 録画保持期間: [90] 日                                        │
│                                                               │
│ ユーザー制限                                                  │
│ 組織内ユーザー数: [50] (無制限の場合は空欄)                  │
│ サブ組織作成: ☐                                              │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 機能フラグ                                                    │
│ ☑ カスタムアバター作成                                       │
│ ☑ 音声クローニング                                           │
│ ☐ API連携                                                    │
│ ☐ Webhook統合                                                │
│ ☑ ベンチマーク機能                                           │
│ ☐ 詳細解析                                                   │
│ ☐ カスタムプロンプト                                         │
│ ☐ SSO統合                                                    │
│ ☐ 専任サポート                                               │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Stripe連携                                                    │
│ Product ID: [prod_abc123...              ]                    │
│ Price ID (月額): [price_xyz789...            ]                │
│ Price ID (年額): [price_def456...            ]                │
│                                                               │
│ [保存] [キャンセル]                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Stripe統合

### Stripe設定フロー

```
1. Stripeアカウント作成・API キー取得
  ↓
2. Stripe製品・価格作成（Stripe Dashboard）
   - 製品: "Pro Plan"
   - 価格: $99/月（月額）、$950/年（年額）
  ↓
3. Prance管理画面でプラン設定
   - Stripe Product ID、Price IDを紐付け
  ↓
4. Webhook設定（Stripe → Prance）
   - イベント: invoice.paid, subscription.updated, etc.
  ↓
5. 組織がプラン契約
   - Checkout Session作成
   - Stripe Checkout UIで決済
  ↓
6. Webhook受信でサブスクリプション更新
```

### Stripeサブスクリプション作成

```typescript
// Lambda: Create Checkout Session
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const createCheckoutSession: APIGatewayProxyHandler = async event => {
  const { planId, billingPeriod } = JSON.parse(event.body);
  const { userId, organizationId } = event.requestContext.authorizer;

  // 1. プラン情報取得
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });

  if (!plan || !plan.stripePriceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid plan' }) };
  }

  // 2. Stripe顧客作成・取得
  let customer = await getOrCreateStripeCustomer(organizationId);

  // 3. Checkout Session作成
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: plan.pricing.trialDays,
      metadata: {
        organizationId,
        planId,
      },
    },
    success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/subscription/canceled`,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ sessionId: session.id, url: session.url }),
  };
};

// Stripe顧客作成
async function getOrCreateStripeCustomer(organizationId: string): Promise<Stripe.Customer> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
  });

  if (subscription?.stripeCustomerId) {
    return (await stripe.customers.retrieve(subscription.stripeCustomerId)) as Stripe.Customer;
  }

  // 新規作成
  const customer = await stripe.customers.create({
    email: org.billingEmail || org.adminEmail,
    name: org.name,
    metadata: { organizationId },
  });

  // DB保存
  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: { stripeCustomerId: customer.id },
  });

  return customer;
}
```

### Stripe Webhook処理

```typescript
// Lambda: Stripe Webhook Handler
export const handleStripeWebhook: APIGatewayProxyHandler = async event => {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // イベント処理
  switch (stripeEvent.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(stripeEvent.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(stripeEvent.data.object as Stripe.Invoice);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription);
      break;

    default:
      console.log(`Unhandled event type: ${stripeEvent.type}`);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

// チェックアウト完了
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { organizationId, planId } = session.metadata;

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: {
      planId,
      status: 'active',
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  // 通知送信
  await sendNotification(organizationId, {
    type: 'SUBSCRIPTION_ACTIVATED',
    message: 'サブスクリプションが有効化されました',
  });
}

// 請求成功
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const { organizationId } = subscription.metadata;

  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: {
      status: 'active',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  // 請求履歴記録
  await prisma.invoice.create({
    data: {
      organizationId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
      paidAt: new Date(invoice.status_transitions.paid_at * 1000),
    },
  });
}

// 請求失敗
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const { organizationId } = subscription.metadata;

  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: { status: 'past_due' },
  });

  // アラート送信
  await sendAlert(organizationId, {
    type: 'PAYMENT_FAILED',
    message: '請求処理に失敗しました。支払い方法を確認してください。',
  });
}
```

---

## プラン制限の実装

### 制限チェックミドルウェア

```typescript
// Lambda: Session Create
export const createSession: APIGatewayProxyHandler = async event => {
  const { organizationId } = event.requestContext.authorizer;

  // 1. プラン制限チェック
  const canCreate = await checkPlanLimit(organizationId, 'sessions');

  if (!canCreate) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: 'Plan limit exceeded',
        message: '月間セッション数の上限に達しました。プランをアップグレードしてください。',
        upgradeUrl: '/subscription/upgrade',
      }),
    };
  }

  // 2. セッション作成処理
  // ...
};

// プラン制限チェック
async function checkPlanLimit(
  organizationId: string,
  resource: 'sessions' | 'storage' | 'users' | 'api_requests'
): Promise<boolean> {
  // 組織のサブスクリプション取得
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });

  if (!subscription || subscription.status !== 'active') {
    return false; // サブスクリプション無効
  }

  const plan = subscription.plan;

  switch (resource) {
    case 'sessions':
      const limit = plan.limits.sessionsPerMonth;
      if (limit === null) return true; // 無制限

      const currentUsage = subscription.usage.sessionsThisMonth;
      return currentUsage < limit;

    case 'storage':
      const storageLimit = plan.limits.storageGB;
      const storageUsed = subscription.usage.storageUsedGB;
      return storageUsed < storageLimit;

    case 'users':
      const userLimit = plan.limits.usersPerOrganization;
      if (userLimit === null) return true; // 無制限

      const userCount = subscription.usage.usersCount;
      return userCount < userLimit;

    case 'api_requests':
      if (!plan.limits.apiAccess) return false; // API機能なし

      // レート制限チェック（別ロジック）
      return true;

    default:
      return false;
  }
}
```

### 使用量トラッキング

```typescript
// Lambda: Update Usage Stats (EventBridge定期実行)
export const updateUsageStats: ScheduledHandler = async () => {
  const organizations = await prisma.organization.findMany();

  for (const org of organizations) {
    // 今月のセッション数
    const sessionsCount = await prisma.session.count({
      where: {
        organizationId: org.id,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    // ストレージ使用量（S3）
    const storageUsed = await calculateStorageUsage(org.id);

    // ユーザー数
    const usersCount = await prisma.user.count({
      where: { organizationId: org.id },
    });

    // APIリクエスト数（DynamoDB）
    const apiRequests = await getAPIRequestCount(org.id);

    // 更新
    await prisma.organizationSubscription.update({
      where: { organizationId: org.id },
      data: {
        usage: {
          sessionsThisMonth: sessionsCount,
          storageUsedGB: storageUsed,
          usersCount,
          apiRequestsThisMonth: apiRequests,
        },
      },
    });

    // 制限到達チェック（80%到達で通知）
    await checkUsageLimitWarning(org.id);
  }
};

// 制限到達警告
async function checkUsageLimitWarning(organizationId: string) {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });

  const { usage, plan } = subscription;

  // セッション数チェック
  if (plan.limits.sessionsPerMonth !== null) {
    const sessionUsageRate = usage.sessionsThisMonth / plan.limits.sessionsPerMonth;

    if (sessionUsageRate >= 0.8 && sessionUsageRate < 1.0) {
      await sendNotification(organizationId, {
        type: 'USAGE_WARNING',
        message: `月間セッション数の80%（${usage.sessionsThisMonth}/${plan.limits.sessionsPerMonth}）に達しました。`,
      });
    } else if (sessionUsageRate >= 1.0) {
      await sendNotification(organizationId, {
        type: 'USAGE_LIMIT_REACHED',
        message: '月間セッション数の上限に達しました。プランをアップグレードしてください。',
      });
    }
  }

  // ストレージチェック
  const storageUsageRate = usage.storageUsedGB / plan.limits.storageGB;

  if (storageUsageRate >= 0.9) {
    await sendNotification(organizationId, {
      type: 'STORAGE_WARNING',
      message: `ストレージ使用量が90%（${usage.storageUsedGB}/${plan.limits.storageGB} GB）に達しました。`,
    });
  }
}
```

---

## アップグレード・ダウングレード

### アップグレードフロー

```
ユーザー → プラン変更画面
  ↓
新プラン選択（Pro → Business）
  ↓
確認画面
  - 差額: $200/月
  - 適用日: 即時
  - 日割り計算
  ↓
Stripe API: サブスクリプション更新
  ↓
DB更新
  ↓
機能制限解除（即時反映）
```

### プラン変更API

```typescript
// POST /api/v1/subscription/change
export const changeSubscriptionPlan: APIGatewayProxyHandler = async event => {
  const { newPlanId } = JSON.parse(event.body);
  const { organizationId } = event.requestContext.authorizer;

  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
  });

  if (!subscription?.stripeSubscriptionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No active subscription' }) };
  }

  const newPlan = await prisma.subscriptionPlan.findUnique({ where: { id: newPlanId } });

  // Stripeサブスクリプション更新
  const updatedSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [
      {
        id: (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0]
          .id,
        price: newPlan.stripePriceId,
      },
    ],
    proration_behavior: 'create_prorations', // 日割り計算
  });

  // DB更新
  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: {
      planId: newPlanId,
      currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
    },
  });

  // 通知送信
  await sendNotification(organizationId, {
    type: 'PLAN_CHANGED',
    message: `プランが${newPlan.name}に変更されました。`,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, newPlan }),
  };
};
```

---

## 請求管理

### 請求履歴

```
┌──────────────────────────────────────────────────────────────┐
│ 請求履歴                                                      │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 2026-03-01 | Pro Plan (月額)        $99.00  [請求書]  │   │
│ │ ステータス: 支払済                                     │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 2026-02-01 | Pro Plan (月額)        $99.00  [請求書]  │   │
│ │ ステータス: 支払済                                     │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 2026-01-01 | Pro Plan (月額)        $99.00  [請求書]  │   │
│ │ ステータス: 支払済                                     │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 実装ガイド

### データベーススキーマ

```sql
-- サブスクリプションプラン
CREATE TABLE subscription_plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  display_name JSONB, -- { "en": "Pro Plan", "ja": "プロプラン" }
  description TEXT,

  -- 価格設定
  pricing JSONB NOT NULL, -- { currency, amount, billingPeriod, trialDays }

  -- 機能制限
  limits JSONB NOT NULL,

  -- 表示設定
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',

  -- Stripe連携
  stripe_product_id VARCHAR(255),
  stripe_price_id VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 組織サブスクリプション
CREATE TABLE organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) UNIQUE,
  plan_id VARCHAR(50) REFERENCES subscription_plans(id),

  -- 状態
  status VARCHAR(20) NOT NULL,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at TIMESTAMP,
  canceled_at TIMESTAMP,

  -- トライアル
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,

  -- Stripe連携
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- 使用量
  usage JSONB, -- { sessionsThisMonth, storageUsedGB, usersCount, apiRequestsThisMonth }

  -- 請求情報
  billing_details JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 請求履歴
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  stripe_invoice_id VARCHAR(255) UNIQUE,

  amount INTEGER NOT NULL, -- セント単位
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL, -- 'paid', 'failed', 'pending'

  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_subscriptions_org ON organization_subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX idx_invoices_org ON invoices(organization_id, created_at DESC);
```

---

## まとめ

サブスクリプション・プラン管理システムは、以下の価値を提供します：

✅ **柔軟なプラン設定**: コード変更なしでプラン追加・変更が可能
✅ **自動請求**: Stripe統合により決済・請求を自動化
✅ **使用量トラッキング**: リアルタイムで制限到達を検知
✅ **スムーズなアップグレード**: 即時反映、日割り計算対応
✅ **透明性**: 請求履歴、使用状況の可視化

このシステムにより、プラットフォーム運営者は柔軟なプラン設計が可能になり、ユーザーは自分のニーズに合ったプランを選択できます。

---

**関連ドキュメント:**

- [外部連携API](EXTERNAL_API.md)
- [マルチテナント設計](../architecture/MULTITENANCY.md)
