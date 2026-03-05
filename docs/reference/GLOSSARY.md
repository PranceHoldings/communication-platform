# 用語集（Glossary）

Pranceプラットフォームで使用される重要な用語の定義集です。

---

## A

### ACM (AWS Certificate Manager)
AWS提供のSSL/TLS証明書管理サービス。無料で証明書を発行・自動更新可能。

**外部リンク:**
- [AWS ACM 公式ドキュメント](https://docs.aws.amazon.com/acm/)

**関連ドキュメント:**
- [Certificate Stack設計](../infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md#ssl証明書)

### ACU (Aurora Capacity Unit)
Aurora Serverless v2のスケーリング単位。1 ACU = 2GB RAM + CPU。0.5〜16 ACUの範囲で自動スケール。

**外部リンク:**
- [Aurora Serverless v2 公式ドキュメント](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)

**関連ドキュメント:**
- [データベース設計](../docs/DATABASE_DESIGN.md)
- [アーキテクチャ](../docs/ARCHITECTURE.md)

### API Gateway
AWSのAPIエンドポイント管理サービス。RESTful APIやWebSocket APIを提供。

**外部リンク:**
- [API Gateway 公式ドキュメント](https://docs.aws.amazon.com/apigateway/)

**関連ドキュメント:**
- [API仕様書](../docs/API_SPECIFICATION.md)
- [アーキテクチャ](../docs/ARCHITECTURE.md)

### ARKit Blendshapes
Appleが定義する52種類の顔表情パラメータ。3Dアバターのリップシンク・表情制御に使用。

**外部リンク:**
- [ARKit Face Tracking 公式ドキュメント](https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation)

**関連ドキュメント:**
- [企画書: アバターモジュール](../CLAUDE.md#41-アバターモジュール)

### ATS (Applicant Tracking System)
採用管理システム。候補者情報、選考プロセス、面接結果などを一元管理。

**関連ドキュメント:**
- [企画書: ATS連携システム](../CLAUDE.md#414-ats連携システム)

### Aurora Serverless v2
AWSのサーバーレスRDBMS。自動スケール、コールドスタートなし、Prisma Data Proxy対応。

**外部リンク:**
- [Aurora Serverless v2 公式ドキュメント](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)
- [Prisma with Aurora Serverless](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-aws-lambda#aurora-serverless-v2)

**関連ドキュメント:**
- [データベース設計](../docs/DATABASE_DESIGN.md)
- [アーキテクチャ](../docs/ARCHITECTURE.md)

### Avatar
本プラットフォームにおけるAI駆動の仮想キャラクター。2D/3D形式、プリセット/カスタム生成に対応。

**関連ドキュメント:**
- [企画書: アバターモジュール](../CLAUDE.md#41-アバターモジュール)
- [データベース設計: avatarsテーブル](../docs/DATABASE_DESIGN.md)

---

## B

### Bedrock
AWS提供の生成AIサービス。Claude、Llama等の基盤モデルをAPIで利用可能。

**外部リンク:**
- [AWS Bedrock 公式ドキュメント](https://docs.aws.amazon.com/bedrock/)
- [Anthropic Claude on Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude.html)

**関連ドキュメント:**
- [企画書: AIプロバイダ管理](../CLAUDE.md#49-aiプロバイダ管理)
- [外部サービス設定](../docs/reference/EXTERNAL_TOOLS_SETUP.md)

### Benchmark
ユーザーのパフォーマンスを全体データと比較する機能。パーセンタイル順位、成長トラッキング、改善提案を提供。

**関連ドキュメント:**
- [企画書: プロファイルベンチマークシステム](../CLAUDE.md#410-プロファイルベンチマークシステム)

### Blendshape
3Dモデルの表情変化を制御するパラメータ。ARKit 52 Blendshapesが標準。

**参照:** [ARKit Blendshapes](#arkit-blendshapes)

---

## C

### CDK (AWS Cloud Development Kit)
インフラをTypeScriptコードで定義・管理するIaCツール。CloudFormationを内部で使用。

**外部リンク:**
- [AWS CDK 公式ドキュメント](https://docs.aws.amazon.com/cdk/)
- [AWS CDK TypeScript API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)

**関連ドキュメント:**
- [インフラ構成](../docs/ARCHITECTURE.md#インフラストラクチャ)
- [デプロイ手順](../docs/DEPLOYMENT.md)

### CDN (Content Delivery Network)
世界中のエッジサーバーで静的コンテンツを配信するサービス。CloudFrontが該当。

**参照:** [CloudFront](#cloudfront)

### Certificate Stack
SSL/TLS証明書を管理するCDKスタック。ACMで証明書を発行、us-east-1リージョンにデプロイ。

**関連ドキュメント:**
- [DNS設計: SSL証明書](../infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md#ssl証明書)
- [インフラ構成](../docs/ARCHITECTURE.md)

**参照:** [ACM](#acm-aws-certificate-manager)

### Claude
Anthropic社の大規模言語モデル。本プラットフォームでは会話AI、レポート生成に使用（Claude 3.5 Sonnet / Opus 4.6）。

**外部リンク:**
- [Anthropic Claude 公式サイト](https://www.anthropic.com/claude)
- [Claude API ドキュメント](https://docs.anthropic.com/)

**関連ドキュメント:**
- [企画書: AIプロバイダ管理](../CLAUDE.md#49-aiプロバイダ管理)
- [外部サービス設定](../docs/reference/EXTERNAL_TOOLS_SETUP.md)

### CloudFront
AWSのCDNサービス。署名付きURL、Lambda@Edge、カスタムドメイン対応。

**外部リンク:**
- [CloudFront 公式ドキュメント](https://docs.aws.amazon.com/cloudfront/)

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)
- [デプロイ手順](../docs/DEPLOYMENT.md)

### Cognito
AWSの認証・認可サービス。OAuth2、SAML、MFA対応。User PoolsとIdentity Poolsを提供。

**外部リンク:**
- [Amazon Cognito 公式ドキュメント](https://docs.aws.amazon.com/cognito/)

**関連ドキュメント:**
- [認証サービス比較](../docs/reference/AUTH_COMPARISON_CLERK_VS_COGNITO.md)
- [セキュリティ](../docs/SECURITY.md)

### CORS (Cross-Origin Resource Sharing)
異なるオリジンからのリソースアクセスを制御するセキュリティ機能。

**外部リンク:**
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

## D

### DNS Stack
Route 53のHosted Zoneを管理するCDKスタック。ドメイン・サブドメインの委譲設定を含む。

**関連ドキュメント:**
- [DNS設計: サブドメイン委譲](../infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- [DNS実装ガイド](../infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md)
- [クイックスタート](../infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md)

**参照:** [Route 53](#route-53), [Hosted Zone](#hosted-zone)

### DynamoDB
AWSのNoSQLデータベース。セッション状態、WebSocket接続管理、ベンチマークキャッシュに使用。

**外部リンク:**
- [DynamoDB 公式ドキュメント](https://docs.aws.amazon.com/dynamodb/)

**関連ドキュメント:**
- [データベース設計](../docs/DATABASE_DESIGN.md)
- [アーキテクチャ](../docs/ARCHITECTURE.md)

---

## E

### ElevenLabs
高品質なTTS（音声合成）サービス。Visemeデータ、音声クローニング機能を提供。

**外部リンク:**
- [ElevenLabs 公式サイト](https://elevenlabs.io/)
- [ElevenLabs API ドキュメント](https://elevenlabs.io/docs/)

**関連ドキュメント:**
- [企画書: 音声モジュール](../CLAUDE.md#42-音声モジュール)
- [外部サービス設定](../docs/reference/EXTERNAL_TOOLS_SETUP.md)

**参照:** [TTS](#tts-text-to-speech), [Viseme](#viseme)

### EventBridge
AWSのイベント駆動アーキテクチャサービス。セッション完了イベント等をトリガーに非同期処理を起動。

**外部リンク:**
- [EventBridge 公式ドキュメント](https://docs.aws.amazon.com/eventbridge/)

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)

---

## F

### Fargate
AWS ECSのサーバーレスコンピュートエンジン。コンテナ実行環境を提供。

**外部リンク:**
- [AWS Fargate 公式ドキュメント](https://docs.aws.amazon.com/fargate/)

### Free Plan
月間5セッション、録画保存7日間の無料プラン。プリセットアバター10種類、基本機能のみ。

**関連ドキュメント:**
- [企画書: サブスクリプション管理](../CLAUDE.md#412-サブスクリプションプラン管理)

**参照:** [Pro Plan](#pro-plan)

---

## G

### Graviton2
AWS Lambda ARMアーキテクチャ。x86比で20%コスト削減、同等以上のパフォーマンス。

**外部リンク:**
- [AWS Graviton 公式ドキュメント](https://aws.amazon.com/ec2/graviton/)

---

## H

### Hosted Zone
Route 53で管理するDNSゾーン。ドメインのDNSレコードを一元管理。

**外部リンク:**
- [Route 53 Hosted Zones 公式ドキュメント](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-working-with.html)

**関連ドキュメント:**
- [DNS設計](../infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- [DNS実装ガイド](../infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md)

**参照:** [Route 53](#route-53), [DNS Stack](#dns-stack)

---

## I

### IAM (Identity and Access Management)
AWSのアクセス権限管理サービス。ロール、ポリシー、ユーザーを管理。

**外部リンク:**
- [AWS IAM 公式ドキュメント](https://docs.aws.amazon.com/iam/)

**関連ドキュメント:**
- [セキュリティ](../docs/SECURITY.md)

### Infrastructure as Code (IaC)
インフラをコードで定義・管理する手法。本プラットフォームではAWS CDKを使用。

**参照:** [CDK](#cdk-aws-cloud-development-kit)

### IoT Core
AWSのIoT向けメッセージングサービス。本プラットフォームではWebSocket API実装に使用（100万同時接続対応）。

**外部リンク:**
- [AWS IoT Core 公式ドキュメント](https://docs.aws.amazon.com/iot/)

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)

**参照:** [WebSocket](#websocket)

---

## L

### Lambda
AWSのサーバーレス関数実行サービス。イベント駆動、自動スケール、使用量ベース課金。

**外部リンク:**
- [AWS Lambda 公式ドキュメント](https://docs.aws.amazon.com/lambda/)

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)
- [API仕様書](../docs/API_SPECIFICATION.md)

### Lambda Authorizer
API Gatewayで使用する認証・認可Lambda関数。JWT検証、RBAC制御を実装。

**外部リンク:**
- [Lambda Authorizer 公式ドキュメント](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)

**関連ドキュメント:**
- [セキュリティ](../docs/SECURITY.md)

**参照:** [RBAC](#rbac-role-based-access-control)

### Lambda@Edge
CloudFrontのエッジロケーションで実行されるLambda関数。認証、署名付きURL生成等に使用。

**外部リンク:**
- [Lambda@Edge 公式ドキュメント](https://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)

**参照:** [CloudFront](#cloudfront)

### Live2D
2Dアニメ風アバターをリアルタイムにアニメーション可能なSDK。口パク、表情変化に対応。

**外部リンク:**
- [Live2D Cubism SDK](https://www.live2d.com/en/sdk/)

**関連ドキュメント:**
- [企画書: アバターモジュール](../CLAUDE.md#41-アバターモジュール)

### Lip Sync (リップシンク)
音声に合わせてアバターの口を動かす技術。Visemeデータ、Blendshapesを使用。

**参照:** [Viseme](#viseme), [Blendshape](#blendshape)

---

## M

### MediaConvert
AWS提供の動画変換サービス。ユーザー録画とアバター録画を合成、サイドバイサイド配置。

**外部リンク:**
- [AWS MediaConvert 公式ドキュメント](https://docs.aws.amazon.com/mediaconvert/)

**関連ドキュメント:**
- [企画書: セッション・録画モジュール](../CLAUDE.md#44-セッション録画モジュール)

### Multi-Tenant (マルチテナント)
単一のインフラで複数の組織（テナント）を完全分離して管理するアーキテクチャ。

**関連ドキュメント:**
- [企画書: マルチテナント設計](../CLAUDE.md#5-マルチテナント権限設計)
- [アーキテクチャ](../docs/ARCHITECTURE.md)

**参照:** [Tenant](#tenant-テナント)

---

## N

### Next.js
React.jsベースのフロントエンドフレームワーク。SSR、SSG、App Routerに対応。

**外部リンク:**
- [Next.js 公式ドキュメント](https://nextjs.org/docs)

**関連ドキュメント:**
- [開発ガイド](../docs/DEVELOPMENT_GUIDE.md)

### NS Record (ネームサーバーレコード)
ドメインの権威DNSサーバーを指定するDNSレコード。サブドメイン委譲に使用。

**外部リンク:**
- [DNS NS Record 解説](https://www.cloudflare.com/learning/dns/dns-records/dns-ns-record/)

**関連ドキュメント:**
- [DNS設計: サブドメイン委譲](../infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- [DNS実装ガイド](../infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md)

**参照:** [Subdomain Delegation](#subdomain-delegation-サブドメイン委譲)

---

## O

### OAuth2
認証プロトコルの標準規格。Cognitoで実装。

**外部リンク:**
- [OAuth 2.0 公式仕様](https://oauth.net/2/)

**参照:** [Cognito](#cognito)

### OpenAPI
REST APIの仕様記述標準。本プラットフォームではAPI Gatewayから自動生成。

**外部リンク:**
- [OpenAPI Specification](https://swagger.io/specification/)

**関連ドキュメント:**
- [API仕様書](../docs/API_SPECIFICATION.md)

---

## P

### Phase
本プラットフォームの実装フェーズ。Phase 0（インフラ基盤）〜Phase 6（運用・継続改善）。

**関連ドキュメント:**
- [企画書: 実装フェーズ](../CLAUDE.md#10-実装フェーズ)
- [実装計画](../docs/IMPLEMENTATION_PLAN.md)

### Platform Domain
Route 53で管理するプラットフォーム専用ドメイン。`platform.prance.co.jp`がサブドメイン委譲される。

**関連ドキュメント:**
- [DNS設計](../infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- [ドメイン設定サマリー](../DOMAIN_SETUP_SUMMARY.md)

**参照:** [Subdomain Delegation](#subdomain-delegation-サブドメイン委譲)

### Prisma
TypeScript対応のORMツール。型安全、マイグレーション管理、Aurora Serverless v2対応。

**外部リンク:**
- [Prisma 公式ドキュメント](https://www.prisma.io/docs)

**関連ドキュメント:**
- [データベース設計](../docs/DATABASE_DESIGN.md)
- [開発ガイド](../docs/DEVELOPMENT_GUIDE.md)

### Pro Plan
月間50セッション、録画保存90日間の有料プラン（$99/月）。カスタムアバター作成、感情解析、API連携対応。

**関連ドキュメント:**
- [企画書: サブスクリプション管理](../CLAUDE.md#412-サブスクリプションプラン管理)

**参照:** [Free Plan](#free-plan)

### Prompt Template
AIアバターの会話ロジックを制御するシステムプロンプト。管理者がUI上で編集可能。

**関連ドキュメント:**
- [企画書: AIプロンプト管理](../CLAUDE.md#48-aiプロンプト管理)

---

## R

### RBAC (Role-Based Access Control)
ロールベースのアクセス制御。スーパー管理者、クライアント管理者、クライアントユーザーの3階層。

**関連ドキュメント:**
- [企画書: マルチテナント・権限設計](../CLAUDE.md#5-マルチテナント権限設計)
- [セキュリティ](../docs/SECURITY.md)

**参照:** [スーパー管理者](#スーパー管理者), [クライアント管理者](#クライアント管理者), [クライアントユーザー](#クライアントユーザー)

### Ready Player Me
3Dアバター生成サービス。写真から自動生成（Photo Capture API）、WebGL対応、ARKit Blendshapes対応。

**外部リンク:**
- [Ready Player Me 公式サイト](https://readyplayer.me/)
- [Ready Player Me Developer Hub](https://docs.readyplayer.me/)

**関連ドキュメント:**
- [企画書: アバターモジュール](../CLAUDE.md#41-アバターモジュール)

### Redis
インメモリKVSデータベース。セッションキャッシュ、レート制限カウンター、リアルタイム通知に使用。

**外部リンク:**
- [Redis 公式ドキュメント](https://redis.io/docs/)
- [Amazon ElastiCache for Redis](https://docs.aws.amazon.com/elasticache/latest/red-ug/)

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)

### Route 53
AWSのDNSサービス。Hosted Zone、ヘルスチェック、ドメイン登録に対応。

**外部リンク:**
- [Route 53 公式ドキュメント](https://docs.aws.amazon.com/route53/)

**関連ドキュメント:**
- [DNS設計](../infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- [DNS実装ガイド](../infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md)
- [クイックスタート](../infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md)

**参照:** [Hosted Zone](#hosted-zone), [DNS Stack](#dns-stack)

---

## S

### S3 (Simple Storage Service)
AWSのオブジェクトストレージ。録画、アバターモデル、レポートPDFを保存。

**外部リンク:**
- [Amazon S3 公式ドキュメント](https://docs.aws.amazon.com/s3/)

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)

### SAML (Security Assertion Markup Language)
SSO（シングルサインオン）実装の標準プロトコル。Cognito Enterprise機能で対応。

**外部リンク:**
- [SAML 2.0 仕様](https://en.wikipedia.org/wiki/SAML_2.0)

**参照:** [Cognito](#cognito)

### Scenario
AI会話の台本・設定。役割、性格、必須トピック、評価基準を定義。

**関連ドキュメント:**
- [企画書: シナリオエンジン](../CLAUDE.md#43-シナリオエンジン)
- [データベース設計: scenariosテーブル](../docs/DATABASE_DESIGN.md)

### Serverless
サーバー管理不要のクラウドアーキテクチャ。Lambda、Aurora Serverless v2、DynamoDBを使用。

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)
- [企画書: インフラ構成](../CLAUDE.md#9-インフラ構成awsサーバーレス)

**参照:** [Lambda](#lambda), [Aurora Serverless v2](#aurora-serverless-v2)

### Session
ユーザーとAIアバターの1回の会話インタラクション。録画、トランスクリプト、解析結果、レポートを生成。

**関連ドキュメント:**
- [企画書: セッション・録画モジュール](../CLAUDE.md#44-セッション録画モジュール)
- [データベース設計: sessionsテーブル](../docs/DATABASE_DESIGN.md)

### Step Functions
AWSのワークフローオーケストレーションサービス。セッション後処理（録画検証→動画合成→解析→レポート生成）を管理。

**外部リンク:**
- [AWS Step Functions 公式ドキュメント](https://docs.aws.amazon.com/step-functions/)

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)

### STT (Speech-to-Text)
音声認識技術。Azure Speech Servicesを使用、リアルタイムストリーミング認識対応。

**外部リンク:**
- [Azure Speech Services ドキュメント](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/)

**関連ドキュメント:**
- [企画書: 音声モジュール](../CLAUDE.md#42-音声モジュール)
- [外部サービス設定](../docs/reference/EXTERNAL_TOOLS_SETUP.md)

**参照:** [TTS](#tts-text-to-speech)

### Subdomain Delegation (サブドメイン委譲)
親ドメインの一部（サブドメイン）のみを別のDNSサーバーに委譲する手法。お名前.comでNSレコード4つを追加するだけで実現。

**関連ドキュメント:**
- [DNS設計: サブドメイン委譲方式](../infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- [DNS実装ガイド](../infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md)
- [クイックスタート](../infrastructure/docs/QUICKSTART_SUBDOMAIN_DELEGATION.md)

**参照:** [NS Record](#ns-record-ネームサーバーレコード), [Route 53](#route-53)

---

## T

### Tenant (テナント)
マルチテナントアーキテクチャにおける組織単位。データ、ユーザー、設定を完全分離。

**関連ドキュメント:**
- [企画書: マルチテナント・権限設計](../CLAUDE.md#5-マルチテナント権限設計)
- [データベース設計: organizationsテーブル](../docs/DATABASE_DESIGN.md)

**参照:** [Multi-Tenant](#multi-tenant-マルチテナント)

### Three.js
WebGLベースの3Dグラフィックスライブラリ。3Dアバターのリアルタイムレンダリングに使用。

**外部リンク:**
- [Three.js 公式ドキュメント](https://threejs.org/docs/)

**関連ドキュメント:**
- [企画書: アバターモジュール](../CLAUDE.md#41-アバターモジュール)

### Transcript (トランスクリプト)
セッションの文字起こしデータ。タイムスタンプ、話者、信頼度スコア、ハイライト情報を含む。

**関連ドキュメント:**
- [企画書: トランスクリプト・同期プレイヤー](../CLAUDE.md#45-トランスクリプト同期プレイヤー)
- [データベース設計: transcriptsテーブル](../docs/DATABASE_DESIGN.md)

### TTS (Text-to-Speech)
音声合成技術。ElevenLabs APIを使用、Visemeデータ付き。

**外部リンク:**
- [ElevenLabs TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech)

**関連ドキュメント:**
- [企画書: 音声モジュール](../CLAUDE.md#42-音声モジュール)
- [外部サービス設定](../docs/reference/EXTERNAL_TOOLS_SETUP.md)

**参照:** [ElevenLabs](#elevenlabs), [Viseme](#viseme)

---

## V

### Viseme
口の形状を表すパラメータ。音素（phoneme）ごとに対応する口の形を定義。TTSからのアライメントデータを使用。

**外部リンク:**
- [Viseme とは（Microsoft）](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme)

**関連ドキュメント:**
- [企画書: アバターモジュール](../CLAUDE.md#41-アバターモジュール)

**参照:** [TTS](#tts-text-to-speech), [Lip Sync](#lip-sync-リップシンク)

### VPC (Virtual Private Cloud)
AWS内の仮想ネットワーク。Aurora、Lambda等を配置。

**外部リンク:**
- [Amazon VPC 公式ドキュメント](https://docs.aws.amazon.com/vpc/)

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)
- [セキュリティ](../docs/SECURITY.md)

---

## W

### WebSocket
双方向リアルタイム通信プロトコル。本プラットフォームではIoT Coreで実装。

**外部リンク:**
- [WebSocket 仕様](https://datatracker.ietf.org/doc/html/rfc6455)

**関連ドキュメント:**
- [アーキテクチャ](../docs/ARCHITECTURE.md)
- [API仕様書](../docs/API_SPECIFICATION.md)

**参照:** [IoT Core](#iot-core)

### Webhook
イベント発生時にHTTP POSTで通知を送信する仕組み。ATS連携、API連携で使用。

**関連ドキュメント:**
- [企画書: 外部連携API](../CLAUDE.md#411-外部連携api)
- [企画書: ATS連携システム](../CLAUDE.md#414-ats連携システム)

---

## X

### X-Ray
AWSの分散トレーシングサービス。Lambda実行、API呼び出しのパフォーマンス分析に使用。

**外部リンク:**
- [AWS X-Ray 公式ドキュメント](https://docs.aws.amazon.com/xray/)

**関連ドキュメント:**
- [運用ガイド](../docs/OPERATIONS_GUIDE.md)

---

## 日本語用語

### お名前.com
本プラットフォームで使用するドメインレジストラ。`prance.co.jp`を管理。

**外部リンク:**
- [お名前.com 公式サイト](https://www.onamae.com/)

**関連ドキュメント:**
- [DNS設計](../infrastructure/docs/DNS_DESIGN_SUBDOMAIN_DELEGATION.md)
- [DNS実装ガイド](../infrastructure/docs/DNS_IMPLEMENTATION_SUBDOMAIN.md)
- [ドメイン設定サマリー](../DOMAIN_SETUP_SUMMARY.md)

### サブドメイン委譲方式
`platform.prance.co.jp`のみをRoute 53に委譲し、お名前.comでの変更を最小限に抑える設計方式。

**参照:** [Subdomain Delegation](#subdomain-delegation-サブドメイン委譲)

### スーパー管理者
プラットフォーム全体を管理する最上位ロール。全テナント管理、グローバル設定、プラン管理を担当。

**関連ドキュメント:**
- [企画書: マルチテナント・権限設計](../CLAUDE.md#5-マルチテナント権限設計)

**参照:** [RBAC](#rbac-role-based-access-control)

### クライアント管理者
各組織（テナント）を管理するロール。組織内ユーザー管理、シナリオ管理、API管理を担当。

**関連ドキュメント:**
- [企画書: マルチテナント・権限設計](../CLAUDE.md#5-マルチテナント権限設計)

**参照:** [RBAC](#rbac-role-based-access-control)

### クライアントユーザー
一般利用者ロール。セッション実行、個人データ管理、プロファイル閲覧が可能。

**関連ドキュメント:**
- [企画書: マルチテナント・権限設計](../CLAUDE.md#5-マルチテナント権限設計)

**参照:** [RBAC](#rbac-role-based-access-control)

---

**最終更新:** 2026-03-04
**管理:** このファイルは新しい重要用語が追加されるたびに更新してください。
