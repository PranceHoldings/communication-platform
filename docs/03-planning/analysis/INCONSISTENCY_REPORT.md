# 不整合検出レポート

**生成日時:** 2026-04-02 15:04:37

---

## 1. ContentType と ファイル拡張子の不整合

✅ ContentType と拡張子の不整合は検出されませんでした

## 2. Prismaスキーマ と 実装の不整合

### ❌ organizationId の使用（正しくは orgId）

**検出数:** 1 件

```
infrastructure/lambda/auth/authorizer/index.ts:94:    // IMPORTANT: Context field names should match Prisma schema (orgId, not organizationId)
```

### ❌ snake_case フィールド名の使用

**検出数:** 9 件

```
infrastructure/lambda/db-mutation/index.ts:86:      id, session_id, type, s3_key, s3_url, cdn_url,
infrastructure/lambda/db-mutation/index.ts:103:    INSERT INTO transcripts (id, session_id, speaker, text, timestamp_start, timestamp_end, confidence) VALUES
infrastructure/lambda/db-mutation/index.ts:114:      id, session_id, overall_score, emotion_score, audio_score, content_score, delivery_score,
infrastructure/lambda/db-mutation/index.ts:126:    ) ON CONFLICT (session_id) DO NOTHING;
infrastructure/lambda/db-mutation/index.ts:138:    DELETE FROM emotion_analyses WHERE session_id = $1;
infrastructure/lambda/db-mutation/index.ts:139:    DELETE FROM audio_analyses WHERE session_id = $1;
infrastructure/lambda/db-mutation/index.ts:140:    DELETE FROM session_scores WHERE session_id = $1;
infrastructure/lambda/db-mutation/index.ts:141:    DELETE FROM transcripts WHERE session_id = $1;
infrastructure/lambda/db-mutation/index.ts:142:    DELETE FROM recordings WHERE session_id = $1;
```

## 3. ハードコードされた設定値

### ❌ ハードコードされた言語コード

**検出数:** 32 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, __tests__/, .next*/

```
infrastructure/lambda/websocket/default/index.ts:52:// Supported languages (ISO 639-1 format: 'ja', 'en', 'zh-CN', 'zh-TW', etc.)
infrastructure/lambda/websocket/default/index.ts:54:const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN', 'zh-TW', 'ko', 'es', 'pt', 'fr', 'de', 'it'];
infrastructure/lambda/shared/scenario/fallback-responses.ts:33:    'zh-CN': [
infrastructure/lambda/shared/scenario/fallback-responses.ts:38:    'zh-TW': [
infrastructure/lambda/shared/scenario/fallback-responses.ts:90:    'zh-CN': `对话已达到最大轮次（${maxTurns}次）。本次会话现在将结束。感谢您的参与。`,
infrastructure/lambda/shared/scenario/fallback-responses.ts:91:    'zh-TW': `對話已達到最大輪次（${maxTurns}次）。本次會話現在將結束。感謝您的參與。`,
infrastructure/lambda/shared/scenario/error-handler.ts:223:      'zh-CN': '抱歉，生成回复失败。请重试。',
infrastructure/lambda/shared/scenario/error-handler.ts:224:      'zh-TW': '抱歉，生成回覆失敗。請重試。',
infrastructure/lambda/shared/scenario/error-handler.ts:235:      'zh-CN': '音频生成失败。仅以文本形式继续。',
infrastructure/lambda/shared/scenario/error-handler.ts:236:      'zh-TW': '音訊生成失敗。僅以文字形式繼續。',
infrastructure/lambda/shared/scenario/error-handler.ts:247:      'zh-CN': '无法识别您的语音。请清晰地再说一次。',
infrastructure/lambda/shared/scenario/error-handler.ts:248:      'zh-TW': '無法識別您的語音。請清楚地再說一次。',
infrastructure/lambda/shared/scenario/error-handler.ts:259:      'zh-CN': '场景配置存在问题。请联系管理员。',
infrastructure/lambda/shared/scenario/error-handler.ts:260:      'zh-TW': '場景配置存在問題。請聯繫管理員。',
infrastructure/lambda/shared/scenario/error-handler.ts:271:      'zh-CN': '超时。结束会话。',
infrastructure/lambda/shared/scenario/error-handler.ts:272:      'zh-TW': '逾時。結束會話。',
infrastructure/lambda/shared/scenario/error-handler.ts:292:    'zh-CN': '由于错误，会话已终止。',
infrastructure/lambda/shared/scenario/error-handler.ts:293:    'zh-TW': '由於錯誤，會話已終止。',
infrastructure/lambda/shared/scenario/error-handler.ts:312:    'zh-CN': '请用不同的方式再次回应。',
infrastructure/lambda/shared/scenario/error-handler.ts:313:    'zh-TW': '請用不同的方式再次回應。',
```

### ❌ ハードコードされたリージョン

**検出数:** 1 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, 環境変数参照

```
infrastructure/lambda/websocket/default/frame-analyzer.ts:55:      region: config.region || 'us-east-1',
```

### ❌ ハードコードされたメディアフォーマット

**検出数:** 20 件

**除外対象:** *.d.ts, defaults.ts, language-config.ts, node_modules/, 環境変数・定数参照

```
infrastructure/lambda/websocket/default/chunk-utils.ts:153: * @param extension - File extension (e.g., 'webm', 'wav')
infrastructure/lambda/websocket/default/chunk-utils.ts:157: * generateChunkKey('abc123', 'audio', 1772952987123, 5, 'webm')
infrastructure/lambda/websocket/default/chunk-utils.ts:178: * // Returns: { sessionId: 'abc123', chunkType: 'audio', timestamp: 1772952987123, chunkNumber: 5, extension: 'webm' }
infrastructure/lambda/websocket/default/audio-processor.ts:361:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:362:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:371:      audioFormat = 'webm';
infrastructure/lambda/websocket/default/audio-processor.ts:372:      wavBuffer = await this.convertToWav(audioData, 'webm');
infrastructure/lambda/websocket/default/audio-processor.ts:674:      const ttsContentType = 'audio/mpeg'; // ElevenLabs returns MP3
infrastructure/lambda/websocket/default/index.ts:2095:            contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'webm';
infrastructure/lambda/websocket/default/index.ts:2299:              ContentType: 'audio/mpeg',
infrastructure/lambda/websocket/default/index.ts:2317:            contentType: 'audio/mpeg',
infrastructure/lambda/websocket/default/index.ts:2381:    let audioContentType = 'audio/mpeg';
infrastructure/lambda/websocket/default/index.ts:2436:      audioContentType.includes('mpeg') || audioContentType.includes('mp3') ? 'mp3' : 'webm';
infrastructure/lambda/test/seed-recording-data.ts:122:          format: 'webm',
infrastructure/lambda/test/seed-recording-data.ts:123:          resolution: '1280x720',
infrastructure/lambda/shared/audio/tts-elevenlabs.ts:118:      const contentType = response.headers.get('content-type') || 'audio/mpeg';
infrastructure/lambda/db-mutation/index.ts:96:      5242880, 120, 'webm', '1280x720', 24,
apps/web/tests/e2e/stage4-recording.spec.ts:243:    expect(format).toContain('webm'); // or 'mp4'
apps/web/tests/e2e/helpers/websocket-mock.ts:228:      contentType: 'audio/mpeg',
apps/web/components/session-player/recording-player.tsx:10:const DEFAULT_VIDEO_RESOLUTION = '1280x720';
```

## 4. 型定義の重複

### ❌ インラインEnum定義（共有型を使うべき）

**検出数:** 1 件

```
infrastructure/lambda/shared/types/index.ts:33:export type Visibility = 'PRIVATE' | 'ORGANIZATION' | 'PUBLIC';
```

## 5. 多言語対応の不整合

✅ 多言語対応の不整合は検出されませんでした

## 6. 環境変数の不整合

✅ 環境変数の不整合は検出されませんでした

## 7. API型定義の不整合

### ⚠️ API型定義の命名パターンを確認

**検出数:** 29 件

```
infrastructure/lambda/db-mutation/index.ts:54:interface MutationResponse {
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
apps/web/lib/api/runtime-config.ts:40:export interface GetRuntimeConfigsResponse {
apps/web/lib/api/runtime-config.ts:48:export interface GetRuntimeConfigResponse {
apps/web/lib/api/runtime-config.ts:52:export interface UpdateRuntimeConfigRequest {
apps/web/lib/api/runtime-config.ts:57:export interface UpdateRuntimeConfigResponse {
apps/web/lib/api/runtime-config.ts:62:export interface GetRuntimeConfigHistoryResponse {
apps/web/lib/api/runtime-config.ts:74:export interface RollbackRuntimeConfigRequest {
apps/web/lib/api/runtime-config.ts:79:export interface RollbackRuntimeConfigResponse {
apps/web/lib/api/benchmark.ts:9:export interface GetBenchmarkRequest {
```

## 8. Import文の不整合

### ❌ 共有型を使わず直接定義

**検出数:** 6 件

**除外対象:** *.d.ts, node_modules/, packages/shared/

```
apps/web/lib/avatar/gltf-loader.ts:21:export interface AvatarModelInfo {
apps/web/lib/api/avatars.ts:15:export interface AvatarListResponse {
apps/web/lib/api/analysis.ts:26:export interface SessionScore {
apps/web/lib/api/sessions.ts:27:export interface Session {
infrastructure/lambda/benchmark/update-history/index.ts:15:interface SessionData {
infrastructure/lambda/shared/types/index.ts:240:export interface SessionLimitReachedMessage {
```


---

## 📊 サマリー

**検出された不整合の総数:** 70 件

⚠️ **70 件の不整合が検出されました。修正が必要です。**

### 次のアクション

1. このレポートを確認し、優先順位を決定
2. 各不整合を修正（自動修正スクリプト利用可能）
3. CI/CDパイプラインにこのチェックを統合
4. 今後の開発で不整合を防ぐためのガイドライン策定

