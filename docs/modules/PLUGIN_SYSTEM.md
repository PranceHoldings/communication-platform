# プラグインシステム

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [プラグインアーキテクチャ](#プラグインアーキテクチャ)
3. [プラグインSDK](#プラグインsdk)
4. [マニフェスト仕様](#マニフェスト仕様)
5. [セキュリティ](#セキュリティ)
6. [プラグインマーケットプレイス](#プラグインマーケットプレイス)
7. [実装ガイド](#実装ガイド)

---

## 概要

プラグインシステムは、サードパーティ開発者がPranceプラットフォームの機能を拡張できる、**拡張可能なアーキテクチャ**を提供します。

### 主要機能

| 機能                   | 説明                                           |
| ---------------------- | ---------------------------------------------- |
| **プラグインSDK**      | TypeScript/JavaScript SDKでプラグイン開発      |
| **ホットロード**       | プラグインの動的読み込み・更新                 |
| **サンドボックス実行** | セキュアな隔離環境でプラグイン実行             |
| **APIアクセス制御**    | 権限スコープによるアクセス制限                 |
| **ライフサイクル管理** | インストール・有効化・無効化・アンインストール |
| **マーケットプレイス** | プラグインの公開・配布・レビュー（将来実装）   |

### プラグインタイプ

| タイプ           | 説明                                     | 例                                   |
| ---------------- | ---------------------------------------- | ------------------------------------ |
| **UI拡張**       | ダッシュボードにカスタムウィジェット追加 | Analytics Dashboard, Custom Reports  |
| **データ連携**   | 外部サービスとのデータ同期               | Salesforce Connector, Slack Notifier |
| **カスタム解析** | 独自の解析ロジック追加                   | Industry-specific Analysis           |
| **レポート拡張** | カスタムレポートテンプレート             | Company Branding Templates           |
| **Webhook処理**  | 外部イベントへの反応                     | Zapier Integration                   |

### ユースケース

#### ユースケース1: Slack通知プラグイン

```
セッション完了 → プラグイン実行 → Slackチャンネルに通知
```

#### ユースケース2: カスタム解析プラグイン

```
医療業界向けコミュニケーションスキル解析
→ 専門用語使用率、患者への配慮表現チェック
```

#### ユースケース3: ダッシュボードウィジェット

```
組織独自のKPI可視化ウィジェット
→ ダッシュボードに埋め込み表示
```

---

## プラグインアーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│ Prance Core Platform                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Plugin Manager                                          │ │
│ │ - ライフサイクル管理                                    │ │
│ │ - 権限チェック                                          │ │
│ │ - イベントディスパッチ                                  │ │
│ └────────────┬────────────────────────────────────────────┘ │
│              │                                               │
│              ▼                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Plugin Sandbox (Lambda Isolate / VM2)                   │ │
│ │ ┌───────────┐ ┌───────────┐ ┌───────────┐             │ │
│ │ │ Plugin A  │ │ Plugin B  │ │ Plugin C  │             │ │
│ │ │ (Slack)   │ │ (Custom   │ │ (Zapier)  │             │ │
│ │ │           │ │  Analytics)│ │           │             │ │
│ │ └───────────┘ └───────────┘ └───────────┘             │ │
│ └─────────────────────────────────────────────────────────┘ │
│              │                                               │
│              ▼                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Plugin API (制限付きアクセス)                           │ │
│ │ - Sessions API                                          │ │
│ │ - Reports API                                           │ │
│ │ - Users API (Read Only)                                 │ │
│ │ - Webhooks API                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### プラグインライフサイクル

```
開発 → パッケージング → インストール → 有効化 → 実行 → 無効化 → アンインストール
```

**詳細フロー:**

```
1. 開発
   - プラグインSDKを使用してコード作成
   - マニフェストファイル作成
   - ローカルテスト

2. パッケージング
   - npm build
   - .zip ファイル生成（コード + マニフェスト）

3. インストール
   - 管理画面からアップロード
   - マニフェスト検証
   - S3にアップロード
   - DBに登録

4. 有効化
   - 管理者が有効化ボタンをクリック
   - 権限確認
   - 初期化処理実行
   - イベントリスナー登録

5. 実行
   - イベント発火時に自動実行
   - または手動トリガー

6. 無効化
   - イベントリスナー解除
   - クリーンアップ処理実行

7. アンインストール
   - 設定データ削除
   - S3からファイル削除
   - DB登録削除
```

---

## プラグインSDK

### インストール

```bash
npm install @prance/plugin-sdk
```

### 基本構造

```typescript
// plugins/slack-notifier/src/index.ts
import { Plugin, PluginContext, SessionCompletedEvent } from '@prance/plugin-sdk';

export default class SlackNotifierPlugin extends Plugin {
  // 初期化
  async onInstall(context: PluginContext): Promise<void> {
    console.log('Slack Notifier installed');
  }

  // 有効化時
  async onEnable(context: PluginContext): Promise<void> {
    console.log('Slack Notifier enabled');

    // 設定を取得
    const webhookUrl = await context.settings.get('webhookUrl');
    if (!webhookUrl) {
      throw new Error('Slack Webhook URL is not configured');
    }
  }

  // イベントハンドラー登録
  async onRegisterEvents(context: PluginContext): Promise<void> {
    // セッション完了イベントをリスン
    context.events.on('session.completed', this.handleSessionCompleted.bind(this));
  }

  // セッション完了ハンドラー
  async handleSessionCompleted(
    event: SessionCompletedEvent,
    context: PluginContext
  ): Promise<void> {
    const { session, report } = event;

    // レポート情報取得
    const summary = `
セッション完了通知
━━━━━━━━━━━━━━━
ユーザー: ${session.userName}
シナリオ: ${session.scenarioName}
総合スコア: ${report.overallScore}/100
所要時間: ${session.duration}分

詳細: ${context.buildUrl(`/sessions/${session.id}/report`)}
    `;

    // Slack Webhook送信
    const webhookUrl = await context.settings.get('webhookUrl');

    await context.http.post(webhookUrl, {
      text: summary,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*セッション完了通知*\n${summary}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'レポートを見る' },
              url: context.buildUrl(`/sessions/${session.id}/report`),
            },
          ],
        },
      ],
    });

    // ログ記録
    context.logger.info('Slack notification sent', { sessionId: session.id });
  }

  // 無効化時
  async onDisable(context: PluginContext): Promise<void> {
    console.log('Slack Notifier disabled');
  }

  // アンインストール時
  async onUninstall(context: PluginContext): Promise<void> {
    console.log('Slack Notifier uninstalled');
    // 設定データ削除
    await context.settings.clear();
  }
}
```

### Plugin Context API

```typescript
interface PluginContext {
  // プラグイン情報
  plugin: {
    id: string;
    name: string;
    version: string;
  };

  // 組織情報
  organization: {
    id: string;
    name: string;
    plan: string;
  };

  // 設定管理
  settings: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
    getAll(): Promise<Record<string, any>>;
    clear(): Promise<void>;
  };

  // イベントシステム
  events: {
    on(event: string, handler: Function): void;
    off(event: string, handler: Function): void;
    emit(event: string, data: any): void;
  };

  // HTTP クライアント（外部API呼び出し）
  http: {
    get(url: string, options?: RequestOptions): Promise<Response>;
    post(url: string, data: any, options?: RequestOptions): Promise<Response>;
    put(url: string, data: any, options?: RequestOptions): Promise<Response>;
    delete(url: string, options?: RequestOptions): Promise<Response>;
  };

  // Prance API アクセス（権限スコープ制限あり）
  api: {
    sessions: SessionsAPI;
    reports: ReportsAPI;
    users: UsersAPI;
    scenarios: ScenariosAPI;
  };

  // ユーティリティ
  logger: {
    info(message: string, meta?: object): void;
    warn(message: string, meta?: object): void;
    error(message: string, error?: Error, meta?: object): void;
  };

  storage: {
    // Key-Value ストレージ（DynamoDB）
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
  };

  buildUrl(path: string): string; // フロントエンドURLを生成
}
```

### イベント一覧

| イベント            | トリガー         | ペイロード              |
| ------------------- | ---------------- | ----------------------- |
| `session.started`   | セッション開始   | `SessionStartedEvent`   |
| `session.completed` | セッション完了   | `SessionCompletedEvent` |
| `session.failed`    | セッション失敗   | `SessionFailedEvent`    |
| `report.generated`  | レポート生成完了 | `ReportGeneratedEvent`  |
| `user.created`      | ユーザー作成     | `UserCreatedEvent`      |
| `scenario.created`  | シナリオ作成     | `ScenarioCreatedEvent`  |

---

## マニフェスト仕様

### plugin.json

```json
{
  "id": "slack-notifier",
  "name": "Slack Notifier",
  "version": "1.0.0",
  "description": "Send session notifications to Slack channels",
  "author": {
    "name": "Prance Team",
    "email": "plugins@prance.ai",
    "url": "https://prance.ai"
  },
  "icon": "https://example.com/slack-icon.png",

  "main": "dist/index.js",
  "runtime": "nodejs20",

  "permissions": {
    "scopes": ["sessions:read", "reports:read", "users:read"],
    "events": ["session.completed", "session.failed"],
    "http": {
      "allowedDomains": ["hooks.slack.com"]
    }
  },

  "settings": [
    {
      "key": "webhookUrl",
      "type": "string",
      "label": "Slack Webhook URL",
      "description": "Enter your Slack Incoming Webhook URL",
      "required": true,
      "validation": {
        "pattern": "^https://hooks\\.slack\\.com/services/.*$"
      }
    },
    {
      "key": "channel",
      "type": "string",
      "label": "Default Channel",
      "description": "Default Slack channel name (e.g., #general)",
      "required": false
    },
    {
      "key": "notifyOnFailure",
      "type": "boolean",
      "label": "Notify on Session Failure",
      "default": true
    }
  ],

  "ui": {
    "configPage": "config.html",
    "widgets": []
  },

  "dependencies": {
    "@slack/webhook": "^6.0.0"
  },

  "keywords": ["slack", "notification", "integration"],
  "license": "MIT",
  "homepage": "https://github.com/prance-ai/slack-notifier-plugin",
  "repository": {
    "type": "git",
    "url": "https://github.com/prance-ai/slack-notifier-plugin.git"
  }
}
```

---

## セキュリティ

### サンドボックス実行

```typescript
// Plugin Runner (Lambda)
import { VM } from 'vm2';

async function executePlugin(
  pluginCode: string,
  context: PluginContext,
  event: any
): Promise<void> {
  // VM2でサンドボックス作成
  const vm = new VM({
    timeout: 5000, // 5秒タイムアウト
    sandbox: {
      console: createSandboxedConsole(context.plugin.id),
      context, // PluginContext のみアクセス可能
      event,
    },
    eval: false, // eval() 禁止
    wasm: false, // WebAssembly 禁止
  });

  try {
    await vm.run(pluginCode);
  } catch (error) {
    context.logger.error('Plugin execution failed', error);
    throw error;
  }
}

// サンドボックス化されたconsole
function createSandboxedConsole(pluginId: string) {
  return {
    log: (...args: any[]) => {
      cloudwatch.putLogEvents({
        logGroupName: `/plugins/${pluginId}`,
        logStreamName: new Date().toISOString().split('T')[0],
        logEvents: [
          {
            message: JSON.stringify(args),
            timestamp: Date.now(),
          },
        ],
      });
    },
    error: (...args: any[]) => {
      cloudwatch.putLogEvents({
        logGroupName: `/plugins/${pluginId}/errors`,
        logStreamName: new Date().toISOString().split('T')[0],
        logEvents: [
          {
            message: JSON.stringify(args),
            timestamp: Date.now(),
          },
        ],
      });
    },
  };
}
```

### 権限スコープ

```typescript
// 権限チェック
function checkPermission(plugin: Plugin, scope: string): boolean {
  if (!plugin.manifest.permissions.scopes.includes(scope)) {
    throw new Error(`Plugin ${plugin.id} does not have permission: ${scope}`);
  }
  return true;
}

// API呼び出し時に権限チェック
class PluginSessionsAPI {
  constructor(
    private plugin: Plugin,
    private context: PluginContext
  ) {}

  async getSession(sessionId: string): Promise<Session> {
    // 権限チェック
    checkPermission(this.plugin, 'sessions:read');

    // 組織IDチェック（自組織のデータのみアクセス可能）
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (session.organizationId !== this.context.organization.id) {
      throw new Error('Access denied: Session belongs to a different organization');
    }

    return session;
  }

  async createSession(data: CreateSessionData): Promise<Session> {
    // 権限チェック
    checkPermission(this.plugin, 'sessions:write');

    // セッション作成
    return prisma.session.create({
      data: {
        ...data,
        organizationId: this.context.organization.id,
      },
    });
  }
}
```

### HTTPアクセス制限

```typescript
// HTTP リクエストフィルター
class PluginHTTPClient {
  constructor(private plugin: Plugin) {}

  async post(url: string, data: any): Promise<Response> {
    const allowedDomains = this.plugin.manifest.permissions.http?.allowedDomains || [];

    const domain = new URL(url).hostname;

    if (!allowedDomains.some(allowed => domain.endsWith(allowed))) {
      throw new Error(`HTTP access denied: ${domain} is not in allowedDomains`);
    }

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
}
```

---

## プラグインマーケットプレイス

### プラグイン公開フロー（将来実装）

```
開発者 → プラグイン作成
  ↓
マーケットプレイス申請
  ↓
Prance審査（セキュリティ、品質）
  ↓
承認 → マーケットプレイスに掲載
  ↓
ユーザーがインストール
  ↓
レビュー・評価
```

### マーケットプレイスUI（コンセプト）

```
┌──────────────────────────────────────────────────────────────┐
│ プラグインマーケットプレイス                  [🔍 検索]       │
├──────────────────────────────────────────────────────────────┤
│ カテゴリ                                                      │
│ [すべて] [通知] [データ連携] [解析] [レポート] [その他]      │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 人気のプラグイン                                              │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 📢 Slack Notifier                          ⭐⭐⭐⭐⭐ (45) │   │
│ │ セッション完了時にSlackチャンネルへ通知                │   │
│ │ by Prance Team | 無料 | 1,234インストール             │   │
│ │ [インストール] [詳細]                                  │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 📊 Advanced Analytics                      ⭐⭐⭐⭐ (28)   │   │
│ │ 業界別カスタム解析ダッシュボード                       │   │
│ │ by Analytics Co. | $9.99/月 | 567インストール        │   │
│ │ [インストール] [詳細]                                  │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 🔗 Zapier Integration                      ⭐⭐⭐⭐⭐ (92) │   │
│ │ 3,000以上のアプリと連携可能                            │   │
│ │ by Zapier | 無料 | 3,456インストール                 │   │
│ │ [インストール] [詳細]                                  │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 実装ガイド

### データベーススキーマ

```sql
-- プラグイン定義
CREATE TABLE plugins (
  id VARCHAR(100) PRIMARY KEY, -- 'slack-notifier'
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  author JSONB,
  icon_url VARCHAR(500),

  -- コード
  code_s3_key VARCHAR(500), -- S3パス
  manifest JSONB NOT NULL,

  -- 状態
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(id, version)
);

-- 組織のプラグインインストール
CREATE TABLE organization_plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  plugin_id VARCHAR(100) REFERENCES plugins(id),
  plugin_version VARCHAR(50),

  -- 状態
  status VARCHAR(20) DEFAULT 'disabled', -- 'enabled', 'disabled'
  enabled_at TIMESTAMP,
  disabled_at TIMESTAMP,

  -- 設定
  settings JSONB, -- { "webhookUrl": "...", ... }

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(organization_id, plugin_id)
);

-- プラグイン実行ログ
CREATE TABLE plugin_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_plugin_id UUID REFERENCES organization_plugins(id),
  event_type VARCHAR(100),

  -- 実行結果
  status VARCHAR(20), -- 'success', 'failed'
  duration_ms INTEGER,
  error_message TEXT,

  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  ttl TIMESTAMP -- 30日後に自動削除
);

-- インデックス
CREATE INDEX idx_organization_plugins_org ON organization_plugins(organization_id, status);
CREATE INDEX idx_plugin_logs_org_plugin ON plugin_execution_logs(organization_plugin_id, executed_at DESC);
```

### プラグイン実行フロー

```typescript
// EventBridge Rule: session.completed → Lambda
export const dispatchPluginEvent: EventBridgeHandler = async event => {
  const { eventType, data } = event.detail;

  // 1. このイベントをリスンしている組織プラグインを取得
  const orgPlugins = await prisma.organizationPlugin.findMany({
    where: {
      status: 'enabled',
      plugin: {
        manifest: {
          path: ['permissions', 'events'],
          array_contains: eventType,
        },
      },
    },
    include: { plugin: true },
  });

  // 2. 各プラグインを並列実行
  await Promise.all(
    orgPlugins.map(orgPlugin =>
      executePlugin(orgPlugin, eventType, data).catch(error => {
        console.error(`Plugin ${orgPlugin.pluginId} failed:`, error);

        // エラーログ記録
        prisma.pluginExecutionLog.create({
          data: {
            organizationPluginId: orgPlugin.id,
            eventType,
            status: 'failed',
            errorMessage: error.message,
          },
        });
      })
    )
  );
};

async function executePlugin(orgPlugin: OrganizationPlugin, eventType: string, eventData: any) {
  const startTime = Date.now();

  // 1. プラグインコード取得（S3）
  const codeObject = await s3.getObject({
    Bucket: 'prance-plugins',
    Key: orgPlugin.plugin.code_s3_key,
  });
  const pluginCode = codeObject.Body.toString('utf-8');

  // 2. PluginContext作成
  const context = createPluginContext(orgPlugin);

  // 3. サンドボックスで実行
  await executeSandboxed(pluginCode, context, {
    type: eventType,
    data: eventData,
  });

  // 4. 実行ログ記録
  await prisma.pluginExecutionLog.create({
    data: {
      organizationPluginId: orgPlugin.id,
      eventType,
      status: 'success',
      durationMs: Date.now() - startTime,
    },
  });
}
```

---

## まとめ

プラグインシステムは、以下の価値を提供します：

✅ **拡張性**: サードパーティ開発者による機能拡張
✅ **柔軟性**: 組織固有のニーズに対応
✅ **セキュリティ**: サンドボックス実行、権限スコープ制限
✅ **エコシステム**: マーケットプレイスによるプラグイン流通（将来）
✅ **開発者体験**: TypeScript SDK、充実したドキュメント

このシステムにより、Pranceプラットフォームは無限に拡張可能になり、多様なユースケースに対応できるようになります。

---

**関連ドキュメント:**

- [外部連携API](EXTERNAL_API.md)
- [開発者ガイド](../development/DEVELOPER_GUIDE.md)
