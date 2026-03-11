# 不整合検出レポート

**生成日時:** 2026-03-11 13:07:50

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

**検出数:** 11 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, __tests__/, .next*/

```
infrastructure/lambda/websocket/default/index.ts:44:// Supported languages (ISO 639-1 format: 'ja', 'en', 'zh-CN', 'zh-TW', etc.)
infrastructure/lambda/websocket/default/index.ts:46:const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it'];
infrastructure/lambda/shared/audio/stt-azure.ts:15:  autoDetectLanguages?: string[]; // 自動言語検出候補（推奨: ['ja-JP', 'en-US']）
infrastructure/lambda/scenarios/update/index.ts:80:    // Validate language if provided (ISO 639-1 format: 'ja', 'en', 'zh-CN', etc.)
infrastructure/lambda/scenarios/create/index.ts:62:    // Validate language if provided (ISO 639-1 format: 'ja', 'en', 'zh-CN', etc.)
apps/web/components/language-switcher.tsx:24:  'zh-CN': '🇨🇳',
apps/web/components/language-switcher.tsx:25:  'zh-TW': '🇹🇼',
apps/web/lib/i18n/messages.ts:88:  'zh-CN': {
apps/web/lib/i18n/messages.ts:101:  'zh-TW': {
apps/web/lib/i18n/config.ts:33:  'zh-CN',   // Chinese (Simplified)
apps/web/lib/i18n/config.ts:34:  'zh-TW',   // Chinese (Traditional)
```

### ❌ ハードコードされたメディアフォーマット

**検出数:** 13 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, 環境変数・定数参照

```
infrastructure/lambda/websocket/default/chunk-utils.ts:151: * @param extension - File extension (e.g., 'webm', 'wav')
infrastructure/lambda/websocket/default/chunk-utils.ts:155: * generateChunkKey('abc123', 'audio', 1772952987123, 5, 'webm')
infrastructure/lambda/websocket/default/chunk-utils.ts:176: * // Returns: { sessionId: 'abc123', chunkType: 'audio', timestamp: 1772952987123, chunkNumber: 5, extension: 'webm' }
infrastructure/lambda/websocket/default/audio-processor.ts:429:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:430:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:439:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:440:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:733:      const ttsContentType = 'audio/mpeg'; // ElevenLabs returns MP3
infrastructure/lambda/websocket/default/index.ts:1445:    const audioKey = `sessions/${sessionId}/audio/ai-response-${audioTimestamp}.${result.audioContentType.includes('mpeg') || result.audioContentType.includes('mp3') ? 'mp3' : 'webm'}`;
infrastructure/lambda/websocket/default/index.ts:1593:          const audioKey = `sessions/${sessionId}/audio/ai-response-${audioTimestamp}.${contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'webm'}`;
infrastructure/lambda/websocket/default/index.ts:1725:    const audioKey = `sessions/${sessionId}/audio/ai-response-${audioTimestamp}.${result.audioContentType.includes('mpeg') || result.audioContentType.includes('mp3') ? 'mp3' : 'webm'}`;
infrastructure/lambda/shared/audio/tts-elevenlabs.ts:123:      const contentType = response.headers.get('content-type') || 'audio/mpeg';
apps/web/components/session-player/recording-player.tsx:8:const DEFAULT_VIDEO_RESOLUTION = '1280x720';
```

## 4. 型定義の重複

✅ 型定義の重複は検出されませんでした

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

**検出された不整合の総数:** 28 件

⚠️ **28 件の不整合が検出されました。修正が必要です。**

### 次のアクション

1. このレポートを確認し、優先順位を決定
2. 各不整合を修正（自動修正スクリプト利用可能）
3. CI/CDパイプラインにこのチェックを統合
4. 今後の開発で不整合を防ぐためのガイドライン策定

