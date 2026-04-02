# React 19 アップグレード計画

**作成日**: 2026-04-02
**ブランチ**: dev
**目的**: Next.js 15 + @react-three/fiber の互換性問題を解決するためReact 19にアップグレード

---

## 1. 互換性調査結果

### ✅ コアパッケージ

| パッケージ | 現在 | 目標 | React 19対応 |
|-----------|-----|------|------------|
| React | 18.3.1 | 19.2.4 | ✅ |
| React-DOM | 18.3.1 | 19.2.4 | ✅ |
| Next.js | 15.5.14 | 15.5.14 | ✅ 対応済み |
| TypeScript | 5.9.5 | 5.9.5 | ✅ |

### ✅ UIライブラリ

| パッケージ | 現在 | React 19対応 |
|-----------|-----|------------|
| @radix-ui/* | 1.x-2.x | ✅ `^16.8 \|\| ^17.0 \|\| ^18.0 \|\| ^19.0` |
| @dnd-kit/core | 6.3.1 | ✅ `>=16.8.0` |
| lucide-react | 0.344.0 | ✅ |
| sonner | latest | ✅ |

### ✅ 主要機能ライブラリ

| パッケージ | 現在 | アップグレード先 | React 19対応 |
|-----------|-----|---------------|------------|
| @react-three/fiber | 8.18.0 | 9.5.0 | ✅ `^19 <19.3` (React 19必須) |
| @tanstack/react-query | 5.17.0 | latest | ✅ |
| react-hook-form | 7.50.0 | latest | ✅ |
| react-markdown | 10.1.0 | latest | ✅ |

---

## 2. アップグレード戦略

### Phase 1: React本体のアップグレード ✅
- React 18.3.1 → 19.2.4
- React-DOM 18.3.1 → 19.2.4

### Phase 2: @react-three/fiberのアップグレード
- @react-three/fiber 8.18.0 → 9.5.0
- three 0.160.1 → latest (if needed)

### Phase 3: 破壊的変更への対応
1. **廃止されたAPI**: React 19で廃止されたAPIがあればコード修正
2. **TypeScript型**: React 19の新しい型定義に対応
3. **Hooks**: 新しいHooks（use等）の活用検討

### Phase 4: テスト・検証
1. 開発サーバー起動確認
2. ビルド成功確認
3. E2Eテスト実行
4. Three.js/Reactエラーが解消されたことを確認

---

## 3. 期待される効果

### ✅ Three.js エラーの解消
- **現在の問題**: `TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')`
- **原因**: Next.js 15内部ReactバンドルとReact-reconcilerの非互換性
- **解決**: React 19 + @react-three/fiber 9.5.0で正式サポート

### ✅ E2Eテスト成功率の向上
- **現在**: 2/3 テスト成功 (66.7%)
- **期待**: 3/3 テスト成功 (100%)
- **特に**: "should reach ACTIVE status after WebSocket connection" が成功

---

## 4. リスク評価

### 🟡 中リスク
- **破壊的変更**: React 19には一部破壊的変更がある可能性
- **型定義の変更**: TypeScriptエラーが発生する可能性
- **サードパーティライブラリ**: 一部ライブラリがReact 19未対応の可能性（現時点で確認済みは全て対応）

### ✅ 低リスク
- **Next.js 15**: React 19を公式サポート
- **主要UIライブラリ**: @radix-ui, @dnd-kitは全てReact 19対応済み
- **開発環境**: devブランチでの作業のため、mainブランチへの影響なし

---

## 5. ロールバック計画

万が一問題が発生した場合：

1. **即時ロールバック**: `git checkout main`
2. **devブランチでの修正**: 問題を修正してから再度アップグレード
3. **代替アプローチ**: E2Eテストでアバターをモック化（Option 1として既に提案済み）

---

## 6. 実装手順

### Step 1: package.json更新
```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "@react-three/fiber": "^9.5.0"
  }
}
```

### Step 2: npm install
```bash
npm install
```

### Step 3: ビルドエラーの確認・修正
```bash
npm run build
```

### Step 4: TypeScriptエラーの修正
```bash
npm run typecheck
```

### Step 5: E2Eテスト実行
```bash
npm run test:e2e -- websocket-connection.spec.ts
```

---

## 7. 包括的調査結果（2026-04-02完了）

### ✅ Task #16: デプロイ環境・コードベース・問題解決の確認

#### 7.1 AWS Amplify Hosting - React 19対応
- **結論**: ✅ 完全サポート、設定変更不要
- **Node.js要件**: Node.js 22.x（既に使用中）
- **ビルド設定**: amplify.yml 修正不要
- **リスク**: なし

#### 7.2 コードベース - 破壊的変更の影響
- **結論**: ✅ 影響最小限、主要パッケージ全対応
- **互換性あり**: Context.Provider, イベントハンドラ型, dynamic import
- **注意が必要**: recharts（テスト時に動作確認）
- **修正不要**: forwardRef未使用、useFormState未使用
- **リスク**: 低

#### 7.3 ReactCurrentOwner問題の解決
- **根本原因**: react-reconciler 0.27.0がNext.js 15内部Reactと非互換
- **解決方法**: @react-three/fiber 9.5.0が**reconcilerをbundle内包**
  - react-reconciler 0.29.x+ (React 19用) を内包
  - React 19の`__SECRET_INTERNALS__`構造と完全一致
  - Next.js 15 + React 19との互換性を保証
- **確認**: Next.js 15 + React 19 + @react-three/fiber 9.x公式サポート
- **リスク**: なし

---

## 8. 次のアクション

- [x] Task #11: React 19互換性調査
- [x] Task #12: 依存パッケージのReact 19互換性確認
- [x] Task #16: デプロイ環境・コードベース・問題解決の確認 ✅
- [ ] Task #13: React 19へのアップグレード実装（再開）
- [ ] Task #14: React 19破壊的変更への対応
- [ ] Task #15: アップグレード後の検証

---

**最終更新**: 2026-04-02
**ステータス**: 包括的調査完了（Task #11, #12, #16）、実装準備完了
