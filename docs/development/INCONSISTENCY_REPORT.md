# 不整合検出レポート

**生成日時:** 2026-03-07 13:43:42

---

## 1. ContentType と ファイル拡張子の不整合

✅ ContentType と拡張子の不整合は検出されませんでした

## 2. Prismaスキーマ と 実装の不整合

### ❌ organizationId の使用（正しくは orgId）

**検出数:** 1 件

```
infrastructure/lambda/auth/authorizer/index.ts:88:    // IMPORTANT: Context field names should match Prisma schema (orgId, not organizationId)
```

### ❌ snake_case フィールド名の使用

**検出数:** 4 件

```
infrastructure/lambda/websocket/default/index.ts:176:        const sessionId = message.session_id as string;
infrastructure/lambda/websocket/default/index.ts:565:                    session_id: sessionId,
infrastructure/lambda/websocket/default/index.ts:607:                    session_id: sessionId,
infrastructure/lambda/websocket/connect/index.ts:71:          user_id: userId,
```

## 3. ハードコードされた設定値

### ❌ ハードコードされた言語コード

**検出数:** 5 件

```
infrastructure/lambda/websocket/default/audio-processor.ts:50:      language: config.language || 'en-US',
infrastructure/lambda/shared/node_modules/jest-validate/node_modules/camelcase/index.d.ts:28:		camelCase('lorem-ipsum', {locale: 'en-US'});
infrastructure/lambda/shared/node_modules/jest-validate/node_modules/camelcase/index.d.ts:32:		camelCase('lorem-ipsum', {locale: ['en-US', 'en-GB']});
infrastructure/lambda/shared/node_modules/jest-validate/node_modules/camelcase/index.d.ts:94:camelCase('lorem-ipsum', {locale: 'en-US'});
infrastructure/lambda/shared/audio/stt-azure.ts:33:    this.config.speechRecognitionLanguage = options.language || 'en-US';
```

### ❌ ハードコードされたリージョン

**検出数:** 4 件

```
infrastructure/lambda/auth/authorizer/node_modules/aws-sdk/lib/config-base.d.ts:228:     * When region is set to 'us-east-1', whether to send s3 request to global endpoints
infrastructure/lambda/auth/authorizer/node_modules/aws-sdk/lib/config-base.d.ts:229:     * or 'us-east-1' regional endpoints. This config is only applicable to S3 client;
infrastructure/lambda/users/me/node_modules/aws-sdk/lib/config-base.d.ts:228:     * When region is set to 'us-east-1', whether to send s3 request to global endpoints
infrastructure/lambda/users/me/node_modules/aws-sdk/lib/config-base.d.ts:229:     * or 'us-east-1' regional endpoints. This config is only applicable to S3 client;
```

### ❌ ハードコードされたメディアフォーマット

**検出数:** 5 件

```
infrastructure/lambda/websocket/default/audio-processor.ts:207:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:208:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:218:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:219:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:271:    let extension = 'webm';
```

## 4. 型定義の重複

### ❌ Userインターフェースの重複定義

**検出数:** 2 件

```
infrastructure/lambda/shared/dist/types/index.d.ts:33:export interface User {
apps/web/lib/api/auth.ts:7:export interface User {
```

### ❌ Avatarインターフェースの重複定義

**検出数:** 2 件

```
infrastructure/lambda/shared/dist/types/index.d.ts:42:export interface Avatar {
apps/web/lib/api/avatars.ts:11:export interface Avatar {
```

### ❌ インラインEnum定義（共有型を使うべき）

**検出数:** 8 件

```
infrastructure/lambda/shared/dist/types/index.d.ts:52:    visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
infrastructure/lambda/shared/dist/types/index.d.ts:60:    visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
infrastructure/lambda/scenarios/list/index.ts:15: * - visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' (optional filter)
infrastructure/lambda/scenarios/list/index.ts:32:    const visibility = queryParams.visibility as 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' | undefined;
infrastructure/lambda/scenarios/list/index.d.ts:11: * - visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' (optional filter)
infrastructure/lambda/avatars/list/index.ts:17: * - visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' (optional filter)
infrastructure/lambda/avatars/list/index.ts:36:    const visibility = queryParams.visibility as 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' | undefined;
infrastructure/lambda/avatars/list/index.d.ts:13: * - visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' (optional filter)
```

## 5. 多言語対応の不整合

✅ 多言語対応の不整合は検出されませんでした

## 6. 環境変数の不整合

✅ 環境変数の不整合は検出されませんでした

## 7. API型定義の不整合

### ⚠️ API型定義の命名パターンを確認

**検出数:** 12 件

```
apps/web/lib/api/avatars.ts:27:export interface AvatarListResponse {
apps/web/lib/api/avatars.ts:32:export interface CreateAvatarRequest {
apps/web/lib/api/avatars.ts:45:export interface UpdateAvatarRequest {
apps/web/lib/api/client.ts:10:export interface ApiResponse<T> {
apps/web/lib/api/sessions.ts:59:export interface CreateSessionRequest {
apps/web/lib/api/sessions.ts:65:export interface ListSessionsRequest {
apps/web/lib/api/sessions.ts:71:export interface ListSessionsResponse {
apps/web/lib/api/auth.ts:21:export interface LoginRequest {
apps/web/lib/api/auth.ts:26:export interface RegisterRequest {
apps/web/lib/api/auth.ts:32:export interface AuthResponse {
apps/web/lib/api/scenarios.ts:17:export interface ScenarioListResponse {
apps/web/lib/api/scenarios.ts:22:export interface CreateScenarioRequest {
apps/web/lib/api/scenarios.ts:30:export interface UpdateScenarioRequest {
```

## 8. Import文の不整合

### ❌ 共有型を使わず直接定義

**検出数:** 461 件

```
apps/web/lib/api/avatars.ts:11:export interface Avatar {
apps/web/lib/api/avatars.ts:27:export interface AvatarListResponse {
apps/web/lib/api/sessions.ts:16:export interface Session {
apps/web/lib/api/auth.ts:7:export interface User {
infrastructure/lambda/websocket/default/node_modules/@types/node/os.d.ts:43:    interface UserInfo<T> {
infrastructure/lambda/websocket/default/node_modules/@types/node/os.d.ts:235:    interface UserInfoOptions {
infrastructure/lambda/websocket/default/node_modules/@types/node/os.d.ts:238:    interface UserInfoOptionsWithBufferEncoding extends UserInfoOptions {
infrastructure/lambda/websocket/default/node_modules/@types/node/os.d.ts:241:    interface UserInfoOptionsWithStringEncoding extends UserInfoOptions {
infrastructure/lambda/websocket/default/node_modules/@types/node/inspector.generated.d.ts:1982:    interface Session {
infrastructure/lambda/websocket/default/node_modules/@types/node/inspector.generated.d.ts:3070:    interface Session {
infrastructure/lambda/websocket/default/node_modules/@types/node/http2.d.ts:638:    export interface SessionState {
infrastructure/lambda/websocket/default/node_modules/@types/node/http2.d.ts:1236:    export interface SessionOptions {
infrastructure/lambda/websocket/default/node_modules/@types/node/sqlite.d.ts:405:    interface Session {
infrastructure/lambda/websocket/default/node_modules/@typespec/ts-http-runtime/dist/react-native/policies/userAgentPolicy.d.ts:9:export interface UserAgentPolicyOptions {
infrastructure/lambda/websocket/default/node_modules/@typespec/ts-http-runtime/dist/esm/policies/userAgentPolicy.d.ts:9:export interface UserAgentPolicyOptions {
infrastructure/lambda/websocket/default/node_modules/@typespec/ts-http-runtime/dist/browser/policies/userAgentPolicy.d.ts:9:export interface UserAgentPolicyOptions {
infrastructure/lambda/websocket/default/node_modules/@typespec/ts-http-runtime/dist/commonjs/policies/userAgentPolicy.d.ts:9:export interface UserAgentPolicyOptions {
infrastructure/lambda/websocket/default/node_modules/@aws-sdk/middleware-user-agent/dist-types/ts3.4/configurations.d.ts:3:export interface UserAgentInputConfig {
infrastructure/lambda/websocket/default/node_modules/@aws-sdk/middleware-user-agent/dist-types/ts3.4/configurations.d.ts:12:export interface UserAgentResolvedConfig {
infrastructure/lambda/websocket/default/node_modules/@aws-sdk/middleware-user-agent/dist-types/configurations.d.ts:9:export interface UserAgentInputConfig {
```


---

## 📊 サマリー

**検出された不整合の総数:** 492 件

⚠️ **492 件の不整合が検出されました。修正が必要です。**

### 次のアクション

1. このレポートを確認し、優先順位を決定
2. 各不整合を修正（自動修正スクリプト利用可能）
3. CI/CDパイプラインにこのチェックを統合
4. 今後の開発で不整合を防ぐためのガイドライン策定

