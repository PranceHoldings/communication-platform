# silencePromptTimeout 機能テスト計画

**作成日**: 2026-03-15
**対象機能**: AI会話促し待機時間（silencePromptTimeout）の階層的設定
**実装範囲**: Phase 1.5 - リアルタイム会話実装の一部

---

## 概要

### 実装された機能
- **silencePromptTimeout**: 会話全体を通して、ユーザーの発話がない場合にAIが会話を促すまでの待機時間（秒）
- **階層構造**: Scenario → Organization → System Default (15秒)
- **設定範囲**: 5-60秒
- **設定権限**: CLIENT_ADMIN / SUPER_ADMIN（組織設定）、全ユーザー（シナリオ設定）

### 既存設定との違い
| 設定項目 | 用途 | デフォルト値 | 範囲 | 階層構造 |
|---------|------|------------|------|---------|
| **initialSilenceTimeout** | Azure STT初期無音検出 | 5000ms | 3000-15000ms | Organization only |
| **silenceTimeout** | ユーザー発話終了検出 | 10秒 | 5-60秒 | Scenario → Organization → System Default |
| **silencePromptTimeout** | AI会話促しタイミング | 15秒 | 5-60秒 | Scenario → Organization → System Default |

---

## テストフェーズ

### Phase 1: データモデル整合性検証 ✅ 自動化可能

#### 1.1 Prismaスキーマ定義
- [ ] `packages/database/prisma/schema.prisma` に `silencePromptTimeout Int?` が存在
- [ ] フィールド名が `@map("silence_prompt_timeout")` で正しくマップされている
- [ ] データ型が `Int?` (nullable) である

#### 1.2 マイグレーションファイル
- [ ] `packages/database/prisma/migrations/20260315084516_add_silence_prompt_timeout/migration.sql` が存在
- [ ] マイグレーション内容が正しい: `ALTER TABLE "scenarios" ADD COLUMN "silence_prompt_timeout" INTEGER;`

#### 1.3 Prisma Client生成
- [ ] `npx prisma generate` が成功する
- [ ] 生成された型定義に `silencePromptTimeout` が含まれる

**検証コマンド**:
```bash
npm run test:silence-prompt-timeout -- --phase 1
```

---

### Phase 2: 型定義の整合性検証 ✅ 自動化可能

#### 2.1 共有型定義 (packages/shared)
- [ ] `packages/shared/src/types/index.ts` - `OrganizationSettings` に `silencePromptTimeout?: number` が存在

#### 2.2 Lambda型定義
- [ ] `infrastructure/lambda/shared/types/organization.ts` - `OrganizationSettings` に `silencePromptTimeout?: number` が存在

#### 2.3 フロントエンド型定義
- [ ] `apps/web/lib/api/scenarios.ts` - `Scenario` に `silencePromptTimeout?: number` が存在
- [ ] `apps/web/lib/api/scenarios.ts` - `CreateScenarioRequest` に `silencePromptTimeout?: number` が存在
- [ ] `apps/web/lib/api/scenarios.ts` - `UpdateScenarioRequest` に `silencePromptTimeout?: number` が存在

**検証コマンド**:
```bash
npm run test:silence-prompt-timeout -- --phase 2
```

---

### Phase 3: デフォルト値・バリデーション検証 ✅ 自動化可能

#### 3.1 デフォルト値定義（packages/shared）
- [ ] `packages/shared/src/defaults.ts` - `DEFAULT_ORGANIZATION_SETTINGS.silencePromptTimeout = 15`
- [ ] `packages/shared/src/defaults.ts` - `DEFAULT_SCENARIO_SETTINGS.silencePromptTimeout = undefined`
- [ ] `packages/shared/src/defaults.ts` - `VALIDATION_RANGES.silencePromptTimeout = { min: 5, max: 60 }`

#### 3.2 デフォルト値定義（Lambda）
- [ ] `infrastructure/lambda/shared/defaults.ts` - 上記と同じ値が定義されている

#### 3.3 値の整合性
- [ ] 組織デフォルト値（15秒）が有効範囲（5-60秒）内である
- [ ] シナリオデフォルト値が `undefined`（組織設定を使用）である

**検証コマンド**:
```bash
npm run test:silence-prompt-timeout -- --phase 3
```

---

### Phase 4: Lambda API実装検証 ✅ 自動化可能

#### 4.1 組織設定API
- [ ] `infrastructure/lambda/organizations/settings/index.ts`
  - [ ] バリデーション関数に `silencePromptTimeout` チェックが存在
  - [ ] 範囲チェックが正しい（5-60秒）
  - [ ] エラーメッセージが適切

#### 4.2 シナリオGET API
- [ ] `infrastructure/lambda/scenarios/get/index.ts`
  - [ ] `select` に `silencePromptTimeout: true` が含まれる

#### 4.3 シナリオUPDATE API
- [ ] `infrastructure/lambda/scenarios/update/index.ts`
  - [ ] `body` から `silencePromptTimeout` を抽出
  - [ ] `updateData` に追加（`'silencePromptTimeout' in body` チェック使用）
  - [ ] レスポンス `select` に含まれる

#### 4.4 シナリオCREATE API
- [ ] `infrastructure/lambda/scenarios/create/index.ts`
  - [ ] `body` から `silencePromptTimeout` を抽出
  - [ ] `data` に追加
  - [ ] レスポンス `select` に含まれる

#### 4.5 シナリオLIST API
- [ ] `infrastructure/lambda/scenarios/list/index.ts`
  - [ ] `select` に `silencePromptTimeout: true` が含まれる

#### 4.6 セッションGET API
- [ ] `infrastructure/lambda/sessions/get/index.ts`
  - [ ] `scenario.select` に `silencePromptTimeout: true` が含まれる

**検証コマンド**:
```bash
npm run test:silence-prompt-timeout -- --phase 4
```

---

### Phase 5: フロントエンドUI実装検証 ✅ 自動化可能

#### 5.1 組織設定画面
- [ ] `apps/web/app/dashboard/settings/page.tsx`
  - [ ] state定義: `const [silencePromptTimeout, setSilencePromptTimeout] = useState(15)`
  - [ ] 設定読み込み: `if (settings.silencePromptTimeout !== undefined) setSilencePromptTimeout(...)`
  - [ ] 設定保存: `updateOrganizationSettings({ ..., silencePromptTimeout, ... })`
  - [ ] デフォルトリセット: `setSilencePromptTimeout(DEFAULT_ORGANIZATION_SETTINGS.silencePromptTimeout!)`
  - [ ] UI input要素が存在

#### 5.2 シナリオ詳細画面
- [ ] `apps/web/app/dashboard/scenarios/[id]/page.tsx`
  - [ ] 表示ロジックが存在: `scenario.silencePromptTimeout !== null && scenario.silencePromptTimeout !== undefined`
  - [ ] 「デフォルト使用」表示ロジックが存在

#### 5.3 翻訳ファイル
- [ ] `apps/web/messages/en/settings.json`
  - [ ] `silencePromptTimeout` キーが存在
  - [ ] `silencePromptTimeoutHelp` キーが存在
- [ ] `apps/web/messages/ja/settings.json`
  - [ ] 上記と同じキーが存在
- [ ] `apps/web/messages/en/scenarios.json`
  - [ ] `detail.silencePromptTimeout` キーが存在
- [ ] `apps/web/messages/ja/scenarios.json`
  - [ ] 上記と同じキーが存在

**検証コマンド**:
```bash
npm run test:silence-prompt-timeout -- --phase 5
```

---

### Phase 6: 統合テスト（手動） ⚠️ 手動実施必須

#### 6.1 データベースマイグレーション
```bash
cd infrastructure
npm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
aws lambda invoke --function-name prance-db-migration-dev \
  --payload '{}' /tmp/migration-result.json
cat /tmp/migration-result.json
```

**期待結果**: マイグレーション成功、エラーなし

#### 6.2 組織設定API（GET）
```bash
curl -X GET "https://api-dev.prance-app.com/api/v1/organizations/settings" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**期待結果**:
```json
{
  "enableSilencePrompt": true,
  "silenceTimeout": 10,
  "silencePromptTimeout": 15,
  "silencePromptStyle": "neutral",
  "showSilenceTimer": true,
  "silenceThreshold": 0.12,
  "minSilenceDuration": 500,
  "initialSilenceTimeout": 5000
}
```

#### 6.3 組織設定API（UPDATE）
```bash
curl -X PUT "https://api-dev.prance-app.com/api/v1/organizations/settings" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"silencePromptTimeout": 20}'
```

**期待結果**: 更新成功、レスポンスに `"silencePromptTimeout": 20` が含まれる

#### 6.4 組織設定API（バリデーションエラー）
```bash
# 範囲外の値（4秒 < 最小値5秒）
curl -X PUT "https://api-dev.prance-app.com/api/v1/organizations/settings" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"silencePromptTimeout": 4}'
```

**期待結果**: 400 Bad Request、エラーメッセージ `"silencePromptTimeout must be a number between 5 and 60"`

```bash
# 範囲外の値（61秒 > 最大値60秒）
curl -X PUT "https://api-dev.prance-app.com/api/v1/organizations/settings" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"silencePromptTimeout": 61}'
```

**期待結果**: 400 Bad Request、同上エラーメッセージ

#### 6.5 シナリオCREATE API
```bash
curl -X POST "https://api-dev.prance-app.com/api/v1/scenarios" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Silence Prompt Timeout",
    "category": "test",
    "configJson": {},
    "silencePromptTimeout": 25
  }'
```

**期待結果**: 201 Created、レスポンスに `"silencePromptTimeout": 25` が含まれる

#### 6.6 シナリオGET API
```bash
SCENARIO_ID="<上記で作成したシナリオID>"
curl -X GET "https://api-dev.prance-app.com/api/v1/scenarios/$SCENARIO_ID" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**期待結果**: レスポンスに `"silencePromptTimeout": 25` が含まれる

#### 6.7 シナリオUPDATE API（明示的に設定）
```bash
curl -X PUT "https://api-dev.prance-app.com/api/v1/scenarios/$SCENARIO_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"silencePromptTimeout": 30}'
```

**期待結果**: レスポンスに `"silencePromptTimeout": 30` が含まれる

#### 6.8 シナリオUPDATE API（nullで組織デフォルト使用）
```bash
curl -X PUT "https://api-dev.prance-app.com/api/v1/scenarios/$SCENARIO_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"silencePromptTimeout": null}'
```

**期待結果**: レスポンスに `"silencePromptTimeout": null` が含まれる

#### 6.9 UI検証（組織設定画面）
1. http://localhost:3000/dashboard/settings にアクセス
2. **AI & Audio Settings** セクションを確認
3. **Enable Silence Prompt** を有効化
4. **AI prompt trigger timeout** フィールドが表示されることを確認
5. デフォルト値 `15` が表示されることを確認
6. 値を `20` に変更
7. **Save Settings** ボタンをクリック
8. 成功トースト表示を確認
9. ページをリロード
10. 値が `20` のまま保持されていることを確認

**期待結果**: 全ての操作が正常に動作

#### 6.10 UI検証（シナリオ詳細画面）
1. テストシナリオの詳細ページにアクセス
2. **Silence Timer Settings** セクションを確認
3. **AI Prompt Trigger Timeout** の表示を確認
4. シナリオで設定した値（例: 30秒）が表示される、または「Use Default」バッジが表示されることを確認

**期待結果**: 正しい値またはデフォルト使用が表示される

#### 6.11 階層的設定の動作確認
| テストケース | Scenario値 | Organization値 | 期待される動作 |
|------------|-----------|---------------|-------------|
| Case 1 | 30秒 | 20秒 | シナリオ値（30秒）を使用 |
| Case 2 | null | 20秒 | 組織値（20秒）を使用 |
| Case 3 | null | null | システムデフォルト（15秒）を使用 |

**検証方法**: SessionPlayer で実際にタイマーが正しい値で動作することを確認（Day 19以降のWebSocket実装後）

---

## 自動検証スクリプト

### 実行方法
```bash
# 全フェーズ実行
npm run test:silence-prompt-timeout

# 特定フェーズのみ実行
npm run test:silence-prompt-timeout -- --phase 1
npm run test:silence-prompt-timeout -- --phase 2
npm run test:silence-prompt-timeout -- --phase 3
npm run test:silence-prompt-timeout -- --phase 4
npm run test:silence-prompt-timeout -- --phase 5

# すべての自動テストを実行（Phase 1-5）
npm run test:silence-prompt-timeout -- --auto-only
```

### 実装場所
`/workspaces/prance-communication-platform/scripts/test-silence-prompt-timeout.sh`

---

## チェックリスト（実施記録）

### 自動検証（Phase 1-5）
- [ ] Phase 1: データモデル整合性検証 - **実施日**: ____
- [ ] Phase 2: 型定義の整合性検証 - **実施日**: ____
- [ ] Phase 3: デフォルト値・バリデーション検証 - **実施日**: ____
- [ ] Phase 4: Lambda API実装検証 - **実施日**: ____
- [ ] Phase 5: フロントエンドUI実装検証 - **実施日**: ____

### 手動検証（Phase 6）
- [ ] 6.1: データベースマイグレーション - **実施日**: ____
- [ ] 6.2: 組織設定API（GET） - **実施日**: ____
- [ ] 6.3: 組織設定API（UPDATE） - **実施日**: ____
- [ ] 6.4: 組織設定API（バリデーションエラー） - **実施日**: ____
- [ ] 6.5: シナリオCREATE API - **実施日**: ____
- [ ] 6.6: シナリオGET API - **実施日**: ____
- [ ] 6.7: シナリオUPDATE API（明示的設定） - **実施日**: ____
- [ ] 6.8: シナリオUPDATE API（null設定） - **実施日**: ____
- [ ] 6.9: UI検証（組織設定画面） - **実施日**: ____
- [ ] 6.10: UI検証（シナリオ詳細画面） - **実施日**: ____
- [ ] 6.11: 階層的設定の動作確認 - **実施日**: ____

---

## 既知の問題・注意事項

1. **データベースマイグレーション必須**: Phase 6の前に必ずマイグレーションを実行すること
2. **WebSocket実装は別タスク**: 実際のAI prompt timing動作は Day 19以降で実装
3. **初期値の重要性**: 組織デフォルト（15秒）が silenceTimeout（10秒）より長いことに注意

---

## 完了条件

- [ ] Phase 1-5の自動検証が全て合格
- [ ] Phase 6の手動検証が全て合格
- [ ] 階層的設定が正しく動作することを確認
- [ ] ドキュメント（このファイル）の更新完了
