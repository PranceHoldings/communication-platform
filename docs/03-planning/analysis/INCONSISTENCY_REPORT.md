# 不整合検出レポート

**生成日時:** 2026-03-08 11:31:15

---

## 1. ContentType と ファイル拡張子の不整合

✅ ContentType と拡張子の不整合は検出されませんでした

## 2. Prismaスキーマ と 実装の不整合

### ❌ organizationId の使用（正しくは orgId）

**検出数:** 1 件

```
infrastructure/lambda/auth/authorizer/index.ts:91:    // IMPORTANT: Context field names should match Prisma schema (orgId, not organizationId)
```

## 3. ハードコードされた設定値

### ❌ ハードコードされた言語コード

**検出数:** 3 件

```
infrastructure/lambda/shared/node_modules/jest-validate/node_modules/camelcase/index.d.ts:28:		camelCase('lorem-ipsum', {locale: 'en-US'});
infrastructure/lambda/shared/node_modules/jest-validate/node_modules/camelcase/index.d.ts:32:		camelCase('lorem-ipsum', {locale: ['en-US', 'en-GB']});
infrastructure/lambda/shared/node_modules/jest-validate/node_modules/camelcase/index.d.ts:94:camelCase('lorem-ipsum', {locale: 'en-US'});
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

**検出数:** 6 件

```
infrastructure/lambda/temp-migration.ts:30:      "ALTER TABLE recordings ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'webm'",
infrastructure/lambda/temp-migration.ts:32:      "ALTER TABLE recordings ADD COLUMN IF NOT EXISTS resolution TEXT DEFAULT '1280x720'",
infrastructure/lambda/websocket/default/chunk-utils.ts:142: * @param extension - File extension (e.g., 'webm', 'wav')
infrastructure/lambda/websocket/default/chunk-utils.ts:146: * generateChunkKey('abc123', 'audio', 1772952987123, 5, 'webm')
infrastructure/lambda/websocket/default/audio-processor.ts:347:    let extension = 'webm';
infrastructure/lambda/websocket/default/video-processor.ts:65:    const chunkKey = generateChunkKey(sessionId, 'video', timestamp, chunkIndex, 'webm');
```

## 4. 型定義の重複

### ❌ Userインターフェースの重複定義

**検出数:** 1 件

```
infrastructure/lambda/shared/dist/types/index.d.ts:33:export interface User {
```

### ❌ Avatarインターフェースの重複定義

**検出数:** 1 件

```
infrastructure/lambda/shared/dist/types/index.d.ts:42:export interface Avatar {
```

### ❌ インラインEnum定義（共有型を使うべき）

**検出数:** 6 件

```
infrastructure/lambda/shared/dist/types/index.d.ts:52:    visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
infrastructure/lambda/shared/dist/types/index.d.ts:60:    visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
infrastructure/lambda/scenarios/list/index.ts:15: * - visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' (optional filter)
infrastructure/lambda/scenarios/list/index.ts:32:    const visibility = queryParams.visibility as 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' | undefined;
infrastructure/lambda/avatars/list/index.ts:17: * - visibility: 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' (optional filter)
infrastructure/lambda/avatars/list/index.ts:36:    const visibility = queryParams.visibility as 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC' | undefined;
```

## 5. 多言語対応の不整合

✅ 多言語対応の不整合は検出されませんでした

## 6. 環境変数の不整合

✅ 環境変数の不整合は検出されませんでした

## 7. API型定義の不整合

### ⚠️ API型定義の命名パターンを確認

**検出数:** 12 件

```
apps/web/lib/api/avatars.ts:15:export interface AvatarListResponse {
apps/web/lib/api/avatars.ts:20:export interface CreateAvatarRequest {
apps/web/lib/api/avatars.ts:33:export interface UpdateAvatarRequest {
apps/web/lib/api/client.ts:10:export interface ApiResponse<T> {
apps/web/lib/api/sessions.ts:59:export interface CreateSessionRequest {
apps/web/lib/api/sessions.ts:65:export interface ListSessionsRequest {
apps/web/lib/api/sessions.ts:71:export interface ListSessionsResponse {
apps/web/lib/api/auth.ts:17:export interface LoginRequest {
apps/web/lib/api/auth.ts:22:export interface RegisterRequest {
apps/web/lib/api/auth.ts:28:export interface AuthResponse {
apps/web/lib/api/scenarios.ts:17:export interface ScenarioListResponse {
apps/web/lib/api/scenarios.ts:22:export interface CreateScenarioRequest {
apps/web/lib/api/scenarios.ts:30:export interface UpdateScenarioRequest {
```

## 8. Import文の不整合

### ❌ 共有型を使わず直接定義

**検出数:** 437 件

```
apps/web/lib/api/avatars.ts:15:export interface AvatarListResponse {
apps/web/lib/api/sessions.ts:16:export interface Session {
infrastructure/lambda/websocket/disconnect/node_modules/@types/node/os.d.ts:43:    interface UserInfo<T> {
infrastructure/lambda/websocket/disconnect/node_modules/@types/node/os.d.ts:235:    interface UserInfoOptions {
infrastructure/lambda/websocket/disconnect/node_modules/@types/node/os.d.ts:238:    interface UserInfoOptionsWithBufferEncoding extends UserInfoOptions {
infrastructure/lambda/websocket/disconnect/node_modules/@types/node/os.d.ts:241:    interface UserInfoOptionsWithStringEncoding extends UserInfoOptions {
infrastructure/lambda/websocket/disconnect/node_modules/@types/node/http2.d.ts:638:    export interface SessionState {
infrastructure/lambda/websocket/disconnect/node_modules/@types/node/http2.d.ts:1233:    export interface SessionOptions {
infrastructure/lambda/websocket/disconnect/node_modules/@aws-sdk/middleware-user-agent/dist-types/ts3.4/configurations.d.ts:3:export interface UserAgentInputConfig {
infrastructure/lambda/websocket/disconnect/node_modules/@aws-sdk/middleware-user-agent/dist-types/ts3.4/configurations.d.ts:12:export interface UserAgentResolvedConfig {
infrastructure/lambda/websocket/disconnect/node_modules/@aws-sdk/middleware-user-agent/dist-types/configurations.d.ts:9:export interface UserAgentInputConfig {
infrastructure/lambda/websocket/disconnect/node_modules/@aws-sdk/middleware-user-agent/dist-types/configurations.d.ts:24:export interface UserAgentResolvedConfig {
infrastructure/lambda/websocket/disconnect/node_modules/typescript/lib/lib.dom.d.ts:32822:interface UserActivation {
infrastructure/lambda/websocket/disconnect/node_modules/typescript/lib/typescript.d.ts:3431:        interface SessionOptions {
infrastructure/lambda/websocket/disconnect/node_modules/typescript/lib/typescript.d.ts:8287:    interface UserPreferences {
infrastructure/lambda/websocket/connect/node_modules/@types/node/os.d.ts:43:    interface UserInfo<T> {
infrastructure/lambda/websocket/connect/node_modules/@types/node/os.d.ts:235:    interface UserInfoOptions {
infrastructure/lambda/websocket/connect/node_modules/@types/node/os.d.ts:238:    interface UserInfoOptionsWithBufferEncoding extends UserInfoOptions {
infrastructure/lambda/websocket/connect/node_modules/@types/node/os.d.ts:241:    interface UserInfoOptionsWithStringEncoding extends UserInfoOptions {
infrastructure/lambda/websocket/connect/node_modules/@types/node/http2.d.ts:638:    export interface SessionState {
```


---

## 📊 サマリー

**検出された不整合の総数:** 459 件

⚠️ **459 件の不整合が検出されました。修正が必要です。**

### 次のアクション

1. このレポートを確認し、優先順位を決定
2. 各不整合を修正（自動修正スクリプト利用可能）
3. CI/CDパイプラインにこのチェックを統合
4. 今後の開発で不整合を防ぐためのガイドライン策定

