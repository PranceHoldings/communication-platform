# Future Required Tasks - 今後の必須実装タスク

**作成日:** 2026-03-19
**ステータス:** 計画中
**優先度:** Medium-High

---

## 📋 概要

現在のシステムで未実装だが、本番運用において必須となる機能のタスクリスト。
各タスクは優先度・影響範囲・実装難易度を明記。

---

## 🔴 CRITICAL: 即座対応必要

### 1. CloudFront署名付きURL設定

**現状:**
- CloudFront Distribution存在（`d3mx0sug5s3a6x.cloudfront.net`）
- 署名付きURL機能が**完全に未設定**
- Public Key, Key Group, Trusted Signers すべて未設定

**問題:**
- 誰でもURLを知っていればアクセス可能
- 録画ファイルへの認証なしアクセス（セキュリティ違反）
- GDPR/個人情報保護法違反リスク

**影響範囲:**
- 録画機能全体
- アバター画像配信
- 全ての静的コンテンツ配信

**実装手順:**
1. CloudFront Key Pair生成
   ```bash
   openssl genrsa -out private_key.pem 2048
   openssl rsa -pubout -in private_key.pem -out public_key.pem
   ```

2. Public KeyをCloudFrontに登録
   ```bash
   aws cloudfront create-public-key \
     --public-key-config file://public-key-config.json
   ```

3. Key Group作成
   ```bash
   aws cloudfront create-key-group \
     --key-group-config file://key-group-config.json
   ```

4. Distribution設定更新
   - Trusted Key Groups追加
   - Behavior設定変更

5. Secret Managerに秘密鍵保存
   ```bash
   aws secretsmanager create-secret \
     --name prance/cloudfront/production \
     --secret-string file://cloudfront-secret.json
   ```

6. CDK Stack更新
   - Lambda関数にSecret Manager読み取り権限
   - 環境変数削除（Secret経由に変更）

7. Lambda関数で署名付きURL生成実装
   ```typescript
   import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
   ```

**推定工数:** 2-3日
**優先度:** 🔴 CRITICAL
**期限:** 録画機能を本番使用する前に必須
**担当:** DevOps + Backend

**参考資料:**
- [AWS CloudFront Signed URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html)
- [CloudFront Key Groups](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-trusted-signers.html)

---

## ⚠️ HIGH: 高優先度（1-2週間以内）

### 2. TTS/STTフォールバックシステム実装

**現状:**
- **TTS:** ElevenLabs APIのみ使用
- **STT:** Azure Speech Servicesのみ使用
- フォールバック機能なし

**問題:**
1. **単一障害点（SPOF）:**
   - ElevenLabs障害 → TTS完全停止 → セッション実行不可
   - Azure障害 → STT完全停止 → セッション実行不可

2. **コスト最適化機会の喪失:**
   - ElevenLabs: 高品質だが高コスト
   - AWS Polly: 低品質だが低コスト
   - 使い分けができない

3. **レート制限対応:**
   - ElevenLabs無料プラン: 10,000文字/月
   - 超過時のフォールバックなし

**実装範囲:**

#### 2.1 TTSフォールバックシステム

**アーキテクチャ:**
```typescript
// TTSプロバイダー優先順位
const TTS_PROVIDERS = [
  { name: 'elevenlabs', priority: 1, quality: 'high', cost: 'high' },
  { name: 'polly', priority: 2, quality: 'medium', cost: 'low' },
  { name: 'google', priority: 3, quality: 'medium', cost: 'medium' }, // 将来
];

// フォールバックロジック
async function synthesizeSpeech(text: string): Promise<AudioBuffer> {
  for (const provider of TTS_PROVIDERS) {
    try {
      if (await provider.isAvailable()) {
        return await provider.synthesize(text);
      }
    } catch (error) {
      console.warn(`TTS provider ${provider.name} failed, trying next...`);
      // 次のプロバイダーへ
    }
  }
  throw new Error('All TTS providers failed');
}
```

**実装タスク:**
1. AWS Polly統合（フォールバック）
   - Lambda関数に `@aws-sdk/client-polly` 追加
   - Polly音声合成実装
   - 音声データ形式変換（Polly → WebM）

2. プロバイダー管理システム
   - プロバイダー優先順位設定（DB）
   - ヘルスチェック機能
   - 自動フォールバック

3. 管理者UI（Phase 2.5）
   - プロバイダー選択・優先順位変更
   - 使用量モニタリング
   - コスト比較

**環境変数（コメントアウト済み）:**
```bash
# .env.example
# POLLY_REGION=us-east-1
# POLLY_VOICE_ID=Mizuki
# POLLY_ENGINE=neural
```

**推定工数:** 3-4日
**優先度:** ⚠️ HIGH
**期限:** 本番リリース前
**担当:** Backend

---

#### 2.2 STTフォールバックシステム

**アーキテクチャ:**
```typescript
// STTプロバイダー優先順位
const STT_PROVIDERS = [
  { name: 'azure', priority: 1, quality: 'high', cost: 'medium' },
  { name: 'google', priority: 2, quality: 'high', cost: 'high' }, // 将来
  { name: 'whisper', priority: 3, quality: 'medium', cost: 'low' }, // 将来
];

// フォールバックロジック
async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  for (const provider of STT_PROVIDERS) {
    try {
      if (await provider.isAvailable()) {
        return await provider.transcribe(audioBuffer);
      }
    } catch (error) {
      console.warn(`STT provider ${provider.name} failed, trying next...`);
      // 次のプロバイダーへ
    }
  }
  throw new Error('All STT providers failed');
}
```

**実装タスク:**
1. Google Cloud Speech-to-Text統合（フォールバック）
   - Lambda関数に `@google-cloud/speech` 追加
   - Google Cloud認証設定
   - 音声データ形式対応

2. OpenAI Whisper統合（将来・低コスト）
   - Whisper APIまたはローカルモデル検討
   - 精度 vs コストの評価

3. プロバイダー管理システム
   - Azure同様の優先順位・ヘルスチェック

**推定工数:** 3-4日
**優先度:** ⚠️ HIGH
**期限:** 本番リリース前
**担当:** Backend

---

#### 2.3 共通フォールバック機能

**実装タスク:**
1. **ヘルスチェック機能**
   ```typescript
   interface ProviderHealthCheck {
     isAvailable(): Promise<boolean>;
     getLatency(): Promise<number>;
     getRateLimit(): Promise<{ remaining: number; reset: Date }>;
   }
   ```

2. **エラーハンドリング統一**
   ```typescript
   enum ProviderErrorType {
     RATE_LIMIT_EXCEEDED,
     SERVICE_UNAVAILABLE,
     AUTHENTICATION_FAILED,
     INVALID_REQUEST,
   }
   ```

3. **メトリクス・監視**
   - CloudWatch Metricsに使用率記録
   - プロバイダー別成功率・レイテンシ
   - コスト追跡

4. **管理者通知**
   - プロバイダー障害時にSlack/Email通知
   - フォールバック発生時の記録

**推定工数:** 2-3日
**優先度:** ⚠️ HIGH
**担当:** Backend + DevOps

---

### 3. S3_BUCKET vs STORAGE_BUCKET_NAME 統一

**現状:**
- WebSocket Lambda: `S3_BUCKET`
- API Lambda: `STORAGE_BUCKET_NAME`
- 同じバケットを指す重複変数

**問題:**
- メンテナンス性低下
- 設定ミスリスク

**実装手順:**
1. コードベース全体で `S3_BUCKET` に統一
2. CDK Stack更新
3. 本番Lambda関数デプロイ
4. 動作確認
5. `STORAGE_BUCKET_NAME` 削除

**推定工数:** 0.5日
**優先度:** ⚠️ HIGH
**期限:** 1週間以内
**担当:** Backend

---

## 💡 MEDIUM: 中優先度（1ヶ月以内）

### 4. Parameter Store移行

**詳細:** `docs/09-progress/archives/2026-03-19-temporary-reports/PHASE3_PARAMETER_STORE_PLAN.md` 参照

**対象:** RATE_LIMIT_*, STT_*, AUDIO/VIDEO_*, BEDROCK_MODEL_ID等（11変数）

**推定工数:** 4週間
**優先度:** 💡 MEDIUM
**期限:** 2026-04-30
**担当:** DevOps + Backend

---

### 5. CI/CD自動検証統合

**詳細:** `docs/09-progress/archives/2026-03-19-temporary-reports/PHASE3_PARAMETER_STORE_PLAN.md` 参照

**内容:**
- GitHub Actions Workflow
- PRマージ前自動検証
- デプロイ前必須チェック

**推定工数:** 1週間
**優先度:** 💡 MEDIUM
**期限:** 2026-04-30
**担当:** DevOps

---

## 🔮 LOW: 低優先度（将来機能）

### 6. Ready Player Me アバター生成統合

**現状:** コメントアウト済み（`READY_PLAYER_ME_APP_ID`）

**機能:**
- ユーザー画像からアバター自動生成
- カスタマイズ可能な3Dアバター
- リアルタイムレンダリング

**推定工数:** 2-3週間
**優先度:** 🔮 LOW
**期限:** Phase 5-6
**担当:** Frontend + 3D Engineer

---

### 7. AWS Rekognition 感情解析統合

**現状:** コメントアウト済み（`REKOGNITION_REGION`）

**機能:**
- リアルタイム表情認識
- 感情スコア（喜び・悲しみ・怒り等）
- 非言語行動分析強化

**推定工数:** 2週間
**優先度:** 🔮 LOW
**期限:** Phase 6
**担当:** Backend + AI Engineer

---

### 8. JWT トークン有効期限管理

**現状:** コメントアウト済み（`JWT_ACCESS_TOKEN_EXPIRES_IN`, `JWT_REFRESH_TOKEN_EXPIRES_IN`）

**機能:**
- トークン有効期限のカスタマイズ
- 自動リフレッシュ機構
- セキュリティポリシー準拠

**推定工数:** 1週間
**優先度:** 🔮 LOW
**期限:** Phase 4
**担当:** Backend

---

## 📊 タスク優先度マトリクス

| タスク | 優先度 | 推定工数 | 影響範囲 | 期限 |
|--------|--------|---------|---------|------|
| CloudFront署名付きURL | 🔴 CRITICAL | 2-3日 | 全録画機能 | 即座 |
| TTSフォールバック | ⚠️ HIGH | 3-4日 | セッション実行 | 本番前 |
| STTフォールバック | ⚠️ HIGH | 3-4日 | セッション実行 | 本番前 |
| 共通フォールバック機能 | ⚠️ HIGH | 2-3日 | 全音声機能 | 本番前 |
| S3_BUCKET統一 | ⚠️ HIGH | 0.5日 | 録画・ストレージ | 1週間 |
| Parameter Store移行 | 💡 MEDIUM | 4週間 | 設定管理 | 1ヶ月 |
| CI/CD統合 | 💡 MEDIUM | 1週間 | デプロイ | 1ヶ月 |
| Ready Player Me | 🔮 LOW | 2-3週間 | アバター生成 | Phase 5-6 |
| Rekognition | 🔮 LOW | 2週間 | 感情解析 | Phase 6 |
| JWT管理 | 🔮 LOW | 1週間 | 認証 | Phase 4 |

---

## ✅ 完了基準

### CloudFront署名付きURL
- [ ] Key Pair生成
- [ ] Public Key登録
- [ ] Key Group作成
- [ ] Distribution設定更新
- [ ] Secret Manager保存
- [ ] CDK更新
- [ ] Lambda実装
- [ ] 動作確認

### TTS/STTフォールバック
- [ ] AWS Polly統合
- [ ] Google Cloud Speech統合（将来）
- [ ] プロバイダー管理システム
- [ ] ヘルスチェック機能
- [ ] 自動フォールバックロジック
- [ ] CloudWatch監視
- [ ] 管理者UI（Phase 2.5）
- [ ] E2Eテスト

### S3_BUCKET統一
- [ ] コードベース全体修正
- [ ] CDK Stack更新
- [ ] 本番デプロイ
- [ ] 動作確認
- [ ] STORAGE_BUCKET_NAME削除

---

## 📚 関連ドキュメント

- [ENVIRONMENT_VARIABLE_AUDIT_REPORT.md](../09-progress/archives/2026-03-19-temporary-reports/ENVIRONMENT_VARIABLE_AUDIT_REPORT.md)
- [PHASE3_PARAMETER_STORE_PLAN.md](../09-progress/archives/2026-03-19-temporary-reports/PHASE3_PARAMETER_STORE_PLAN.md)
- [CloudFront Signed URLs Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html)

---

**最終更新:** 2026-03-19
**次回レビュー:** タスク完了時
**管理者:** DevOps Team
