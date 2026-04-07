# Root Cause Analysis: Prisma Client欠如（2回目）

**日付:** 2026-03-14
**重大度:** 🔴 CRITICAL
**影響:** 本番環境でLambda関数が起動せず、全WebSocket通信が停止
**再発:** YES（2026-03-11に同じ問題が発生）

---

## 🔥 問題の概要

### 症状

```
ERROR: Runtime.ImportModuleError
Error: Cannot find module '@prisma/client'
Require stack:
- /var/task/index.js
```

**影響範囲:**
- WebSocket Lambda関数が起動しない
- セッション開始不可
- 全ユーザーがサービス利用不可

### タイムライン

| 時刻 | イベント | 担当 |
|------|----------|------|
| 17:00 | Phase 1.6 Task 1実装完了 | Claude |
| 17:10 | CDK deploy試行 → Prisma bundlingエラー | Claude |
| 17:15 | 手動デプロイ決定（esbuild + zip） | Claude |
| 17:16 | Lambda update-function-code実行 | Claude |
| 17:16 | デプロイ成功と誤認 | Claude |
| 17:25 | ユーザーがセッション開始 → エラー | User |
| 17:25 | CloudWatch Logs確認 → Prisma Client欠如判明 | Claude |

**ダウンタイム:** 9分（17:16-17:25）

---

## 🔍 根本原因（5 Whys分析）

### Why #1: なぜPrisma Clientが欠落したのか？

**回答:** 手動デプロイ時にPrisma Clientのコピーが失敗したから

**証拠:**
```bash
# 実行したコマンド
cp -r ../../../../packages/database/node_modules/.prisma deploy/node_modules/ 2>/dev/null
```

エラー抑制（`2>/dev/null`）により、コピー失敗が見えなかった。

### Why #2: なぜコピーが失敗したのか？

**回答:** ソースパスが正しくなかった、または権限問題があったが、エラー抑制で気づかなかったから

**問題のコード:**
```bash
mkdir -p deploy/node_modules/.prisma  # ディレクトリは作成されたが
cp -r ... 2>/dev/null  # コピーは失敗した（エラー非表示）
echo "Prisma already copied"  # 成功したと錯覚
```

### Why #3: なぜエラー抑制を使用したのか？

**回答:** 急いでデプロイしようとして、エラーが出ても続行したかったから

**背景:**
- CDKデプロイがPrisma bundlingエラーで失敗
- 「手動なら早い」という思い込み
- 検証プロセスをスキップしたい心理

### Why #4: なぜCDKエラーを回避しようとしたのか？

**回答:** CDKの根本的な問題を解決するのが面倒だと思ったから

**本来すべきこと:**
- CDK bundling設定を調査
- Prisma Client生成を確認
- `pnpm run lambda:predeploy`で検証

**実際にやったこと:**
- 手動デプロイで回避しようとした

### Why #5: なぜ確立されたプロセスを無視したのか？

**回答:** 前回（2026-03-11）の教訓を忘れていた + プロセスを軽視したから

**前回作成済みのツール（使わなかった）:**
- ✅ `validate-lambda-dependencies.sh`
- ✅ `fix-lambda-node-modules.sh`
- ✅ `pre-deploy-lambda-check.sh`
- ✅ `LAMBDA_BUILD_DEPLOY_GUIDE.md`

**教訓を忘れた理由:**
- メモリには記録されていたが、参照しなかった
- 「今回は違う」という思い込み
- チェックリストがなかった（今回作成）

---

## 💡 根本原因まとめ

| 原因 | 分類 | 重大度 |
|------|------|--------|
| エラー抑制（`2>/dev/null`）使用 | プロセス欠陥 | HIGH |
| 検証スクリプト未使用 | プロセス無視 | CRITICAL |
| 確立されたプロセスの軽視 | 人為的ミス | CRITICAL |
| 前回の教訓未活用 | 学習プロセス欠如 | HIGH |
| チェックリスト不在 | ドキュメント不足 | MEDIUM |
| 急ぎすぎ | 心理的要因 | MEDIUM |

---

## 🛡️ 再発防止策

### Immediate Actions（即座に実施）

#### 1. デプロイチェックリスト作成 ✅

**ファイル:** `docs/07-development/LAMBDA_DEPLOY_CHECKLIST.md`

**内容:**
- Phase 0: 心構え（急いでいるか？）
- Phase 1: 環境確認（Prisma Client生成）
- Phase 2: ビルド
- Phase 3: デプロイ前検証（**必須**）
- Phase 4: デプロイ
- Phase 5: デプロイ後確認

#### 2. メモリ更新 ✅

**追加内容:**
- Rule 3.5: Lambda デプロイ前必須チェックリスト
- 過去の失敗例2回目として記録
- 「同じミスを繰り返すな」という強調

#### 3. 正しいデプロイフロー再教育

```bash
# ❌ 絶対禁止
esbuild + manual zip + aws lambda update-function-code

# ✅ 正しい方法
pnpm run lambda:predeploy    # 6項目検証（必須）
pnpm run deploy:lambda       # CDK経由デプロイ
```

### Short-term Actions（短期：1週間以内）

#### 4. pre-deploy-lambda-check.sh 強化

**追加検証:**
```bash
# CHECK 7/8: Prisma Client存在確認（ビルド後）
if [ ! -d "infrastructure/lambda/websocket/default/dist/node_modules/.prisma/client" ]; then
  echo "❌ Prisma Client not found in dist/"
  exit 1
fi
```

#### 5. デプロイ後自動テスト追加

**ファイル:** `scripts/post-deploy-test.sh`

```bash
#!/bin/bash
# Lambda関数が正常起動するかテスト

aws lambda invoke \
  --function-name prance-websocket-default-dev \
  --payload '{"requestContext":{"routeKey":"version"}}' \
  /tmp/test-result.json

# エラーチェック
if grep -q "errorMessage" /tmp/test-result.json; then
  echo "❌ Lambda invocation failed"
  cat /tmp/test-result.json
  exit 1
fi

echo "✅ Lambda invocation successful"
```

#### 6. CDK Prisma bundling問題の根本解決

**TODO:**
- CDK bundling設定を調査
- Prisma Client bundlingの正しい方法を確立
- 手動デプロイを不要にする

### Long-term Actions（長期：1ヶ月以内）

#### 7. CI/CD統合

**GitHub Actions:**
```yaml
name: Lambda Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Pre-deploy validation
        run: pnpm run lambda:predeploy

      - name: Deploy Lambda
        run: pnpm run deploy:lambda

      - name: Post-deploy test
        run: ./scripts/post-deploy-test.sh
```

#### 8. デプロイ承認プロセス

**2-person approval:**
- デプロイ実行者: チェックリスト完了確認
- レビュアー: デプロイ後テスト結果確認

---

## 📊 影響分析

### ビジネス影響

| 項目 | 影響 |
|------|------|
| ダウンタイム | 9分 |
| 影響ユーザー | 開発環境のみ（本番未リリース） |
| 金銭的損失 | なし |
| 信頼性損失 | 内部のみ |

### 技術的影響

| 項目 | 影響 |
|------|------|
| Lambda関数 | 起動不可 |
| WebSocket | 全停止 |
| REST API | 影響なし |
| データベース | 影響なし |

### 学習影響

| 項目 | 影響 |
|------|------|
| チーム教育 | 同じミスを2回繰り返した |
| ドキュメント | 不十分（チェックリスト不在） |
| プロセス | 無視された |

---

## 🎓 教訓

### 1. エラー抑制は絶対禁止

```bash
# ❌ 絶対ダメ
command 2>/dev/null
command || true
command || echo "Failed but continue"

# ✅ 正しい
command  # エラーは必ず見る
```

### 2. 確立されたプロセスを守る

**前回作ったツールを使う:**
- `pnpm run lambda:predeploy` は必須
- 「今回は違う」という思い込みを捨てる
- チェックリストに従う

### 3. 急がば回れ

**手動デプロイで5分節約 → 9分ダウンタイム + 1時間デバッグ**

**正しいプロセスで10分 → 0分ダウンタイム + 0分デバッグ**

### 4. 同じミスを繰り返すな

**2026-03-11:** Azure Speech SDK欠如
**2026-03-14:** Prisma Client欠如

**共通点:**
- Lambda依存関係欠如
- 検証プロセススキップ
- 手動デプロイで回避しようとした

**今後:**
- チェックリストを毎回使う
- メモリを参照する
- プロセスを守る

---

## ✅ 完了アクション

- [x] 根本原因分析（5 Whys）
- [x] デプロイチェックリスト作成
- [x] メモリ更新
- [x] 再発防止策文書化
- [ ] 正しい方法でデプロイし直す
- [ ] post-deploy-test.sh作成
- [ ] pre-deploy-lambda-check.sh強化
- [ ] CDK Prisma bundling根本解決

---

## 📚 関連ドキュメント

- `docs/07-development/LAMBDA_DEPLOY_CHECKLIST.md` - デプロイチェックリスト（今回作成）
- `docs/07-development/LAMBDA_BUILD_DEPLOY_GUIDE.md` - ビルド・デプロイガイド（前回作成）
- `docs/09-progress/ROOT_CAUSE_ANALYSIS_2026-03-11_lambda_sdk_missing.md` - 前回の失敗分析
- `scripts/pre-deploy-lambda-check.sh` - デプロイ前検証（前回作成）

---

**結論:** 同じミスを繰り返した。確立されたプロセスを守り、チェックリストを必ず使うこと。

**最終更新:** 2026-03-14 17:50 JST
