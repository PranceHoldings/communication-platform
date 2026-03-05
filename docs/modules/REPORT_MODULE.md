# レポートモジュール

**バージョン:** 1.0
**最終更新:** 2026-03-05
**ステータス:** 設計完了

---

## 目次

1. [概要](#概要)
2. [レポートテンプレート構造](#レポートテンプレート構造)
3. [標準レポートテンプレート](#標準レポートテンプレート)
4. [レポート生成フロー](#レポート生成フロー)
5. [PDF出力](#pdf出力)

---

## 概要

レポートモジュールは、セッション終了後に自動的に詳細なフィードバックレポートを生成します。

### 主要機能

| 機能 | 説明 |
| ---- | ---- |
| **自動レポート生成** | AI分析結果を基に即座にレポート作成 |
| **カスタムテンプレート** | 組織独自のレポート形式 |
| **PDF出力** | 印刷可能な高品質PDF |
| **メール送信** | レポート完成を自動通知 |

---

## レポートテンプレート構造

```typescript
interface ReportTemplate {
  id: string;
  name: string;
  sections: ReportSection[];
}

interface ReportSection {
  title: string;
  type: 'summary' | 'scores' | 'timeline' | 'recommendations' | 'custom';
  content: string; // Handlebarsテンプレート
}
```

---

## 標準レポートテンプレート

### 面接練習レポート

```
┌─────────────────────────────────────────────────────────────────┐
│                    面接セッションレポート                        │
│                                                                  │
│ セッション: エンジニア採用面接 - 中級                           │
│ 実施日時: 2026-03-05 14:30                                      │
│ 所要時間: 28分45秒                                               │
│ 総合評価: 78/100 (良好)                                          │
└─────────────────────────────────────────────────────────────────┘

📊 評価サマリー

論理的説明力:   ████████░░ 82/100
アイコンタクト: ██████░░░░ 65/100
話す速度:       ████████░░ 85/100
語彙・表現力:   ███████░░░ 72/100

💪 強み
- 技術的な質問に対して具体例を挙げて説明できている
- 話す速度が適切で、聞き取りやすい
- 専門用語を正しく使用している

📈 改善点
- カメラから視線が外れることが多い（65%）→ 80%以上を目指しましょう
- 沈黙が長い場面がある（平均7秒）→ 考えながら話す練習を
- 結論を先に述べる「結論ファースト」を意識すると良い

🎯 次回への推奨アクション
1. アイコンタクトを意識した練習を3回実施
2. 結論ファーストの話し方を練習
3. より難易度の高いシナリオに挑戦
```

---

## レポート生成フロー

```
セッション終了
     │
     ▼
解析完了 (感情・音声・内容評価)
     │
     ▼
Claude APIでフィードバック生成
     │
     ▼
テンプレートにデータ注入
     │
     ▼
HTMLレポート生成
     │
     ▼
PDF変換 (Puppeteer)
     │
     ▼
S3保存 & メール送信
```

### レポート生成API

```typescript
async function generateReport(sessionId: string): Promise<Report> {
  // 解析データ取得
  const analysis = await prisma.analysis.findUnique({
    where: { sessionId },
  });

  // テンプレート取得
  const template = await getReportTemplate(analysis.scenario.reportTemplateId);

  // Claude APIでフィードバック生成
  const feedback = await generateAIFeedback(sessionId, analysis);

  // HTMLレポート生成
  const html = renderReportHTML(template, { analysis, feedback });

  // PDF変換
  const pdf = await htmlToPDF(html);

  // S3保存
  const pdfUrl = await uploadToS3(pdf, `reports/${sessionId}/report.pdf`);

  return {
    id: generateUUID(),
    sessionId,
    pdfUrl,
    createdAt: new Date(),
  };
}
```

---

## PDF出力

- **ライブラリ:** Puppeteer (Chrome Headless)
- **フォーマット:** A4サイズ、余白20mm
- **ファイルサイズ:** 2-5MB（グラフ・画像含む）

---

**最終更新:** 2026-03-05
