# システムアーキテクチャ

Pranceプラットフォームの詳細なシステムアーキテクチャ設計。

## 目次

- [アーキテクチャ概要](#アーキテクチャ概要)
- [インフラストラクチャ](#インフラストラクチャ)
- [アプリケーション層](#アプリケーション層)
- [データ層](#データ層)
- [セキュリティ](#セキュリティ)
- [スケーラビリティ](#スケーラビリティ)

---

## アーキテクチャ概要

### 全体構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         CloudFront CDN                          │
│                   (Global Edge Locations)                       │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             ↓                                    ↓
┌────────────────────────────┐      ┌────────────────────────────┐
│     S3 Static Hosting      │      │      API Gateway           │
│   (Next.js Static Assets)  │      │   (REST + WebSocket)       │
└────────────────────────────┘      └──────────┬─────────────────┘
                                               │
                                               ↓
                              ┌────────────────────────────────┐
                              │       Lambda@Edge              │
                              │  (Authentication/Routing)      │
                              └──────────┬─────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ↓                    ↓                    ↓
         ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
         │  Lambda Function │ │  Lambda Function │ │  Lambda Function │
         │   (API Backend)  │ │  (Real-time AI)  │ │   (Background)   │
         │   NestJS on AWS  │ │  WebRTC Handler  │ │     Workers      │
         └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
                  │                    │                    │
                  └────────────────────┼────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ↓                        ↓                        ↓
   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
   │  Aurora PostgreSQL│    │   DynamoDB       │    │   Redis ElastiCache│
   │  Serverless v2   │    │ (Sessions/Cache) │    │  (Rate Limiting) │
   └──────────────────┘    └──────────────────┘    └──────────────────┘
              │
              ↓
   ┌──────────────────┐
   │    S3 Buckets    │
   │ (Media Storage)  │
   └──────────────────┘
              │
              ↓
   ┌──────────────────┐
   │   AWS IoT Core   │
   │ (WebRTC Signaling)│
   └──────────────────┘
```

### アーキテクチャ原則

1. **サーバーレスファースト**
   - Lambda、API Gateway、Aurora Serverless v2を中心とした構成
   - 使用量ベースの課金で初期コストを最小化
   - 自動スケーリングによる運用負荷削減

2. **マイクロサービス指向**
   - 機能ごとに独立したLambda関数として実装
   - 疎結合な設計で保守性と拡張性を確保
   - イベント駆動アーキテクチャで非同期処理を実現

3. **マルチテナント対応**
   - Row Level Security (RLS) によるデータ分離
   - テナント単位のリソース管理
   - プラグインシステムによるカスタマイズ性

4. **高可用性**
   - マルチAZ構成（最低2 AZ）
   - CloudFrontによるグローバル配信
   - 自動フェイルオーバーとヘルスチェック

5. **セキュリティ**
   - VPC内でのプライベートネットワーク構成
   - IAMロールベースの権限管理
   - 暗号化（転送時・保管時）

---

## インフラストラクチャ

### AWS サービス構成

#### コンピューティング

**Lambda Functions**
```typescript
// infrastructure/lib/compute-stack.ts
export class ComputeStack extends Stack {
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // API Lambda Function
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'main.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../apps/api/dist')),
      memorySize: 1024,
      timeout: Duration.seconds(30),
      environment: {
        DATABASE_URL: props.databaseUrl,
        REDIS_URL: props.redisUrl,
        NODE_ENV: props.environment,
      },
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      // X-Ray Tracing
      tracing: lambda.Tracing.ACTIVE,
      // CloudWatch Logs
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // WebSocket Lambda Function
    const websocketFunction = new lambda.Function(this, 'WebSocketFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'websocket.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../apps/api/dist')),
      memorySize: 2048,
      timeout: Duration.seconds(60),
      environment: {
        IOT_ENDPOINT: props.iotEndpoint,
        DATABASE_URL: props.databaseUrl,
      },
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Background Worker Function
    const workerFunction = new lambda.Function(this, 'WorkerFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'worker.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../apps/workers/dist')),
      memorySize: 512,
      timeout: Duration.minutes(5),
      reservedConcurrentExecutions: 10,
    });
  }
}
```

**Lambda Layers**
```typescript
// 共有ライブラリをLambda Layerとして配置
const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
  code: lambda.Code.fromAsset(path.join(__dirname, '../../layers/shared')),
  compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
  description: 'Shared utilities and dependencies',
});

// AI SDK Layer
const aiLayer = new lambda.LayerVersion(this, 'AILayer', {
  code: lambda.Code.fromAsset(path.join(__dirname, '../../layers/ai')),
  compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
  description: 'Anthropic Claude SDK, OpenAI SDK, Google Generative AI',
});
```

#### ネットワーキング

**VPC構成**
```typescript
// infrastructure/lib/network-stack.ts
export class NetworkStack extends Stack {
  public readonly vpc: ec2.Vpc;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly auroraSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // VPC (Multi-AZ)
    this.vpc = new ec2.Vpc(this, 'PranceVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Lambda Security Group
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Aurora Security Group
    this.auroraSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSG', {
      vpc: this.vpc,
      description: 'Security group for Aurora cluster',
      allowAllOutbound: false,
    });

    // Lambda → Aurora
    this.auroraSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to access Aurora'
    );
  }
}
```

**API Gateway**
```typescript
// infrastructure/lib/api-gateway-stack.ts
export class ApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    // REST API
    const api = new apigateway.RestApi(this, 'PranceApi', {
      restApiName: 'Prance Platform API',
      description: 'Prance Communication Platform REST API',
      deployOptions: {
        stageName: props.environment,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Api-Key',
          'X-Tenant-Id',
        ],
      },
      // API Key Required
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
    });

    // Lambda Integration
    const integration = new apigateway.LambdaIntegration(props.apiFunction, {
      proxy: true,
    });

    // Routes
    const apiV1 = api.root.addResource('v1');
    apiV1.addProxy({
      anyMethod: true,
      defaultIntegration: integration,
    });

    // WebSocket API
    const webSocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: 'Prance WebSocket API',
      description: 'Real-time communication via WebSocket',
      connectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          'ConnectIntegration',
          props.websocketFunction
        ),
      },
      disconnectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          'DisconnectIntegration',
          props.websocketFunction
        ),
      },
      defaultRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          'DefaultIntegration',
          props.websocketFunction
        ),
      },
    });

    // WebSocket Stage
    new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi,
      stageName: props.environment,
      autoDeploy: true,
    });

    // Usage Plan (Rate Limiting)
    const plan = api.addUsagePlan('UsagePlan', {
      name: 'Standard Plan',
      throttle: {
        rateLimit: 1000,
        burstLimit: 2000,
      },
      quota: {
        limit: 1000000,
        period: apigateway.Period.MONTH,
      },
    });

    plan.addApiStage({
      stage: api.deploymentStage,
    });
  }
}
```

**CloudFront Distribution**
```typescript
// infrastructure/lib/cdn-stack.ts
export class CdnStack extends Stack {
  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    // S3 Origin (Next.js Static Files)
    const s3Origin = new origins.S3Origin(props.websiteBucket, {
      originAccessIdentity: props.originAccessIdentity,
    });

    // API Gateway Origin
    const apiOrigin = new origins.RestApiOrigin(props.api);

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
      certificate: props.certificate,
      domainNames: [props.domainName],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // Route53 Alias Record
    new route53.ARecord(this, 'AliasRecord', {
      zone: props.hostedZone,
      recordName: props.domainName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });
  }
}
```

---

## アプリケーション層

### フロントエンド (Next.js 15)

**ディレクトリ構成**
```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── sessions/
│   │   ├── analytics/
│   │   └── settings/
│   ├── (admin)/
│   │   ├── admin/
│   │   │   ├── tenants/
│   │   │   ├── plans/
│   │   │   ├── ai-prompts/
│   │   │   └── providers/
│   │   └── client-admin/
│   │       ├── users/
│   │       ├── avatars/
│   │       └── benchmarks/
│   └── api/
│       └── auth/
│           └── [...nextauth]/
├── components/
│   ├── ui/
│   ├── features/
│   └── layouts/
├── lib/
│   ├── api-client.ts
│   ├── websocket.ts
│   └── webrtc.ts
├── hooks/
├── contexts/
└── public/
```

**API Client**
```typescript
// apps/web/lib/api-client.ts
import { create } from 'zustand';
import axios, { AxiosInstance } from 'axios';

interface ApiStore {
  client: AxiosInstance;
  tenantId: string | null;
  setTenantId: (id: string) => void;
}

export const useApiStore = create<ApiStore>((set, get) => ({
  client: axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    timeout: 30000,
  }),
  tenantId: null,
  setTenantId: (id: string) => set({ tenantId: id }),
}));

// Request Interceptor
useApiStore.getState().client.interceptors.request.use(
  (config) => {
    const { tenantId } = useApiStore.getState();
    const token = sessionStorage.getItem('access_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (tenantId) {
      config.headers['X-Tenant-Id'] = tenantId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
useApiStore.getState().client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token refresh logic
      const refreshToken = sessionStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', {
            refreshToken,
          });
          sessionStorage.setItem('access_token', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return axios(error.config);
        } catch (refreshError) {
          // Redirect to login
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
```

**WebRTC Handler**
```typescript
// apps/web/lib/webrtc.ts
export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private iotClient: IotClient;

  constructor(iotEndpoint: string, tenantId: string) {
    this.iotClient = new IotClient(iotEndpoint, tenantId);
  }

  async initialize(): Promise<void> {
    // Get user media
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:turn.prance.com:3478',
          username: 'prance',
          credential: 'secret',
        },
      ],
    });

    // Add local tracks
    this.localStream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.iotClient.sendIceCandidate(event.candidate);
      }
    };

    // Subscribe to IoT messages
    this.iotClient.on('offer', this.handleOffer.bind(this));
    this.iotClient.on('answer', this.handleAnswer.bind(this));
    this.iotClient.on('ice-candidate', this.handleIceCandidate.bind(this));
  }

  async createOffer(): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.iotClient.sendOffer(offer);
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.iotClient.sendAnswer(answer);
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(answer);
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.addIceCandidate(candidate);
  }

  destroy(): void {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.peerConnection?.close();
    this.iotClient.disconnect();
  }
}
```

---

## リアルタイムセッションUI構成

### 概要

Pranceプラットフォームでは、セッション実行中に以下の3要素をブラウザUI上にリアルタイム表示します:

1. **ユーザーカメラ映像**: getUserMedia APIによるリアルタイム取得
2. **AIアバター映像**: Three.js/Live2Dによる60fpsレンダリング
3. **リアルタイム文字起こし**: Azure STT + AIアバター発話のタイムスタンプ付きテキスト

### アーキテクチャ図

```
┌────────────────────────────────────────────────────────────────┐
│                      ブラウザ（React）                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐                 │
│  │ ユーザーカメラ映像│  │ AIアバター映像     │                 │
│  │ (右側表示)        │  │ (左側表示)        │                 │
│  │                   │  │                   │                 │
│  │ getUserMedia API  │  │ Three.js/Live2D   │                 │
│  │ 30-60fps          │  │ 60fps             │                 │
│  │ 1280x720 (Pro)    │  │ 1280x720 (Pro)    │                 │
│  └─────────┬─────────┘  └─────────┬─────────┘                 │
│            │                       │                            │
│            ├───────────────────────┤                            │
│            │  MediaRecorder API    │                            │
│            │  (同時録画)           │                            │
│            └───────────┬───────────┘                            │
│                        │                                        │
│  ┌─────────────────────┴────────────────────────────────────┐  │
│  │       リアルタイム文字起こし（会話履歴）                 │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │ 00:12 AI: よろしくお願いします。                 │   │  │
│  │  │ 00:18 YOU: よろしくお願いします。私は...       │   │  │
│  │  │ 00:34 AI: ありがとうございます。技術スタック... │   │  │
│  │  │ 00:41 YOU: ReactとNode.jsを... (認識中💭)       │   │  │
│  │  │          ↑ 暫定テキスト（グレー表示）           │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │  自動スクロール、話者別色分け（AI: 青、USER: 緑）    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  データフロー:                                                  │
│  1. ユーザー発話 → Azure STT (WebSocket) → 暫定/確定テキスト  │
│  2. AI応答 → Claude API → ElevenLabs TTS → 音声 + Viseme      │
│  3. Viseme → アバター口パク (リップシンク)                     │
│  4. 両方のテキスト → トランスクリプト表示 (タイムスタンプ付き)│
└────────────────────────────────────────────────────────────────┘
         │                          │
         │ WebSocket (IoT Core)     │ HTTPS (API Gateway)
         ▼                          ▼
┌──────────────────────┐  ┌──────────────────────┐
│  Lambda (WebSocket)  │  │  Lambda (REST API)   │
│  - 音声ストリーム中継│  │  - セッション管理    │
│  - STT結果配信       │  │  - トランスクリプト  │
│  - AI応答配信        │  │    保存              │
└──────────────────────┘  └──────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────────────────────────────┐
│  外部サービス                            │
│  - Azure Speech Services (STT)          │
│  - Claude API (会話生成)                │
│  - ElevenLabs (TTS + Viseme)            │
└─────────────────────────────────────────┘
```

### コンポーネント構成

#### 1. セッション実行画面コンポーネント

```typescript
// components/SessionPlayer.tsx
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { UserCameraView } from './UserCameraView';
import { AvatarView } from './AvatarView';
import { RealtimeTranscript } from './RealtimeTranscript';

export function SessionPlayer({ sessionId }: { sessionId: string }) {
  const {
    userStream,
    avatarRenderer,
    transcriptEntries,
    currentRecognizing,
    sessionState,
    controls
  } = useRealtimeSession(sessionId);

  return (
    <div className="session-player">
      {/* 映像表示エリア */}
      <div className="video-container">
        <AvatarView
          renderer={avatarRenderer}
          isRecording={sessionState.isRecording}
        />
        <UserCameraView
          stream={userStream}
          isRecording={sessionState.isRecording}
        />
      </div>

      {/* デバイス制御 */}
      <div className="device-controls">
        <MicrophoneControl
          onToggle={controls.toggleMicrophone}
          isActive={sessionState.microphoneActive}
        />
        <CameraControl
          onToggle={controls.toggleCamera}
          isActive={sessionState.cameraActive}
        />
        <SpeakerControl
          volume={sessionState.volume}
          onVolumeChange={controls.setVolume}
        />
      </div>

      {/* リアルタイム文字起こし */}
      <RealtimeTranscript
        entries={transcriptEntries}
        currentRecognizing={currentRecognizing}
      />

      {/* セッション情報 */}
      <SessionInfo
        elapsedTime={sessionState.elapsedTime}
        maxDuration={sessionState.maxDuration}
        topicProgress={sessionState.topicProgress}
        recordingSize={sessionState.recordingSize}
      />
    </div>
  );
}
```

#### 2. リアルタイム文字起こしフック

```typescript
// hooks/useRealtimeTranscription.ts
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';

interface TranscriptEntry {
  id: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestampStart: number;
  timestampEnd: number;
  confidence: number;
  isConfirmed: boolean;
}

export function useRealtimeTranscription(sessionId: string) {
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentRecognizing, setCurrentRecognizing] = useState<string>('');
  const wsClient = useWebSocket(sessionId);

  useEffect(() => {
    // Azure STT設定
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY!,
      process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION!
    );
    speechConfig.speechRecognitionLanguage = 'ja-JP';

    const audioConfig = sdk.AudioConfig.fromDefaultMicrophone();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // 認識中（暫定テキスト）
    recognizer.recognizing = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
        setCurrentRecognizing(e.result.text);
      }
    };

    // 認識完了（確定テキスト）
    recognizer.recognized = (s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
        const entry: TranscriptEntry = {
          id: generateId(),
          speaker: 'USER',
          text: e.result.text,
          timestampStart: Date.now() / 1000,
          timestampEnd: Date.now() / 1000,
          confidence: 0.95,
          isConfirmed: true
        };

        setTranscriptEntries(prev => [...prev, entry]);
        setCurrentRecognizing('');

        // WebSocket経由でバックエンドに送信
        wsClient.send({
          type: 'user_speech',
          text: e.result.text,
          timestamp: entry.timestampStart
        });
      }
    };

    // 認識開始
    recognizer.startContinuousRecognitionAsync();

    return () => {
      recognizer.stopContinuousRecognitionAsync();
    };
  }, [sessionId]);

  // AI発話の受信
  useEffect(() => {
    if (!wsClient) return;

    wsClient.onMessage((message) => {
      if (message.type === 'avatar_response') {
        const aiEntry: TranscriptEntry = {
          id: generateId(),
          speaker: 'AI',
          text: message.text,
          timestampStart: Date.now() / 1000,
          timestampEnd: Date.now() / 1000 + estimateDuration(message.text),
          confidence: 1.0,
          isConfirmed: true
        };

        setTranscriptEntries(prev => [...prev, aiEntry]);
      }
    });
  }, [wsClient]);

  return { transcriptEntries, currentRecognizing };
}

function estimateDuration(text: string): number {
  const charCount = text.length;
  const wpm = 140; // 日本語の平均話速（文字/分）
  return (charCount / wpm) * 60;
}

function generateId(): string {
  return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

#### 3. リアルタイム文字起こし表示コンポーネント

```typescript
// components/RealtimeTranscript.tsx
import { useEffect, useRef } from 'react';
import { formatTime } from '@/utils/time';

interface TranscriptEntry {
  id: string;
  speaker: 'AI' | 'USER';
  text: string;
  timestampStart: number;
  isConfirmed: boolean;
}

export function RealtimeTranscript({
  entries,
  currentRecognizing
}: {
  entries: TranscriptEntry[];
  currentRecognizing: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新しい発話時に自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, currentRecognizing]);

  return (
    <div className="transcript-container" ref={scrollRef}>
      <h3>リアルタイム文字起こし（会話履歴）</h3>

      {/* 確定した会話履歴 */}
      {entries.map(entry => (
        <div key={entry.id} className={`transcript-entry ${entry.speaker}`}>
          <span className="timestamp">
            {formatTime(entry.timestampStart)}
          </span>
          <span className="speaker">
            {entry.speaker === 'AI' ? 'AI' : 'YOU'}:
          </span>
          <span className="text">{entry.text}</span>
        </div>
      ))}

      {/* 認識中の暫定テキスト */}
      {currentRecognizing && (
        <div className="transcript-entry USER recognizing">
          <span className="timestamp">
            {formatTime(Date.now() / 1000)}
          </span>
          <span className="speaker">YOU:</span>
          <span className="text provisional">
            {currentRecognizing}
            <span className="indicator"> 💭 (認識中)</span>
          </span>
        </div>
      )}

      {/* 空状態 */}
      {entries.length === 0 && !currentRecognizing && (
        <div className="empty-state">
          会話を開始してください...
        </div>
      )}
    </div>
  );
}
```

#### 4. スタイリング

```css
/* styles/transcript.css */
.transcript-container {
  max-height: 300px;
  overflow-y: auto;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif;
}

.transcript-entry {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  border-radius: 4px;
  animation: fadeIn 0.3s ease-in;
}

/* AI発話: 青系背景 */
.transcript-entry.AI {
  background: #e3f2fd;
  border-left: 3px solid #2196f3;
}

/* ユーザー発話: 緑系背景 */
.transcript-entry.USER {
  background: #e8f5e9;
  border-left: 3px solid #4caf50;
}

/* 認識中（暫定テキスト）: グレー、イタリック */
.transcript-entry.recognizing {
  background: #f5f5f5;
  border-left: 3px dashed #9e9e9e;
}

.transcript-entry .text.provisional {
  color: #757575;
  font-style: italic;
}

.transcript-entry .indicator {
  color: #9e9e9e;
  font-size: 0.875rem;
}

.transcript-entry .timestamp {
  color: #616161;
  font-size: 0.75rem;
  margin-right: 0.5rem;
  font-weight: 500;
}

.transcript-entry .speaker {
  font-weight: 600;
  margin-right: 0.5rem;
}

.transcript-entry.AI .speaker {
  color: #1976d2;
}

.transcript-entry.USER .speaker {
  color: #388e3c;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.empty-state {
  text-align: center;
  color: #9e9e9e;
  padding: 2rem;
  font-style: italic;
}
```

### データフロー詳細

#### ユーザー発話フロー

```
1. ユーザーがマイクで発話
   ↓
2. getUserMedia → Azure STT（ストリーミング）
   ↓
3. recognizing イベント（0.1秒ごと）
   ↓
4. UI: 暫定テキスト表示（グレー、💭認識中）
   ↓
5. recognized イベント（発話終了時）
   ↓
6. UI: 確定テキスト表示（通常色）
   ↓
7. WebSocket → Lambda → DynamoDB (セッション状態更新)
   ↓
8. Lambda → Claude API（AI応答生成）
```

#### AI発話フロー

```
1. Claude API応答テキスト
   ↓
2. Lambda → ElevenLabs TTS生成
   ↓
3. WebSocket → ブラウザ
   ├─ 音声データ（ArrayBuffer）
   └─ Visemeデータ（口形状）
   ↓
4. UI: AI発話として表示（青背景）
   ↓
5. 音声再生 + アバター口パク（Three.js/Live2D）
   ↓
6. DynamoDB: トランスクリプトエントリ保存
```

#### 録画フロー

```
1. セッション開始時
   ├─ MediaRecorder (ユーザーカメラ) 開始
   └─ MediaRecorder (アバターCanvas) 開始
   ↓
2. セッション中（1秒ごと）
   ├─ ユーザー映像チャンク生成
   └─ アバター映像チャンク生成
   ↓
3. セッション終了時
   ├─ 両方のBlobを生成
   ├─ S3署名付きURL取得
   └─ 並列アップロード
   ↓
4. EventBridge → Step Functions
   ├─ MediaConvert: サイドバイサイド合成
   ├─ サムネイル生成
   └─ トランスクリプトファイル生成（WebVTT）
```

### パフォーマンス最適化

#### 1. リアルタイム文字起こし

- **Azure STT WebSocket**: 低レイテンシストリーミング認識（< 100ms）
- **デバウンス処理**: 暫定テキストの頻繁な更新を抑制
- **仮想スクロール**: 大量のトランスクリプトエントリでもスムーズ表示

#### 2. アバターレンダリング

- **Three.js最適化**: LOD（Level of Detail）、フラストラムカリング
- **Live2D最適化**: テクスチャ圧縮、描画領域制限
- **60fps維持**: requestAnimationFrame、Web Workersでの負荷分散

#### 3. 録画

- **ビットレート制御**: プラン別に自動調整（Free: 1.5Mbps, Pro: 2.5Mbps）
- **チャンク処理**: メモリ消費抑制（1秒ごとにチャンク生成）
- **並列アップロード**: ユーザー/アバター映像を同時アップロード

### エラーハンドリング

#### Azure STT エラー

```typescript
recognizer.canceled = (s, e) => {
  if (e.reason === sdk.CancellationReason.Error) {
    console.error('STT Error:', e.errorDetails);

    // ユーザーに通知
    showNotification({
      type: 'error',
      message: '音声認識エラーが発生しました。マイクを確認してください。'
    });

    // フォールバック: マニュアル入力
    setTranscriptionMode('manual');
  }
};
```

#### WebSocket 切断

```typescript
wsClient.onDisconnect(() => {
  // 自動再接続（3回まで）
  if (reconnectAttempts < 3) {
    setTimeout(() => {
      wsClient.reconnect();
      reconnectAttempts++;
    }, 1000 * reconnectAttempts);
  } else {
    // 再接続失敗 → セッション中断
    showNotification({
      type: 'error',
      message: '接続が切断されました。セッションを再開してください。'
    });

    // 録画データを保存
    saveRecordingLocally();
  }
});
```

#### 録画失敗

```typescript
userRecorder.onerror = (event) => {
  console.error('Recording error:', event);

  // ユーザーに通知
  showNotification({
    type: 'warning',
    message: '録画中にエラーが発生しました。音声のみ保存されます。'
  });

  // 音声のみ録画に切り替え
  fallbackToAudioOnlyRecording();
};
```

---

### バックエンド (NestJS)

**モジュール構成**
```
apps/api/src/
├── main.ts
├── app.module.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── api-key.strategy.ts
│   │   └── guards/
│   │       ├── roles.guard.ts
│   │       └── tenant.guard.ts
│   ├── users/
│   ├── tenants/
│   ├── sessions/
│   ├── avatars/
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── providers/
│   │   │   ├── claude.provider.ts
│   │   │   ├── openai.provider.ts
│   │   │   └── gemini.provider.ts
│   │   └── prompts/
│   ├── speech/
│   │   ├── elevenlabs.service.ts
│   │   ├── azure-speech.service.ts
│   │   └── speech.gateway.ts
│   ├── analytics/
│   ├── benchmarks/
│   ├── plugins/
│   └── ats/
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   └── middleware/
└── config/
```

**Authentication Module**
```typescript
// apps/api/src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@prance/database';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check subscription status
    if (user.tenant) {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          tenant_id: user.tenant_id,
          status: 'active',
        },
      });

      if (!subscription) {
        throw new UnauthorizedException('Subscription expired');
      }
    }

    return user;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      role: user.role.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        tenant: user.tenant,
      },
    };
  }

  async validateApiKey(apiKey: string): Promise<any> {
    const key = await this.prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { tenant: true, createdBy: true },
    });

    if (!key || !key.is_active) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Check rate limit
    const rateLimitKey = `ratelimit:${key.id}`;
    const count = await this.redis.incr(rateLimitKey);

    if (count === 1) {
      await this.redis.expire(rateLimitKey, 60); // 1分
    }

    if (count > key.rate_limit) {
      throw new UnauthorizedException('Rate limit exceeded');
    }

    // Update usage
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: {
        last_used_at: new Date(),
        usage_count: { increment: 1 },
      },
    });

    return key;
  }
}
```

**AI Provider Module**
```typescript
// apps/api/src/modules/ai/providers/claude.provider.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIResponse } from '../interfaces';

@Injectable()
export class ClaudeProvider implements AIProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateResponse(
    prompt: string,
    context: any,
    options: any,
  ): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: options.model || 'claude-sonnet-4.5-20250929',
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: options.systemPrompt,
    });

    return {
      text: response.content[0].text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      metadata: {
        model: response.model,
        stopReason: response.stop_reason,
      },
    };
  }

  async streamResponse(
    prompt: string,
    context: any,
    options: any,
    callback: (chunk: string) => void,
  ): Promise<void> {
    const stream = await this.client.messages.stream({
      model: options.model || 'claude-sonnet-4.5-20250929',
      max_tokens: options.maxTokens || 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        callback(chunk.delta.text);
      }
    }
  }
}
```

---

## データ層

### Aurora PostgreSQL Serverless v2

**接続プール管理**
```typescript
// packages/database/src/client.ts
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  }).$extends(withAccelerate());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Row Level Security Middleware
prisma.$use(async (params, next) => {
  const tenantId = params.args?.where?.tenant_id;

  if (tenantId) {
    await prisma.$executeRawUnsafe(
      `SET app.current_tenant_id = '${tenantId}'`
    );
  }

  return next(params);
});
```

### DynamoDB (Sessions & Cache)

**セッション管理**
```typescript
// packages/shared/src/session-store.ts
import { DynamoDB } from 'aws-sdk';

export class DynamoDBSessionStore {
  private client: DynamoDB.DocumentClient;
  private tableName: string;

  constructor() {
    this.client = new DynamoDB.DocumentClient();
    this.tableName = process.env.SESSIONS_TABLE_NAME!;
  }

  async set(sessionId: string, data: any, ttl: number): Promise<void> {
    await this.client
      .put({
        TableName: this.tableName,
        Item: {
          sessionId,
          data: JSON.stringify(data),
          ttl: Math.floor(Date.now() / 1000) + ttl,
        },
      })
      .promise();
  }

  async get(sessionId: string): Promise<any | null> {
    const result = await this.client
      .get({
        TableName: this.tableName,
        Key: { sessionId },
      })
      .promise();

    return result.Item ? JSON.parse(result.Item.data) : null;
  }

  async delete(sessionId: string): Promise<void> {
    await this.client
      .delete({
        TableName: this.tableName,
        Key: { sessionId },
      })
      .promise();
  }
}
```

### Redis ElastiCache

**レート制限**
```typescript
// packages/shared/src/rate-limiter.ts
import Redis from 'ioredis';

export class RateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      tls: process.env.NODE_ENV === 'production' ? {} : undefined,
    });
  }

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Remove old entries
    await this.redis.zremrangebyscore(key, 0, windowStart);

    // Count requests in window
    const count = await this.redis.zcard(key);

    if (count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    // Add new request
    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, windowSeconds);

    return { allowed: true, remaining: limit - count - 1 };
  }
}
```

---

## セキュリティ

### IAM ロール設計

**Lambda実行ロール**
```typescript
// infrastructure/lib/iam-stack.ts
const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaVPCAccessExecutionRole'
    ),
  ],
  inlinePolicies: {
    DynamoDBAccess: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:DeleteItem'],
          resources: [sessionsTable.tableArn],
        }),
      ],
    }),
    S3Access: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['s3:GetObject', 's3:PutObject'],
          resources: [`${mediaBucket.bucketArn}/*`],
        }),
      ],
    }),
    SecretsManagerAccess: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['secretsmanager:GetSecretValue'],
          resources: [databaseSecret.secretArn],
        }),
      ],
    }),
  },
});
```

### Secrets Manager

```typescript
// infrastructure/lib/secrets-stack.ts
const databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
  secretName: `prance/${props.environment}/database`,
  generateSecretString: {
    secretStringTemplate: JSON.stringify({ username: 'prance_admin' }),
    generateStringKey: 'password',
    excludePunctuation: true,
    includeSpace: false,
    passwordLength: 32,
  },
});

const apiKeysSecret = new secretsmanager.Secret(this, 'ApiKeysSecret', {
  secretName: `prance/${props.environment}/api-keys`,
  secretObjectValue: {
    ANTHROPIC_API_KEY: SecretValue.unsafePlainText(
      process.env.ANTHROPIC_API_KEY!
    ),
    ELEVENLABS_API_KEY: SecretValue.unsafePlainText(
      process.env.ELEVENLABS_API_KEY!
    ),
  },
});
```

---

## スケーラビリティ

### オートスケーリング設定

**Aurora Read Replicas**
```typescript
// infrastructure/lib/database-stack.ts
const auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
  engine: rds.DatabaseClusterEngine.auroraPostgres({
    version: rds.AuroraPostgresEngineVersion.VER_15_3,
  }),
  serverlessV2MinCapacity: 0.5,
  serverlessV2MaxCapacity: 2,
  writer: rds.ClusterInstance.serverlessV2('writer'),
  readers: [
    rds.ClusterInstance.serverlessV2('reader1', { scaleWithWriter: true }),
  ],
  vpc: props.vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  },
});
```

**Lambda Concurrency**
```typescript
// 予約同時実行数
apiFunction.addAlias('live', {
  version: apiFunction.currentVersion,
  provisionedConcurrentExecutions: 10,
});

// Application Auto Scaling
const scalableTarget = new appscaling.ScalableTarget(this, 'ScalableTarget', {
  serviceNamespace: appscaling.ServiceNamespace.LAMBDA,
  maxCapacity: 100,
  minCapacity: 10,
  resourceId: `function:${apiFunction.functionName}:live`,
  scalableDimension: 'lambda:function:ProvisionedConcurrentExecutions',
});

scalableTarget.scaleToTrackMetric('PceTracking', {
  targetValue: 0.70,
  predefinedMetric: appscaling.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
});
```

---

## モニタリング

### CloudWatch Dashboards

```typescript
// infrastructure/lib/monitoring-stack.ts
const dashboard = new cloudwatch.Dashboard(this, 'PranceDashboard', {
  dashboardName: `Prance-${props.environment}`,
});

dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'API Latency',
    left: [
      apiFunction.metricDuration({
        statistic: 'Average',
        period: Duration.minutes(1),
      }),
    ],
    right: [
      apiFunction.metricInvocations({
        statistic: 'Sum',
        period: Duration.minutes(1),
      }),
    ],
  }),
  new cloudwatch.GraphWidget({
    title: 'Database Connections',
    left: [
      new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: {
          DBClusterIdentifier: auroraCluster.clusterIdentifier,
        },
        statistic: 'Average',
      }),
    ],
  })
);
```

---

次のステップ: [データベース設計](DATABASE_DESIGN.md) → [API仕様](API_SPECIFICATION.md)
