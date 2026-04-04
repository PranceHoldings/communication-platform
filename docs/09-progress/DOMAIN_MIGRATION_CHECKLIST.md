# Domain Migration Checklist

**作成日:** 2026-03-13 00:45 JST
**ドメイン:** prance.jp → prance.jp
**URL構造:** platform.prance.jp → app.prance.jp

---

## 事前準備

- [ ] Route 53でHosted Zone作成
  ```bash
  aws route53 create-hosted-zone \
    --name app.prance.jp \
    --caller-reference "prance-app-$(date +%s)"
  ```

- [ ] お名前.comでNSレコード設定
  - サブドメイン: `app`
  - レコードタイプ: `NS`
  - 値: Route 53のネームサーバー4つ

- [ ] DNS伝播確認（10-60分）
  ```bash
  dig app.prance.jp NS +short
  # 4つのネームサーバーが表示されること
  ```

---

## Phase 0: バックアップ

- [ ] バックアップスクリプト実行
  ```bash
  cd /workspaces/prance-communication-platform/scripts/domain-migration
  ./00-backup.sh
  ```

- [ ] バックアップ確認
  - [ ] `backups/domain-migration-*/` ディレクトリ作成
  - [ ] `infrastructure/lib/config.ts` バックアップ
  - [ ] `infrastructure/lib/*-stack.ts` バックアップ
  - [ ] `.env` ファイルバックアップ
  - [ ] ドキュメントバックアップ

---

## Phase 1: コード変更

### 自動更新

- [ ] Phase 1スクリプト実行
  ```bash
  ./01-update-config.sh
  ```

- [ ] 自動更新確認
  - [ ] `infrastructure/lib/config.ts`
    - [ ] `ROOT_DOMAIN = 'prance.jp'`
    - [ ] `PLATFORM_DOMAIN = 'app.prance.jp'`
    - [ ] dev.domain 設定更新
    - [ ] staging.domain 設定更新
    - [ ] production.domain 設定更新
  - [ ] `infrastructure/lib/dns-stack.ts`
    - [ ] コメント内のドメイン名更新

### 手動編集

- [ ] `infrastructure/lib/api-lambda-stack.ts`
  - [ ] commonEnv に `FRONTEND_URL` 追加
    ```typescript
    FRONTEND_URL: `https://${config.domain.fullDomain}`,
    ```

- [ ] `infrastructure/lib/cognito-stack.ts`
  - [ ] `callbackUrls` 追加
    ```typescript
    callbackUrls: [
      `https://${config.domain.fullDomain}/auth/callback`,
      'http://localhost:3000/auth/callback',
    ],
    ```
  - [ ] `logoutUrls` 追加
    ```typescript
    logoutUrls: [
      `https://${config.domain.fullDomain}/auth/logout`,
      'http://localhost:3000/auth/logout',
    ],
    ```

- [ ] （オプション）本番環境CORS制限
  - [ ] `infrastructure/lib/storage-stack.ts`
    - [ ] S3 CORS allowedOrigins を特定ドメインに制限
  - [ ] `infrastructure/lib/api-gateway-stack.ts`
    - [ ] API Gateway CORS allowOrigins を特定ドメインに制限

---

## Phase 2: ドキュメント更新

- [ ] Phase 2スクリプト実行
  ```bash
  ./02-update-docs.sh
  ```

- [ ] 更新されたドキュメント確認
  - [ ] `docs/06-infrastructure/DOMAIN_SETUP_SUMMARY.md`
  - [ ] `docs/05-modules/MULTILINGUAL_SYSTEM.md`
  - [ ] `docs/10-reference/GLOSSARY.md`
  - [ ] `infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md`
  - [ ] `infrastructure/docs/QUICKSTART_DOMAIN.md`
  - [ ] `infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md`
  - [ ] `infrastructure/docs/DOMAIN_SETUP.md`
  - [ ] `infrastructure/README.md`
  - [ ] `START_HERE.md`
  - [ ] `CLAUDE.md`

---

## Phase 3: 環境変数更新

### 自動更新

- [ ] Phase 3スクリプト実行
  ```bash
  ./03-update-env.sh
  ```

- [ ] 自動更新確認
  - [ ] `.env.example`
  - [ ] `infrastructure/.env`
  - [ ] `apps/web/.env.local.example`

### 手動編集

- [ ] `.env.local` (存在する場合)
  ```bash
  FRONTEND_URL=https://dev.app.prance.jp
  ```

- [ ] `apps/web/.env.local` (存在する場合)
  ```bash
  NEXT_PUBLIC_APP_URL=https://dev.app.prance.jp
  ```

---

## Phase 4: 変更確認

- [ ] Git差分確認
  ```bash
  git status
  git diff
  ```

- [ ] 主要ファイル個別確認
  ```bash
  git diff infrastructure/lib/config.ts
  git diff infrastructure/lib/api-lambda-stack.ts
  git diff infrastructure/lib/cognito-stack.ts
  ```

- [ ] バックアップファイル確認
  ```bash
  find . -name "*.backup" -type f
  ```

---

## Phase 5: コミット

- [ ] ステージング
  ```bash
  git add .
  ```

- [ ] コミット
  ```bash
  git commit -m "chore: migrate domain from prance.jp to prance.jp"
  ```

- [ ] プッシュ（任意）
  ```bash
  git push origin main
  ```

---

## Phase 6: CDKデプロイ（開発環境）

### 6.1 DNS Stack

- [ ] デプロイ
  ```bash
  cd infrastructure
  pnpm run cdk -- deploy Prance-dev-Dns --require-approval never
  ```

- [ ] 出力確認
  - [ ] Hosted Zone ID
  - [ ] Hosted Zone Name: `app.prance.jp`
  - [ ] Application Domain: `dev.app.prance.jp`

### 6.2 Certificate Stack

- [ ] デプロイ（us-east-1）
  ```bash
  pnpm run cdk -- deploy Prance-dev-Certificate \
    --require-approval never \
    --region us-east-1
  ```

- [ ] 出力確認
  - [ ] Certificate ARN
  - [ ] Certificate Domain: `dev.app.prance.jp`

- [ ] 証明書ステータス確認
  ```bash
  aws acm describe-certificate \
    --certificate-arn <ARN> \
    --region us-east-1 \
    --query 'Certificate.Status'
  ```
  - [ ] ステータス: `ISSUED` （5-30分待機）

### 6.3 Storage Stack

- [ ] デプロイ
  ```bash
  pnpm run cdk -- deploy Prance-dev-Storage --require-approval never
  ```

- [ ] 出力確認
  - [ ] CDN Domain Name（CloudFront）
  - [ ] Custom Domain Name: `dev.app.prance.jp`
  - [ ] Application URL: `https://dev.app.prance.jp`

- [ ] CloudFront Distribution確認
  ```bash
  aws cloudfront list-distributions \
    --query "DistributionList.Items[?Aliases.Items[?contains(@, 'dev.app.prance.jp')]].{Id:Id,Status:Status}"
  ```
  - [ ] Status: `Deployed` （10-15分待機）

### 6.4 API Lambda Stack

- [ ] デプロイ
  ```bash
  pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
  ```

- [ ] Lambda環境変数確認
  ```bash
  aws lambda get-function-configuration \
    --function-name prance-guest-sessions-create-dev \
    --query 'Environment.Variables.FRONTEND_URL'
  ```
  - [ ] 出力: `"https://dev.app.prance.jp"`

### 6.5 Cognito Stack

- [ ] デプロイ
  ```bash
  pnpm run cdk -- deploy Prance-dev-Cognito --require-approval never
  ```

- [ ] User Pool Client確認
  ```bash
  aws cognito-idp describe-user-pool-client \
    --user-pool-id <POOL_ID> \
    --client-id <CLIENT_ID> \
    --query 'UserPoolClient.CallbackURLs'
  ```
  - [ ] 含まれること: `https://dev.app.prance.jp/auth/callback`

---

## Phase 7: 動作確認

### 7.1 DNS確認

- [ ] A Record確認
  ```bash
  dig dev.app.prance.jp A +short
  ```
  - [ ] IPアドレスが返ること（CloudFront）

- [ ] HTTP確認
  ```bash
  curl -I https://dev.app.prance.jp
  ```
  - [ ] ステータス: 200 OK または CloudFront応答

### 7.2 SSL証明書確認

- [ ] 証明書情報確認
  ```bash
  echo | openssl s_client -connect dev.app.prance.jp:443 -servername dev.app.prance.jp 2>/dev/null | openssl x509 -noout -subject -dates
  ```
  - [ ] subject: `CN=dev.app.prance.jp`
  - [ ] notAfter: 有効期限が未来

### 7.3 アプリケーション動作確認

#### フロントエンド起動

- [ ] 開発サーバー起動
  ```bash
  cd apps/web
  pnpm run dev
  ```

- [ ] ブラウザアクセス
  - [ ] http://localhost:3000 にアクセス
  - [ ] ページ表示確認

#### ゲストセッション作成テスト

- [ ] 認証トークン取得
  ```bash
  TOKEN=$(curl -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@prance.com","password":"Admin2026!Prance"}' \
    | jq -r .accessToken)
  echo "Token: $TOKEN"
  ```

- [ ] ゲストセッション作成
  ```bash
  curl -X POST https://ffypxkomg1.execute-api.us-east-1.amazonaws.com/dev/api/v1/guest-sessions \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "scenarioId":"<YOUR_SCENARIO_ID>",
      "validUntil":"2026-12-31T23:59:59Z"
    }' | jq .
  ```

- [ ] inviteURL確認
  - [ ] 出力: `"inviteUrl": "https://dev.app.prance.jp/guest/..."`
  - [ ] ドメインが `dev.app.prance.jp` であること

#### 認証フロー確認

- [ ] ログインページアクセス
  - [ ] http://localhost:3000/auth/login

- [ ] Cognitoリダイレクト確認
  - [ ] リダイレクト先にCognito UIが表示される

- [ ] Callback URL確認（ログイン後）
  - [ ] リダイレクト先: `http://localhost:3000/auth/callback`

---

## トラブルシューティング

### DNS解決エラー

- [ ] NSレコード確認（お名前.com）
  - [ ] サブドメイン: `app`
  - [ ] レコードタイプ: `NS`
  - [ ] 値: 4つのネームサーバー

- [ ] DNS伝播確認
  ```bash
  dig app.prance.jp NS +short
  ```

- [ ] 待機（10-60分）

### SSL証明書エラー

- [ ] 証明書ステータス確認
  ```bash
  aws acm describe-certificate --certificate-arn <ARN> --region us-east-1
  ```

- [ ] ステータスが `PENDING_VALIDATION` → 待機（5-30分）

- [ ] ステータスが `ISSUED` → CloudFront更新待機（10-15分）

### CloudFront応答なし

- [ ] Distribution確認
  ```bash
  aws cloudfront list-distributions \
    --query "DistributionList.Items[?Aliases.Items[?contains(@, 'dev.app.prance.jp')]].{Id:Id,Status:Status}"
  ```

- [ ] Status が `InProgress` → 待機（10-15分）

- [ ] A Record確認
  ```bash
  aws route53 list-resource-record-sets \
    --hosted-zone-id <ZONE_ID> \
    --query "ResourceRecordSets[?Name=='dev.app.prance.jp.']"
  ```

### inviteURLが古いドメイン

- [ ] Lambda環境変数確認
  ```bash
  aws lambda get-function-configuration \
    --function-name prance-guest-sessions-create-dev \
    --query 'Environment.Variables.FRONTEND_URL'
  ```

- [ ] 未設定または古い値 → `api-lambda-stack.ts` 確認・再デプロイ

### Cognito認証エラー

- [ ] User Pool Client確認
  ```bash
  aws cognito-idp describe-user-pool-client \
    --user-pool-id <POOL_ID> \
    --client-id <CLIENT_ID> \
    --query 'UserPoolClient.CallbackURLs'
  ```

- [ ] 新ドメインが含まれていない → `cognito-stack.ts` 確認・再デプロイ

---

## ロールバック（緊急時）

- [ ] ロールバックスクリプト実行
  ```bash
  cd /workspaces/prance-communication-platform/scripts/domain-migration
  ./99-rollback.sh
  ```

- [ ] CDKスタック再デプロイ
  ```bash
  cd infrastructure
  pnpm run cdk -- deploy Prance-dev-Dns --require-approval never
  pnpm run cdk -- deploy Prance-dev-Certificate --require-approval never --region us-east-1
  pnpm run cdk -- deploy Prance-dev-Storage --require-approval never
  pnpm run cdk -- deploy Prance-dev-ApiLambda --require-approval never
  pnpm run cdk -- deploy Prance-dev-Cognito --require-approval never
  ```

- [ ] 動作確認
  - [ ] `dig dev.app.prance.jp A +short`
  - [ ] `curl -I https://dev.app.prance.jp`

---

## 完了確認

- [ ] 全Phase完了
- [ ] 動作確認全項目クリア
- [ ] トラブルシューティング項目なし

---

## ステージング・本番環境（将来）

### ステージング環境

- [ ] Phase 1-7をステージング環境で実行
  - [ ] `Prance-staging-*` スタック
- [ ] E2Eテスト実行
- [ ] 動作確認

### 本番環境

- [ ] Phase 1-7を本番環境で実行
  - [ ] `Prance-production-*` スタック
- [ ] 本番動作確認
- [ ] モニタリング設定

---

## ドキュメント最終更新

- [ ] 移行完了レポート作成
  - [ ] `docs/09-progress/DOMAIN_MIGRATION_COMPLETE.md`

- [ ] START_HERE.md 更新
  - [ ] URL更新
  - [ ] デプロイ情報更新

- [ ] CLAUDE.md 更新
  - [ ] ドメイン情報更新

---

**推定総時間:** 1-2時間（DNS伝播・証明書発行待機含む）

**次回セッション開始時:**
「ドメイン移行を開始します。チェックリストに従って実行してください。」
