# 多言語対応実装 - 完全チェックリスト

**バージョン:** 1.0
**作成日:** 2026-03-08
**目的:** Phase 2多言語対応実装時に**絶対に抜け漏れがない**ことを保証

---

## 📋 使い方

このチェックリストは、新言語を追加する際に**すべての項目を確認**してください。

**チェック方法:**

- [ ] 未完了
- [x] 完了
- [~] 該当なし（スキップ）

**Phase 1現状:**

- サポート言語: 英語（en）、日本語（ja）
- STT自動検出: ja-JP, en-US
- ハードコード: 最小限のデフォルト値のみ

---

## 🎯 Phase 2実装の最終目標

### 1. 言語追加時の理想フロー

**開発者が言語を追加する場合:**

```
1. apps/web/messages/{code}.json を作成
2. メタデータを含める（languageCode, sttCode, displayName）
3. 翻訳を記載
4. コミット・デプロイ
→ システムが自動的に新言語を認識
```

**スーパー管理者がUIから言語を追加する場合:**

```
1. 管理画面で「言語追加」
2. 言語コード、STTコード、表示名を入力
3. 翻訳ファイルをアップロード
4. 「保存」をクリック
→ 1-5分でホットデプロイ（リビルド不要）
```

### 2. システム要件

- ✅ **ハードコード禁止**: 言語リストをコードに埋め込まない
- ✅ **自動検出**: システムが利用可能な言語を自動認識
- ✅ **ホットデプロイ**: 新言語追加時にリビルド不要
- ✅ **STT対応**: 新言語のSTTコード（例: zh-CN）を自動設定
- ✅ **UI反映**: 新言語が言語選択UIに自動表示

---

## 📂 Phase 2実装チェックリスト

### A. アーキテクチャ設計

- [ ] **A.1** 言語メタデータの保存場所を決定
  - [ ] A.1.1 言語リソースファイルに埋め込む（`messages/{code}.json` の `meta` セクション）
  - [ ] A.1.2 データベースに保存（`languages` テーブル）
  - [ ] A.1.3 両方（言語リソース + DB管理UI）
  - **推奨:** A.1.3（言語リソースファイルをプライマリ、DBで上書き可能）

- [ ] **A.2** 言語リソースの配信方法を決定
  - [ ] A.2.1 Next.jsビルドに含める（静的）
  - [ ] A.2.2 S3 + CloudFront経由（動的）
  - [ ] A.2.3 API経由で取得
  - **推奨:** A.2.2（ホットデプロイ可能）

- [ ] **A.3** 言語コード変換マップの保存場所を決定
  - [ ] A.3.1 言語リソースファイルの `meta.sttCode`
  - [ ] A.3.2 データベースの `sttCode` フィールド
  - **推奨:** A.3.1

### B. データベース設計（オプション）

- [ ] **B.1** `languages` テーブル作成（データベース管理を選択した場合）

  ```prisma
  model Language {
    id          String   @id @default(uuid())
    code        String   @unique // "ja", "en", "zh"
    sttCode     String   // "ja-JP", "en-US", "zh-CN"
    displayName String   // "日本語", "English", "中文"
    enabled     Boolean  @default(true)
    sortOrder   Int      @default(0)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    @@index([enabled])
    @@map("languages")
  }
  ```

- [ ] **B.2** 初期データ投入
  - [ ] B.2.1 英語（en）
  - [ ] B.2.2 日本語（ja）
  - [ ] B.2.3 その他の言語

- [ ] **B.3** Prismaマイグレーション実行
  ```bash
  cd packages/database
  npx prisma migrate dev --name add_languages_table
  npx prisma generate
  ```

### C. 言語リソースファイル構造

- [ ] **C.1** メタデータセクションを各言語ファイルに追加

  ```json
  // apps/web/messages/ja.json
  {
    "meta": {
      "languageCode": "ja",
      "sttCode": "ja-JP",
      "displayName": "日本語",
      "enabled": true,
      "sortOrder": 1
    },
    "common": { ... },
    "auth": { ... }
  }
  ```

- [ ] **C.2** 既存言語ファイルに `meta` セクション追加
  - [ ] C.2.1 `messages/en.json`
  - [ ] C.2.2 `messages/ja.json`

- [ ] **C.3** スキーマ検証を追加
  ```typescript
  // scripts/validate-language-files.ts
  // 全言語ファイルが正しい構造を持つかチェック
  ```

### D. バックエンド実装

#### D.1 言語取得API

- [ ] **D.1.1** GET `/api/v1/languages` 実装
  - [ ] D.1.1.1 Lambda関数作成: `infrastructure/lambda/languages/list/index.ts`
  - [ ] D.1.1.2 言語リソースファイルから読み込み
  - [ ] D.1.1.3 DBから読み込み（DB管理を選択した場合）
  - [ ] D.1.1.4 レスポンス形式:
    ```typescript
    {
      languages: [
        { code: 'ja', sttCode: 'ja-JP', displayName: '日本語', enabled: true },
        { code: 'en', sttCode: 'en-US', displayName: 'English', enabled: true },
      ];
    }
    ```

- [ ] **D.1.2** CDK Stack更新
  - [ ] D.1.2.1 `infrastructure/lib/stacks/api-lambda-stack.ts` に追加
  - [ ] D.1.2.2 API Gateway統合
  - [ ] D.1.2.3 認証不要（パブリックエンドポイント）

#### D.2 STT自動言語検出の動的化

- [ ] **D.2.1** `getAvailableSTTLanguages()` 関数実装

  ```typescript
  // infrastructure/lambda/shared/language/get-available-languages.ts
  export async function getAvailableSTTLanguages(): Promise<string[]> {
    // 方法1: S3から言語リソースファイルを読み込み
    // 方法2: DynamoDBキャッシュから取得
    // 方法3: データベースから取得
  }
  ```

- [ ] **D.2.2** AudioProcessor初期化時に動的取得

  ```typescript
  // infrastructure/lambda/websocket/default/index.ts
  async function getAudioProcessor(): Promise<AudioProcessor> {
    const autoDetectLanguages = await getAvailableSTTLanguages();
    // または環境変数で上書き可能
    const finalLanguages = process.env.STT_AUTO_DETECT_LANGUAGES
      ? process.env.STT_AUTO_DETECT_LANGUAGES.split(',')
      : autoDetectLanguages;

    return new AudioProcessor({
      autoDetectLanguages: finalLanguages,
      // ...
    });
  }
  ```

- [ ] **D.2.3** キャッシュ実装（パフォーマンス最適化）
  - [ ] D.2.3.1 DynamoDBにキャッシュ（TTL: 5分）
  - [ ] D.2.3.2 Lambda環境変数にキャッシュ（コールドスタート時のみ再取得）

#### D.3 組織ごとの言語設定（オプション）

- [ ] **D.3.1** `organizations` テーブルに `settings` JSON追加

  ```json
  {
    "enabledLanguages": ["ja", "en", "zh"],
    "sttCandidateLanguages": ["ja-JP", "en-US", "zh-CN"]
  }
  ```

- [ ] **D.3.2** 組織設定取得API
  - [ ] GET `/api/v1/organizations/:id/settings`

- [ ] **D.3.3** AudioProcessor初期化時に組織設定を使用
  ```typescript
  const orgSettings = await getOrganizationSettings(orgId);
  const autoDetectLanguages = orgSettings.sttCandidateLanguages || defaultLanguages;
  ```

### E. フロントエンド実装

#### E.1 言語選択UI

- [ ] **E.1.1** 動的言語リスト取得

  ```typescript
  // apps/web/lib/api/languages.ts
  export async function getAvailableLanguages(): Promise<Language[]> {
    const response = await apiClient.get('/languages');
    return response.languages;
  }
  ```

- [ ] **E.1.2** 言語選択コンポーネント更新

  ```typescript
  // apps/web/components/language-selector.tsx
  const { data: languages } = useQuery('languages', getAvailableLanguages);

  return (
    <select>
      {languages?.map(lang => (
        <option key={lang.code} value={lang.code}>
          {lang.displayName}
        </option>
      ))}
    </select>
  );
  ```

- [ ] **E.1.3** ハードコードされた言語リストを削除
  - [ ] E.1.3.1 検索: `grep -rn "['ja', 'en']" apps/web`
  - [ ] E.1.3.2 検索: `grep -rn "Japanese.*English" apps/web`
  - [ ] E.1.3.3 すべてのハードコードを動的取得に置き換え

#### E.2 i18n設定の動的化

- [ ] **E.2.1** Middleware更新

  ```typescript
  // apps/web/middleware.ts
  // 静的なlocales配列を削除
  const locales = await getAvailableLanguageCodes(); // 動的取得
  ```

- [ ] **E.2.2** next-intl設定更新

  ```typescript
  // apps/web/i18n/config.ts
  export async function getI18nConfig() {
    const languages = await getAvailableLanguages();
    return {
      locales: languages.map(l => l.code),
      defaultLocale: 'en',
    };
  }
  ```

- [ ] **E.2.3** 言語リソースの遅延読み込み
  ```typescript
  // 必要な言語のみロード（バンドルサイズ削減）
  const messages = await import(`../messages/${locale}.json`);
  ```

### F. スーパー管理者UI（Phase 2後期）

- [ ] **F.1** 言語管理画面実装
  - [ ] F.1.1 言語一覧表示: `apps/web/app/admin/languages/page.tsx`
  - [ ] F.1.2 言語追加フォーム: `apps/web/app/admin/languages/new/page.tsx`
  - [ ] F.1.3 言語編集フォーム: `apps/web/app/admin/languages/[id]/page.tsx`

- [ ] **F.2** 翻訳ファイルアップロード機能
  - [ ] F.2.1 JSONファイルバリデーション
  - [ ] F.2.2 S3アップロード
  - [ ] F.2.3 CloudFrontキャッシュ無効化（1-5分で反映）

- [ ] **F.3** 言語有効/無効切り替え
  - [ ] F.3.1 UI上でトグル操作
  - [ ] F.3.2 即座にフロントエンドに反映

- [ ] **F.4** 翻訳プレビュー機能
  - [ ] F.4.1 翻訳を適用した画面プレビュー
  - [ ] F.4.2 翻訳の品質チェック（欠落キー検出）

### G. インフラストラクチャ

#### G.1 S3 + CloudFront設定

- [ ] **G.1.1** 言語リソース用S3バケット
  - [ ] G.1.1.1 バケット名: `prance-language-resources-{env}`
  - [ ] G.1.1.2 パス構造: `languages/{code}.json`
  - [ ] G.1.1.3 バージョニング有効化

- [ ] **G.1.2** CloudFront設定
  - [ ] G.1.2.1 キャッシュポリシー（TTL: 5分）
  - [ ] G.1.2.2 署名付きURL（管理者のみ書き込み可能）

- [ ] **G.1.3** Lambda@Edge（オプション）
  - [ ] G.1.3.1 言語リソースの自動圧縮
  - [ ] G.1.3.2 CORS設定

#### G.2 環境変数

- [ ] **G.2.1** 新環境変数追加

  ```bash
  # .env / infrastructure/.env
  LANGUAGE_RESOURCES_S3_BUCKET=prance-language-resources-dev
  LANGUAGE_RESOURCES_CDN_URL=https://cdn-languages.prance.com
  STT_AUTO_DETECT_LANGUAGES=ja-JP,en-US,zh-CN,ko-KR # オーバーライド用
  ```

- [ ] **G.2.2** CDK Stack更新
  - [ ] G.2.2.1 Lambda環境変数に追加
  - [ ] G.2.2.2 IAM権限（S3読み取り）

#### G.3 デプロイメント

- [ ] **G.3.1** デプロイスクリプト更新

  ```bash
  # scripts/deploy-language-resources.sh
  # 1. 言語リソースファイルをS3にアップロード
  # 2. CloudFrontキャッシュ無効化
  # 3. DynamoDBキャッシュクリア
  ```

- [ ] **G.3.2** CI/CD統合
  - [ ] G.3.2.1 言語ファイル変更時に自動デプロイ
  - [ ] G.3.2.2 バリデーション（JSON構造チェック）

### H. テスト

#### H.1 単体テスト

- [ ] **H.1.1** `getAvailableLanguages()` のテスト
  - [ ] H.1.1.1 正常系: 言語リストを返す
  - [ ] H.1.1.2 異常系: S3エラー時のフォールバック
  - [ ] H.1.1.3 キャッシュが機能するか

- [ ] **H.1.2** 言語リソースファイルのバリデーション
  - [ ] H.1.2.1 すべての言語ファイルが `meta` セクションを持つ
  - [ ] H.1.2.2 必須フィールドが存在する
  - [ ] H.1.2.3 JSON構造が正しい

- [ ] **H.1.3** STT自動言語検出のテスト
  - [ ] H.1.3.1 ja-JP音声 → 正しく認識
  - [ ] H.1.3.2 en-US音声 → 正しく認識
  - [ ] H.1.3.3 zh-CN音声 → 正しく認識（中国語追加後）

#### H.2 統合テスト

- [ ] **H.2.1** 新言語追加フロー
  - [ ] H.2.1.1 言語ファイルを追加
  - [ ] H.2.1.2 デプロイ
  - [ ] H.2.1.3 言語選択UIに表示されることを確認
  - [ ] H.2.1.4 新言語でSTT動作確認

- [ ] **H.2.2** 言語無効化フロー
  - [ ] H.2.2.1 管理UIで言語を無効化
  - [ ] H.2.2.2 言語選択UIから消えることを確認
  - [ ] H.2.2.3 STT候補言語から除外されることを確認

#### H.3 E2Eテスト

- [ ] **H.3.1** 多言語セッション
  - [ ] H.3.1.1 日本語セッション → 日本語で会話
  - [ ] H.3.1.2 英語セッション → 英語で会話
  - [ ] H.3.1.3 日本語セッション → 英語で会話（自動検出）

- [ ] **H.3.2** 言語切り替え
  - [ ] H.3.2.1 UIで言語を切り替え
  - [ ] H.3.2.2 即座に翻訳が切り替わる
  - [ ] H.3.2.3 Cookieに保存される

### I. ドキュメント

- [ ] **I.1** 開発者ドキュメント更新
  - [ ] I.1.1 MULTILINGUAL_SYSTEM.md
  - [ ] I.1.2 VOICE_MODULE.md（STT自動検出）
  - [ ] I.1.3 API_DESIGN.md（新API追加）

- [ ] **I.2** 運用ドキュメント作成
  - [ ] I.2.1 新言語追加手順
  - [ ] I.2.2 翻訳更新手順
  - [ ] I.2.3 トラブルシューティング

- [ ] **I.3** 管理者ガイド作成
  - [ ] I.3.1 管理UIの使い方
  - [ ] I.3.2 翻訳ファイルのフォーマット
  - [ ] I.3.3 言語設定のベストプラクティス

### J. パフォーマンス最適化

- [ ] **J.1** キャッシュ戦略
  - [ ] J.1.1 フロントエンド: 言語リストをローカルストレージにキャッシュ
  - [ ] J.1.2 バックエンド: DynamoDBに言語リストをキャッシュ
  - [ ] J.1.3 CloudFront: 言語リソースファイルをキャッシュ

- [ ] **J.2** バンドルサイズ削減
  - [ ] J.2.1 使用中の言語のみロード
  - [ ] J.2.2 遅延ロード（必要になったら読み込む）

- [ ] **J.3** STT候補言語の最適化
  - [ ] J.3.1 組織ごとに候補言語を制限（2-4言語推奨）
  - [ ] J.3.2 使用頻度の高い言語を優先

### K. セキュリティ

- [ ] **K.1** 言語リソースファイルのバリデーション
  - [ ] K.1.1 XSS攻撃対策（HTMLエスケープ）
  - [ ] K.1.2 JSONインジェクション対策
  - [ ] K.1.3 ファイルサイズ制限（最大1MB）

- [ ] **K.2** 管理者権限チェック
  - [ ] K.2.1 言語追加: SUPER_ADMINのみ
  - [ ] K.2.2 言語編集: SUPER_ADMINのみ
  - [ ] K.2.3 言語削除: SUPER_ADMINのみ

### L. 監視・ログ

- [ ] **L.1** CloudWatchメトリクス
  - [ ] L.1.1 言語取得API呼び出し回数
  - [ ] L.1.2 STT言語検出成功率
  - [ ] L.1.3 言語ごとの使用頻度

- [ ] **L.2** ログ記録
  - [ ] L.2.1 新言語追加時のログ
  - [ ] L.2.2 STT言語検出結果のログ
  - [ ] L.2.3 翻訳ファイルアップロード時のログ

---

## ✅ 完了基準

すべてのチェック項目が完了し、以下の条件を満たすこと：

1. ✅ **新言語追加が5分以内で完了する**
   - 言語リソースファイル作成 → デプロイ → UI反映

2. ✅ **コードを一切変更せずに新言語を追加できる**
   - ハードコードされた言語リストが存在しない

3. ✅ **STTが自動的に新言語を検出する**
   - 環境変数またはデータベースから動的取得

4. ✅ **スーパー管理者がUIから言語を管理できる**
   - 言語追加・編集・無効化がUIで完結

5. ✅ **すべてのテストが成功する**
   - 単体・統合・E2Eテスト

---

## 📊 進捗管理

### Phase 2.1: 基盤実装（2-3週間）

- [ ] A. アーキテクチャ設計
- [ ] B. データベース設計
- [ ] C. 言語リソースファイル構造
- [ ] D. バックエンド実装

### Phase 2.2: フロントエンド実装（1-2週間）

- [ ] E. フロントエンド実装

### Phase 2.3: 管理UI（1-2週間）

- [ ] F. スーパー管理者UI

### Phase 2.4: インフラ＆テスト（1週間）

- [ ] G. インフラストラクチャ
- [ ] H. テスト
- [ ] I. ドキュメント
- [ ] J. パフォーマンス最適化
- [ ] K. セキュリティ
- [ ] L. 監視・ログ

---

## 🔗 関連ドキュメント

- [MULTILINGUAL_PHASE2_TASKS.md](MULTILINGUAL_PHASE2_TASKS.md) - タスク詳細
- [MULTILINGUAL_AFFECTED_FILES.md](MULTILINGUAL_AFFECTED_FILES.md) - 影響ファイル一覧
- [MULTILINGUAL_SYSTEM.md](../modules/MULTILINGUAL_SYSTEM.md) - システム設計
- [VOICE_MODULE.md](../modules/VOICE_MODULE.md) - STT自動言語検出

---

**最終更新:** 2026-03-08
**レビュー予定:** Phase 2実装開始前
