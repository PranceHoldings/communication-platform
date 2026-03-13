# ゲストユーザー機能 - 実装サマリー

**作成日:** 2026-03-11
**実装開始予定:** Phase 1.5-1.6完了後
**推定期間:** 4-5週間

---

## 🎯 機能概要

**目的:** ログイン不要で外部ユーザー（採用候補者、研修受講者）がAIアバターとの会話セッションを実行できる機能

**主要価値:**
- 採用面接の一次スクリーニング自動化
- 候補者体験の向上（アカウント登録不要）
- 研修・教育の標準化・定量化
- 数百〜数千人規模の候補者処理

---

## 📊 実装スコープ

### 主要機能（8項目）

| 機能                     | 優先度 | 推定工数 |
| ------------------------ | ------ | -------- |
| ゲストセッション作成     | P0     | 3日      |
| バッチ作成（複数一括）   | P1     | 2日      |
| URLトークン認証          | P0     | 2日      |
| PINコード認証            | P0     | 2日      |
| ブルートフォース対策     | P0     | 2日      |
| セッション実行（ゲストモード） | P0     | 3日      |
| 招待メール送信           | P1     | 2日      |
| データ自動削除（GDPR）   | P2     | 2日      |

**合計:** 18日 ≒ **4週間**（バッファ含む）

---

## 🏗️ アーキテクチャサマリー

### データベース拡張

**新規テーブル:**
- `guest_sessions` - ゲストセッション管理
- `guest_session_logs` - アクセスログ

**既存テーブル拡張:**
- `sessions` - `isGuestSession`, `guestSessionId` 追加

**DynamoDB:**
- `prance-guest-rate-limits-{env}` - ブルートフォース対策

### API エンドポイント（10個）

**内部ユーザー用（7個）:**
- `POST /api/guest-sessions` - 作成
- `POST /api/guest-sessions/batch` - バッチ作成
- `GET /api/guest-sessions` - 一覧
- `GET /api/guest-sessions/:id` - 詳細
- `PATCH /api/guest-sessions/:id` - 更新
- `DELETE /api/guest-sessions/:id` - 無効化
- `GET /api/guest-sessions/:id/logs` - ログ

**ゲストユーザー用（3個）:**
- `GET /api/guest/verify/:token` - トークン検証
- `POST /api/guest/auth` - PIN認証
- `GET /api/guest/session` - セッション情報

### Lambda関数（13個）

```
infrastructure/lambda/
├── guest-sessions/ (7関数)
│   ├── create/
│   ├── batch-create/
│   ├── list/
│   ├── get/
│   ├── update/
│   ├── delete/
│   └── get-logs/
├── guest/ (4関数)
│   ├── verify/
│   ├── auth/
│   ├── get-session/
│   └── complete/
└── notifications/ (2関数)
    ├── send-invite-email/
    └── cleanup/
```

### UI画面（6画面）

**内部ユーザー:**
- `/dashboard/guest-sessions` - 一覧
- `/dashboard/guest-sessions/create` - 作成（3ステップウィザード）
- `/dashboard/guest-sessions/:id` - 詳細

**ゲストユーザー:**
- `/guest/:token` - ランディング（PIN入力）
- `/guest/:token/session` - セッション実行
- `/guest/:token/completed` - 完了画面

---

## 🔐 セキュリティ設計サマリー

### 認証フロー

```
1. 内部ユーザーがゲストセッション作成
   ↓
2. システムがUUID v4トークン + 4桁PIN生成
   ↓
3. ゲストがURL（/guest/{token}）にアクセス
   ↓
4. PIN入力 → bcryptハッシュ照合
   ↓
5. JWT発行（type: "guest"）
   ↓
6. WebSocket接続でセッション開始
```

### ブルートフォース対策

- **制限:** 5回失敗で10分ロックアウト
- **実装:** DynamoDB + Lambda（レート制限）
- **監視:** CloudWatch Alarms

### データ隔離

- **ゲスト:** 自己のセッションデータのみアクセス可能
- **録画・評価データ:** ゲストは閲覧不可（内部ユーザーのみ）
- **GDPR対応:** 自動削除機能（30-180日設定可能）

---

## 📅 実装フェーズ

### Phase 1: データベース・基盤（Week 1）

**Day 1-2: Prismaスキーマ・マイグレーション**
- `GuestSession`, `GuestSessionLog` モデル追加
- マイグレーション生成・実行
- `Session` モデル拡張

**Day 3-4: 共有ユーティリティ**
- `guestToken.ts` - JWT発行・検証
- `pinHash.ts` - bcrypt
- `tokenGenerator.ts` - UUID v4 + PIN生成
- `rateLimiter.ts` - DynamoDB レート制限

**Day 5-7: Lambda関数基盤**
- CDK Stack作成（`GuestSessionStack`）
- DynamoDB テーブル作成
- API Gateway設定

**成果物:**
- Prismaスキーマ更新
- 共有ユーティリティ（4ファイル）
- CDK Stack

---

### Phase 2: API実装（Week 2）

**Day 1-2: ゲストセッション作成API**
- `POST /api/guest-sessions`
- `POST /api/guest-sessions/batch`
- バリデーション・エラーハンドリング

**Day 3-4: ゲスト認証API**
- `GET /api/guest/verify/:token`
- `POST /api/guest/auth`
- ブルートフォース対策実装

**Day 5-7: その他API**
- 一覧・詳細・更新・無効化API
- ログ取得API
- セッション情報・完了API

**成果物:**
- Lambda関数13個
- API統合テスト

---

### Phase 3: UI実装（Week 3）

**Day 1-3: ゲストセッション作成UI**
- `/dashboard/guest-sessions/create`
- 3ステップウィザード
- バッチ作成UI（CSVアップロード）

**Day 4-5: ゲストランディングページ**
- `/guest/:token`
- PIN入力フォーム
- エラーハンドリング

**Day 6-7: ゲストセッション実行UI**
- セッションプレイヤー拡張（ゲストモード）
- 完了画面
- レスポンシブデザイン

**成果物:**
- UI画面6画面
- コンポーネント10個

---

### Phase 4: 通知・自動化（Week 4）

**Day 1-3: メール通知**
- Amazon SES統合
- 招待メールテンプレート（HTML + Text）
- バッチ送信（20件/秒制限対応）

**Day 4-7: 自動化タスク**
- 有効期限切れセッション自動無効化
- データ自動削除（EventBridge + Lambda）
- E2Eテスト（Playwright）
- 負荷テスト（100同時セッション）

**成果物:**
- メール送信システム
- 自動化Lambda関数
- E2Eテストスイート

---

## 🧪 テスト計画

### 単体テスト（80%以上カバレッジ）

- [ ] トークン生成（UUID v4衝突なし）
- [ ] PINコード生成（ランダム性検証）
- [ ] PIN ハッシュ化・検証（bcrypt）
- [ ] JWT発行・検証
- [ ] 有効期限チェック
- [ ] ブルートフォース対策

### 統合テスト

**正常系:**
- ゲストセッション作成 → トークン発行 → PIN認証 → セッション実行 → 完了

**異常系:**
- 無効なトークン → 404エラー
- 誤ったPIN（5回） → ロックアウト
- 有効期限切れ → 403エラー
- 既に完了済み → 409エラー

### E2Eテスト（Playwright）

```typescript
test('ゲストユーザーフロー: 招待URLからセッション完了まで', async ({ page }) => {
  // 1. 内部ユーザーがゲストセッション作成
  // 2. 招待URLを取得
  // 3. ゲストが招待URLにアクセス
  // 4. PINコード入力
  // 5. セッション実行（30秒）
  // 6. セッション完了確認
});

test('ブルートフォース対策: 5回失敗でロックアウト', async ({ page }) => {
  // 5回失敗 → ロックアウト確認
});
```

### 負荷テスト

- **同時アクセス数:** 100ゲストセッション
- **目標レスポンス:** P95 < 2秒
- **エラー率:** < 0.1%

---

## 📈 成功指標（KPI）

| 指標                       | 目標値               |
| -------------------------- | -------------------- |
| ゲストセッション作成時間   | < 1秒                |
| PIN認証レスポンス          | < 500ms              |
| セッション開始時間         | < 2秒                |
| 同時セッション数           | 100                  |
| ブルートフォース検知率     | 100%                 |
| メール送信成功率           | > 99.5%              |
| データ削除遅延             | < 1時間              |
| セキュリティ脆弱性         | 0件（ペネトレーションテスト） |

---

## 🚨 リスクと対策

| リスク                     | 影響度 | 対策                                     |
| -------------------------- | ------ | ---------------------------------------- |
| セキュリティ脆弱性         | 高     | ペネトレーションテスト、セキュリティ監査 |
| メール送信制限             | 中     | SES Production Access申請                |
| ブルートフォース攻撃       | 中     | レート制限強化、IP ブロックリスト        |
| データ削除事故             | 高     | Soft Delete実装、削除前確認              |
| 負荷対応不足               | 中     | 負荷テスト、Auto Scaling設定確認         |

---

## 📚 関連ドキュメント

| ドキュメント                              | 説明                         |
| ----------------------------------------- | ---------------------------- |
| `GUEST_USER_SYSTEM.md`                    | 基本設計・アーキテクチャ     |
| `GUEST_USER_IMPLEMENTATION_PLAN.md`       | 詳細実装計画（このドキュメント） |
| `GUEST_USER_SECURITY.md`                  | セキュリティ設計詳細         |
| `GUEST_USER_E2E_TEST.md`                  | E2Eテスト計画                |

---

## ✅ 実装準備チェックリスト

### 前提条件

- [ ] Phase 1完了（セッション管理、録画機能）
- [ ] Phase 1.5完了（リアルタイム会話）
- [ ] Phase 1.6完了（既存機能の実用レベル化）
- [ ] データベーススキーマ完了（無音管理等）

### 調査完了

- [ ] 既存システム統合ポイント調査
- [ ] セキュリティ要件調査
- [ ] UI/UX要件調査
- [ ] メール通知システム調査

### インフラ準備

- [ ] Amazon SES Production Access取得
- [ ] DynamoDB テーブル容量確認
- [ ] Lambda 同時実行数制限確認（100以上）
- [ ] CloudWatch Alarms設定

### チーム準備

- [ ] 開発担当者アサイン
- [ ] セキュリティレビュー担当者確定
- [ ] E2Eテスト環境準備

---

## 🚀 次のステップ

1. **Phase 1.5 音声バグ修正のテスト完了**
   - Lambda デプロイ完了待ち
   - 音声再生テスト実施
   - バグ修正確認

2. **Phase 1.6 実用レベル化**
   - エラーハンドリング強化
   - パフォーマンス最適化

3. **ゲストユーザー機能実装開始**
   - Phase 1 Week 1: データベース・基盤
   - 週次進捗レビュー

---

**最終更新:** 2026-03-11 16:15 JST
**承認待ち:** プロダクトマネージャー承認後、実装開始
