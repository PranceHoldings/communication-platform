# 不整合検出レポート

**生成日時:** 2026-03-10 09:54:45

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

**検出数:** 18 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, __tests__/, .next*/

```
infrastructure/lambda/websocket/default/index.ts:45:const DEFAULT_STT_LANGUAGE = 'ja-JP'; // Deprecated: 自動言語検出を使用すること
infrastructure/lambda/websocket/default/index.ts:46:const DEFAULT_STT_AUTO_DETECT_LANGUAGES = ['ja-JP', 'en-US']; // Phase 1デフォルト
infrastructure/lambda/shared/audio/stt-azure.ts:13:  autoDetectLanguages?: string[]; // 自動言語検出候補（推奨: ['ja-JP', 'en-US']）
infrastructure/lambda/shared/audio/stt-azure.ts:283:      'en-US', // English (United States)
infrastructure/lambda/shared/audio/stt-azure.ts:284:      'ja-JP', // Japanese
infrastructure/lambda/shared/audio/stt-azure.ts:285:      'zh-CN', // Chinese (Simplified)
infrastructure/lambda/shared/audio/stt-azure.ts:286:      'es-ES', // Spanish
infrastructure/lambda/shared/audio/stt-azure.ts:287:      'fr-FR', // French
infrastructure/lambda/shared/audio/stt-azure.ts:288:      'de-DE', // German
infrastructure/lambda/shared/audio/stt-azure.ts:289:      'it-IT', // Italian
infrastructure/lambda/shared/audio/stt-azure.ts:290:      'ko-KR', // Korean
infrastructure/lambda/shared/audio/stt-azure.ts:291:      'pt-BR', // Portuguese (Brazil)
apps/web/components/language-switcher.tsx:24:  'zh-CN': '🇨🇳',
apps/web/components/language-switcher.tsx:25:  'zh-TW': '🇹🇼',
apps/web/lib/i18n/messages.ts:84:  'zh-CN': {
apps/web/lib/i18n/messages.ts:96:  'zh-TW': {
apps/web/lib/i18n/config.ts:33:  'zh-CN',   // Chinese (Simplified)
apps/web/lib/i18n/config.ts:34:  'zh-TW',   // Chinese (Traditional)
```

### ❌ ハードコードされたリージョン

**検出数:** 1 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, 環境変数参照

```
infrastructure/lambda/websocket/default/frame-analyzer.ts:52:      region: config.region || 'us-east-1',
```

### ❌ ハードコードされたメディアフォーマット

**検出数:** 19 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, 環境変数・定数参照

```
infrastructure/lambda/websocket/default/chunk-utils.ts:142: * @param extension - File extension (e.g., 'webm', 'wav')
infrastructure/lambda/websocket/default/chunk-utils.ts:146: * generateChunkKey('abc123', 'audio', 1772952987123, 5, 'webm')
infrastructure/lambda/websocket/default/chunk-utils.ts:167: * // Returns: { sessionId: 'abc123', chunkType: 'audio', timestamp: 1772952987123, chunkNumber: 5, extension: 'webm' }
infrastructure/lambda/websocket/default/audio-processor.ts:427:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:428:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:437:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:438:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:536:    let extension = 'webm';
infrastructure/lambda/websocket/default/video-processor.ts:65:    const chunkKey = generateChunkKey(sessionId, 'video', timestamp, chunkIndex, 'webm');
infrastructure/lambda/websocket/default/video-processor.ts:72:        ContentType: 'video/webm',
infrastructure/lambda/websocket/default/video-processor.ts:219:          ContentType: 'video/webm',
infrastructure/lambda/websocket/default/index.ts:48:const DEFAULT_VIDEO_RESOLUTION = '1280x720';
infrastructure/lambda/websocket/default/index.ts:50:const DEFAULT_VIDEO_CONTENT_TYPE = 'video/webm';
infrastructure/lambda/websocket/default/index.ts:1459:    const audioKey = `sessions/${sessionId}/audio/ai-response-${audioTimestamp}.${result.audioContentType.includes('mpeg') || result.audioContentType.includes('mp3') ? 'mp3' : 'webm'}`;
infrastructure/lambda/websocket/default/index.ts:1591:          const audioKey = `sessions/${sessionId}/audio/ai-response-${audioTimestamp}.${contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'webm'}`;
infrastructure/lambda/websocket/default/index.ts:1723:    const audioKey = `sessions/${sessionId}/audio/ai-response-${audioTimestamp}.${result.audioContentType.includes('mpeg') || result.audioContentType.includes('mp3') ? 'mp3' : 'webm'}`;
infrastructure/lambda/shared/audio/tts-elevenlabs.ts:81:      const contentType = response.headers.get('content-type') || 'audio/mpeg';
apps/web/components/session-player/recording-player.tsx:303:            {recording.format || 'webm'}
apps/web/components/session-player/recording-player.tsx:307:            {recording.resolution || '1280x720'}
```

## 4. 型定義の重複

### ❌ インラインEnum定義（共有型を使うべき）

**検出数:** 4 件

```
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

**検出数:** 3 件

**除外対象:** *.d.ts, node_modules/, packages/shared/

```
apps/web/lib/api/avatars.ts:15:export interface AvatarListResponse {
apps/web/lib/api/analysis.ts:26:export interface SessionScore {
apps/web/lib/api/sessions.ts:16:export interface Session {
```


---

## 📊 サマリー

**検出された不整合の総数:** 46 件

⚠️ **46 件の不整合が検出されました。修正が必要です。**

### 次のアクション

1. このレポートを確認し、優先順位を決定
2. 各不整合を修正（自動修正スクリプト利用可能）
3. CI/CDパイプラインにこのチェックを統合
4. 今後の開発で不整合を防ぐためのガイドライン策定

