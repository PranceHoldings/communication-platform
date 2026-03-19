# 不整合検出レポート

**生成日時:** 2026-03-19 03:18:13

---

## 1. ContentType と ファイル拡張子の不整合

✅ ContentType と拡張子の不整合は検出されませんでした

## 2. Prismaスキーマ と 実装の不整合

### ❌ organizationId の使用（正しくは orgId）

**検出数:** 1 件

```
infrastructure/lambda/auth/authorizer/index.ts:93:    // IMPORTANT: Context field names should match Prisma schema (orgId, not organizationId)
```

### ❌ snake_case フィールド名の使用

**検出数:** 9 件

```
infrastructure/lambda/db-mutation/index.ts:85:      id, session_id, type, s3_key, s3_url, cdn_url,
infrastructure/lambda/db-mutation/index.ts:102:    INSERT INTO transcripts (id, session_id, speaker, text, timestamp_start, timestamp_end, confidence) VALUES
infrastructure/lambda/db-mutation/index.ts:113:      id, session_id, overall_score, emotion_score, audio_score, content_score, delivery_score,
infrastructure/lambda/db-mutation/index.ts:125:    ) ON CONFLICT (session_id) DO NOTHING;
infrastructure/lambda/db-mutation/index.ts:137:    DELETE FROM emotion_analyses WHERE session_id = $1;
infrastructure/lambda/db-mutation/index.ts:138:    DELETE FROM audio_analyses WHERE session_id = $1;
infrastructure/lambda/db-mutation/index.ts:139:    DELETE FROM session_scores WHERE session_id = $1;
infrastructure/lambda/db-mutation/index.ts:140:    DELETE FROM transcripts WHERE session_id = $1;
infrastructure/lambda/db-mutation/index.ts:141:    DELETE FROM recordings WHERE session_id = $1;
```

## 3. ハードコードされた設定値

### ❌ ハードコードされた言語コード

**検出数:** 12 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, __tests__/, .next*/

```
infrastructure/lambda/websocket/default/index.ts:46:// Supported languages (ISO 639-1 format: 'ja', 'en', 'zh-CN', 'zh-TW', etc.)
infrastructure/lambda/websocket/default/index.ts:48:const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it'];
infrastructure/lambda/shared/audio/stt-azure.ts:15:  autoDetectLanguages?: string[]; // 自動言語検出候補（推奨: ['ja-JP', 'en-US']）
infrastructure/lambda/scenarios/update/index.ts:94:    // Validate language if provided (ISO 639-1 format: 'ja', 'en', 'zh-CN', etc.)
infrastructure/lambda/scenarios/create/index.ts:76:    // Validate language if provided (ISO 639-1 format: 'ja', 'en', 'zh-CN', etc.)
infrastructure/lambda/report/templates/default-template.tsx:27:  return new Intl.DateTimeFormat('ja-JP', {
apps/web/components/language-switcher.tsx:24:  'zh-CN': '🇨🇳',
apps/web/components/language-switcher.tsx:25:  'zh-TW': '🇹🇼',
apps/web/lib/i18n/messages.ts:100:  'zh-CN': {
apps/web/lib/i18n/messages.ts:116:  'zh-TW': {
apps/web/lib/i18n/config.ts:40:  'zh-CN', // Chinese (Simplified)
apps/web/lib/i18n/config.ts:41:  'zh-TW', // Chinese (Traditional)
```

### ❌ ハードコードされたメディアフォーマット

**検出数:** 18 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, 環境変数・定数参照

```
infrastructure/lambda/websocket/default/chunk-utils.ts:151: * @param extension - File extension (e.g., 'webm', 'wav')
infrastructure/lambda/websocket/default/chunk-utils.ts:155: * generateChunkKey('abc123', 'audio', 1772952987123, 5, 'webm')
infrastructure/lambda/websocket/default/chunk-utils.ts:176: * // Returns: { sessionId: 'abc123', chunkType: 'audio', timestamp: 1772952987123, chunkNumber: 5, extension: 'webm' }
infrastructure/lambda/websocket/default/audio-processor.ts:355:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:356:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:365:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:366:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:668:      const ttsContentType = 'audio/mpeg'; // ElevenLabs returns MP3
infrastructure/lambda/websocket/default/index.ts:1600:          const extension = contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'webm';
infrastructure/lambda/websocket/default/index.ts:1728:    let audioContentType = 'audio/mpeg';
infrastructure/lambda/websocket/default/index.ts:1782:    const extensionLegacy = audioContentType.includes('mpeg') || audioContentType.includes('mp3') ? 'mp3' : 'webm';
infrastructure/lambda/test/seed-recording-data.ts:120:          format: 'webm',
infrastructure/lambda/test/seed-recording-data.ts:121:          resolution: '1280x720',
infrastructure/lambda/shared/audio/tts-elevenlabs.ts:123:      const contentType = response.headers.get('content-type') || 'audio/mpeg';
infrastructure/lambda/db-mutation/index.ts:95:      5242880, 120, 'webm', '1280x720', 24,
apps/web/tests/e2e/stage4-recording.spec.ts:243:    expect(format).toContain('webm'); // or 'mp4'
apps/web/tests/e2e/helpers/websocket-mock.ts:175:      contentType: 'audio/mpeg',
apps/web/components/session-player/recording-player.tsx:10:const DEFAULT_VIDEO_RESOLUTION = '1280x720';
```

## 4. 型定義の重複

### ❌ インラインEnum定義（共有型を使うべき）

**検出数:** 1 件

```
infrastructure/lambda/shared/types/index.ts:30:export type Visibility = 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
```

## 5. 多言語対応の不整合

✅ 多言語対応の不整合は検出されませんでした

## 6. 環境変数の不整合

✅ 環境変数の不整合は検出されませんでした

## 7. API型定義の不整合

### ⚠️ API型定義の命名パターンを確認

**検出数:** 21 件

```
infrastructure/lambda/db-mutation/index.ts:53:interface MutationResponse {
apps/web/lib/api/guest-sessions.ts:59:export interface GuestSessionListResponse {
apps/web/lib/api/guest-sessions.ts:64:export interface CreateGuestSessionRequest {
apps/web/lib/api/guest-sessions.ts:75:export interface CreateGuestSessionResponse {
apps/web/lib/api/guest-sessions.ts:88:export interface BatchCreateGuestSessionRequest {
apps/web/lib/api/guest-sessions.ts:92:export interface BatchCreateGuestSessionResponse {
apps/web/lib/api/guest-sessions.ts:106:export interface UpdateGuestSessionRequest {
apps/web/lib/api/guest-sessions.ts:115:export interface GuestSessionLogsResponse {
apps/web/lib/api/avatars.ts:15:export interface AvatarListResponse {
apps/web/lib/api/avatars.ts:20:export interface CreateAvatarRequest {
apps/web/lib/api/avatars.ts:33:export interface UpdateAvatarRequest {
apps/web/lib/api/reports.ts:9:export interface ReportResponse {
apps/web/lib/api/client.ts:10:export interface ApiResponse<T> {
apps/web/lib/api/sessions.ts:58:export interface CreateSessionRequest {
apps/web/lib/api/sessions.ts:64:export interface ListSessionsRequest {
apps/web/lib/api/sessions.ts:70:export interface ListSessionsResponse {
apps/web/lib/api/auth.ts:17:export interface LoginRequest {
apps/web/lib/api/auth.ts:22:export interface RegisterRequest {
apps/web/lib/api/auth.ts:28:export interface AuthResponse {
apps/web/lib/api/scenarios.ts:25:export interface ScenarioListResponse {
```

## 8. Import文の不整合

### ❌ 共有型を使わず直接定義

**検出数:** 3 件

**除外対象:** *.d.ts, node_modules/, packages/shared/

```
apps/web/lib/api/avatars.ts:15:export interface AvatarListResponse {
apps/web/lib/api/analysis.ts:26:export interface SessionScore {
apps/web/lib/api/sessions.ts:31:export interface Session {
```


---

## 📊 サマリー

**検出された不整合の総数:** 44 件

⚠️ **44 件の不整合が検出されました。修正が必要です。**

### 次のアクション

1. このレポートを確認し、優先順位を決定
2. 各不整合を修正（自動修正スクリプト利用可能）
3. CI/CDパイプラインにこのチェックを統合
4. 今後の開発で不整合を防ぐためのガイドライン策定

