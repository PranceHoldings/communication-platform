# Prance Web Application

Next.js 15ベースのフロントエンドアプリケーション

---

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript 5.3
- **スタイリング**: Tailwind CSS 3.4
- **UIコンポーネント**: shadcn/ui + Radix UI
- **3D/2D**: Three.js + React Three Fiber, Live2D Cubism SDK (予定)
- **状態管理**: Zustand 4.5
- **フォーム**: React Hook Form 7.50 + Zod 3.22
- **多言語**: カスタム useI18n フック

---

## セットアップ

### 前提条件

- Node.js 20.x
- npm 9.x以上

### インストール

```bash
# プロジェクトルートから
npm install

# または、このディレクトリから
cd apps/web
npm install
```

### 環境変数

`.env.local`をプロジェクトルートに作成:

```env
# API Base URL
NEXT_PUBLIC_API_URL=https://your-api-gateway-url.amazonaws.com/dev

# 開発環境では
NEXT_PUBLIC_API_URL=https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev
```

### 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 でアクセス

---

## プロジェクト構造

```
apps/web/
├── app/                          # Next.js 15 App Router
│   ├── (auth)/                  # 認証ページグループ
│   │   ├── login/
│   │   └── register/
│   ├── dashboard/               # ダッシュボード
│   │   ├── sessions/           # セッション管理
│   │   ├── scenarios/          # シナリオ管理（未実装）
│   │   └── avatars/            # アバター管理（未実装）
│   ├── layout.tsx              # ルートレイアウト
│   ├── page.tsx                # トップページ
│   └── globals.css             # グローバルスタイル
├── components/                  # Reactコンポーネント
│   ├── ui/                     # shadcn/ui コンポーネント
│   ├── dashboard/              # ダッシュボード専用
│   ├── providers.tsx           # Providerラッパー
│   └── language-switcher.tsx   # 言語切り替え
├── lib/                         # ユーティリティ
│   ├── api/                    # APIクライアント
│   │   ├── client.ts           # HTTPクライアント
│   │   ├── sessions.ts         # セッションAPI
│   │   ├── scenarios.ts        # シナリオAPI
│   │   └── avatars.ts          # アバターAPI
│   └── i18n/                   # 多言語対応
│       ├── provider.tsx        # I18nProvider
│       ├── messages.ts         # 言語リソース読み込み
│       └── middleware.ts       # 言語検出
├── contexts/                    # React Context
│   └── auth-context.tsx        # 認証コンテキスト
├── messages/                    # 言語リソースファイル
│   ├── en/                     # 英語
│   │   ├── common.json
│   │   ├── auth.json
│   │   ├── dashboard.json
│   │   └── sessions.json
│   └── ja/                     # 日本語
│       ├── common.json
│       ├── auth.json
│       ├── dashboard.json
│       └── sessions.json
└── public/                      # 静的ファイル
```

---

## 多言語対応（i18n）

このプロジェクトはカスタム`useI18n`フックを使用しています。

### 基本的な使い方

```tsx
'use client';

import { useI18n } from '@/lib/i18n/provider';

export default function MyComponent() {
  const { t, locale, setLocale } = useI18n();

  return (
    <div>
      {/* 基本翻訳 */}
      <h1>{t('common.app_name')}</h1>

      {/* パラメータ付き */}
      <p>{t('dashboard.welcome', { name: 'John' })}</p>

      {/* 言語切り替え */}
      <button onClick={() => setLocale('ja')}>日本語</button>
      <button onClick={() => setLocale('en')}>English</button>
    </div>
  );
}
```

### 新しい翻訳を追加

1. `messages/en/yourfile.json`に英語翻訳を追加
2. `messages/ja/yourfile.json`に日本語翻訳を追加
3. `lib/i18n/messages.ts`にインポートを追加
4. コンポーネントで`t('yourfile.key')`を使用

詳細: [docs/development/I18N.md](../../docs/development/I18N.md)

---

## APIクライアント

### 使い方

```tsx
import { getSessions, createSession } from '@/lib/api/sessions';
import { getScenarios } from '@/lib/api/scenarios';
import { getAvatars } from '@/lib/api/avatars';

// セッション一覧取得
const sessions = await getSessions({ limit: 10, offset: 0 });

// セッション作成
const session = await createSession({
  scenarioId: 'scenario-id',
  avatarId: 'avatar-id',
  metadata: { custom: 'data' },
});

// シナリオ一覧取得
const scenarios = await getScenarios({ limit: 50 });

// アバター一覧取得
const avatars = await getAvatars({ limit: 50, type: 'TWO_D' });
```

### 認証

APIクライアントは自動的に`localStorage`から`accessToken`を取得して、
`Authorization: Bearer <token>`ヘッダーを付与します。

---

## ビルド・デプロイ

### 本番ビルド

```bash
npm run build
```

### 本番サーバー起動

```bash
npm run start
```

### AWS Amplify Hostingへのデプロイ

1. GitHubリポジトリと連携
2. ビルド設定: `amplify.yml`を参照
3. 環境変数を設定: `NEXT_PUBLIC_API_URL`
4. 自動デプロイ有効化

---

## 開発ガイドライン

### コンポーネント作成

```tsx
// ✅ 推奨: Client Componentを明示
'use client';

import { useI18n } from '@/lib/i18n/provider';

export default function MyComponent() {
  const { t } = useI18n();

  return <div>{t('common.loading')}</div>;
}
```

### スタイリング

```tsx
// ✅ Tailwind CSS + shadcn/ui
import { Button } from '@/components/ui/button';

<Button variant="default" size="lg">
  Click me
</Button>
```

### フォーム

```tsx
// ✅ React Hook Form + Zod
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

---

## 注意事項

### next-intlについて

`package.json`に`next-intl`が含まれていますが、**現在は使用していません**。

- **現状**: カスタム`useI18n`フックで十分な機能を提供
- **理由**: 軽量・シンプル・プロジェクトに最適化
- **将来**: 複数形、日付フォーマット等が必要になれば移行検討

### 依存関係のクリーンアップ

将来的に`next-intl`を削除する可能性があります。現時点では依存関係として残していますが、
コード内では一切使用していません。

---

## トラブルシューティング

### 問題: ビルドエラー `Module not found`

**解決方法:**
```bash
# node_modules削除 & 再インストール
rm -rf node_modules package-lock.json
npm install
```

### 問題: 翻訳が表示されない

**解決方法:**
1. `messages/{locale}/{file}.json`にキーが存在するか確認
2. `lib/i18n/messages.ts`にインポートされているか確認
3. 開発サーバーを再起動

詳細: [docs/development/I18N.md](../../docs/development/I18N.md)

### 問題: APIリクエストが401エラー

**解決方法:**
1. `/login`でログインし直す
2. `localStorage`の`accessToken`を確認
3. トークンの有効期限（24時間）を確認

---

## 関連ドキュメント

- [多言語対応詳細](../../docs/development/I18N.md)
- [API設計](../../docs/development/API_DESIGN.md)
- [プロジェクト概要](../../CLAUDE.md)

---

**最終更新:** 2026-03-05
**バージョン:** 0.1.0-alpha
