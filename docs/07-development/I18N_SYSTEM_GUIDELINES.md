# 多言語対応（i18n）システムガイドライン

**作成日:** 2026-03-11
**カテゴリ:** 開発ガイドライン
**重要度:** 🔴 CRITICAL

---

## 🎯 目的

このドキュメントは、Day 12で発生した多言語対応システムの混在問題から学んだ教訓をまとめたものです。
next-intlと独自I18nProviderの混在を防ぎ、一貫した多言語対応を実現するためのガイドラインを提供します。

---

## 🔴 絶対厳守ルール

### Rule 1: 独自I18nProvider のみ使用

**✅ 使用すること:**
```typescript
import { useI18n } from '@/lib/i18n/provider';

export function MyComponent() {
  const { t } = useI18n();
  return <div>{t('common.welcome')}</div>;
}
```

**❌ 使用禁止:**
```typescript
// next-intl は使用しない
import { useTranslations } from 'next-intl';           // ❌ 禁止
import { getTranslations } from 'next-intl/server';    // ❌ 禁止
```

### Rule 2: 翻訳キーの命名規則

**形式:** `category.subcategory.key`

```typescript
// ✅ 正しい
t('home.title')                    // home.json → title
t('errors.microphone.notFound')    // errors.json → microphone.notFound
t('sessions.player.start')         // sessions.json → player.start

// ❌ 間違い
t('title')                         // カテゴリなし
t('Home Title')                    // スペース使用
t('home/title')                    // スラッシュ使用
```

### Rule 3: 新規翻訳追加手順

**Step 1:** 翻訳ファイルに追加
```json
// apps/web/messages/en/common.json
{
  "common": {
    "newKey": "New translation text"
  }
}
```

**Step 2:** messages.ts にインポート確認（既存カテゴリなら不要）
```typescript
// lib/i18n/messages.ts
import commonEn from '@/messages/en/common.json';
// 既にインポート済みなら追加不要
```

**Step 3:** コンポーネントで使用
```typescript
const { t } = useI18n();
const text = t('common.newKey');
```

---

## 📚 システム構成

### アーキテクチャ

```
┌─────────────────────────────────────────────────┐
│ app/layout.tsx                                  │
│ ├─ getMessages(locale)                          │
│ └─ <Providers locale={locale} messages={...}>   │
│    └─ <I18nProvider>                            │
│       └─ useI18n() フック提供                    │
└─────────────────────────────────────────────────┘
           ↑
           │ メッセージ取得
           │
┌─────────────────────────────────────────────────┐
│ lib/i18n/messages.ts                            │
│ - 全言語のメッセージファイルをインポート          │
│ - getMessages(locale) エクスポート              │
└─────────────────────────────────────────────────┘
           ↑
           │ JSONファイル読み込み
           │
┌─────────────────────────────────────────────────┐
│ messages/[locale]/                              │
│ ├─ common.json                                  │
│ ├─ auth.json                                    │
│ ├─ errors.json                                  │
│ ├─ sessions.json                                │
│ └─ ... (各カテゴリ)                             │
└─────────────────────────────────────────────────┘
```

### ファイル構成

```
apps/web/
├── lib/i18n/
│   ├── config.ts          # 言語設定（SSOT）
│   ├── messages.ts        # メッセージローダー
│   └── provider.tsx       # カスタムI18nProvider
├── messages/
│   ├── en/               # 英語（フォールバック）
│   │   ├── common.json
│   │   ├── errors.json
│   │   └── ...
│   ├── ja/               # 日本語
│   └── ... (10言語)
├── middleware.ts         # 言語検出
└── app/layout.tsx        # Providerセットアップ
```

---

## 🚫 過去の問題と解決策

### Case 1: next-intlとの混在（2026-03-11）

#### 問題

- `useErrorMessage` フックが `useTranslations` from next-intl を使用
- `NextIntlClientProvider` のコンテキストが存在しない
- Runtime Error: "Failed to call `useTranslations`"

#### 根本原因

1. **不完全な移行**: next-intl から独自システムへの移行が途中
2. **設定ファイルの残骸**: i18n/request.ts, next.config.js の withNextIntl()
3. **チェック不足**: 全ファイルの移行確認が不十分

#### 解決策

1. ✅ next-intl 完全削除
   - `pnpm remove next-intl`
   - `i18n/request.ts` 削除
   - `next.config.js` から `withNextIntl()` 削除

2. ✅ 全ファイルを useI18n に統一
   - `useErrorMessage.ts` 修正
   - `app/page.tsx` 修正（Server → Client Component化）

3. ✅ messages.ts に errors.json 追加

#### 再発防止策

- ✅ このガイドライン作成
- ✅ コミット前チェックリストに追加
- ✅ MEMORY.md / CLAUDE.md に記録

---

## ✅ チェックリスト

### 新規コンポーネント作成時

- [ ] `useI18n()` フックをインポート
- [ ] 翻訳キーは `category.key` 形式
- [ ] next-intl をインポートしていない

### 新規翻訳追加時

- [ ] 英語（en/）と日本語（ja/）の両方に追加
- [ ] messages.ts でインポート済みか確認
- [ ] カテゴリ名が既存と一致

### コミット前

- [ ] next-intl のインポートがないか確認
  ```bash
  grep -r "from 'next-intl" apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules
  ```

- [ ] useI18n が正しく使用されているか確認
  ```bash
  grep -r "useI18n" apps/web --include="*.ts" --include="*.tsx" | grep -v node_modules | head -n 5
  ```

---

## 🛠️ トラブルシューティング

### エラー: "useI18n must be used within I18nProvider"

**原因:** コンポーネントが I18nProvider の外にある

**解決策:**
```typescript
// app/layout.tsx で Providers が正しく設定されているか確認
<Providers locale={locale} messages={messages}>
  {children}
</Providers>
```

### 翻訳キーが見つからない

**エラー:** `[i18n] Translation missing: home.title`

**原因:**
1. 翻訳ファイルにキーが存在しない
2. messages.ts でインポートされていない

**解決策:**
```bash
# 1. 翻訳ファイル確認
cat apps/web/messages/en/home.json | jq '.home.title'

# 2. messages.ts のインポート確認
grep "homeEn" apps/web/lib/i18n/messages.ts
```

### Server Component で翻訳を使いたい

**問題:** useI18n は Client Component 専用

**解決策 A:** Client Component 化
```typescript
'use client';

import { useI18n } from '@/lib/i18n/provider';
```

**解決策 B:** プロップスで渡す
```typescript
// Server Component
export default async function Page() {
  const messages = getMessages('en');
  return <ClientComponent messages={messages} />;
}

// Client Component
'use client';
export function ClientComponent({ messages }) {
  return <div>{messages.home.title}</div>;
}
```

---

## 📖 参考資料

### 内部ドキュメント
- [CLAUDE.md - 多言語対応](../../CLAUDE.md#多言語対応)
- [MEMORY.md - Rule 1: テスト・実装確認の原則](/home/vscode/.claude/projects/-workspaces-prance-communication-platform/memory/MEMORY.md)

### 実装ファイル
- `lib/i18n/provider.tsx` - カスタムI18nProvider実装
- `lib/i18n/config.ts` - 言語設定（SSOT）
- `lib/i18n/messages.ts` - メッセージローダー

---

## 🔄 継続的改善

### 更新履歴
- 2026-03-11: 初版作成（next-intl混在問題の解決）

### 次回更新予定
- パフォーマンス最適化（メッセージの遅延ロード）
- 翻訳管理ツールの導入検討
- 動的言語切り替えの改善

---

**最終更新:** 2026-03-11
**次回レビュー:** Phase 2完了時
