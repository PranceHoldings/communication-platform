# Future Actions - 今後のアクションリスト

**最終更新:** 2026-03-14
**ステータス:** 優先度順

---

## 🔴 High Priority

### 1. シナリオ編集画面のエラー修正（2026-03-14追加）

**問題:**
1. **React Key警告**: QuestionEditorコンポーネントでkey propが欠落
2. **翻訳キー欠落**: `scenarios.questions.types.followUp` が未定義

**影響:**
- ⚠️ シナリオ編集画面でConsoleエラーが大量発生
- ⚠️ ユーザー体験の低下

**修正内容:**

#### Issue 1: React Key警告修正

**ファイル:** `apps/web/components/scenarios/question-editor.tsx`（推定）

**Before:**
```tsx
{questions.map((question) => (
  <div>  {/* ❌ key prop missing */}
    <QuestionInput value={question} />
  </div>
))}
```

**After:**
```tsx
{questions.map((question, index) => (
  <div key={question.id || index}>  {/* ✅ key prop added */}
    <QuestionInput value={question} />
  </div>
))}
```

#### Issue 2: 翻訳キー追加

**ファイル:** `apps/web/messages/en/scenarios.ts`

**追加内容:**
```typescript
export default {
  // ... existing translations
  questions: {
    types: {
      open: 'Open-ended Question',
      closed: 'Yes/No Question',
      rating: 'Rating Question',
      followUp: 'Follow-up Question',  // 🆕 Add this
    },
    // ...
  },
};
```

**ファイル:** `apps/web/messages/ja/scenarios.ts`

```typescript
export default {
  // ... existing translations
  questions: {
    types: {
      open: '自由回答形式',
      closed: 'はい/いいえ形式',
      rating: '評価形式',
      followUp: 'フォローアップ質問',  // 🆕 Add this
    },
    // ...
  },
};
```

#### Issue 3: Additional Configuration の改善

**要望:** JSONテキスト入力 → ドロップダウン選択に変更

**実装案:**

**Before (JSON入力):**
```tsx
<Textarea
  value={JSON.stringify(config, null, 2)}
  onChange={(e) => setConfig(JSON.parse(e.target.value))}
/>
```

**After (ドロップダウン):**
```tsx
<div className="space-y-4">
  <div>
    <Label>Silence Timeout</Label>
    <Select value={config.silenceTimeout} onValueChange={(v) => setConfig({...config, silenceTimeout: v})}>
      <SelectTrigger>
        <SelectValue placeholder="Select timeout" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="30">30 seconds</SelectItem>
        <SelectItem value="60">1 minute</SelectItem>
        <SelectItem value="120">2 minutes</SelectItem>
        <SelectItem value="300">5 minutes</SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div>
    <Label>Enable Silence Prompt</Label>
    <Switch
      checked={config.enableSilencePrompt}
      onCheckedChange={(checked) => setConfig({...config, enableSilencePrompt: checked})}
    />
  </div>

  <div>
    <Label>Silence Threshold</Label>
    <Slider
      value={[config.silenceThreshold]}
      onValueChange={([value]) => setConfig({...config, silenceThreshold: value})}
      min={0.01}
      max={0.5}
      step={0.01}
    />
    <span className="text-sm text-muted-foreground">{config.silenceThreshold}</span>
  </div>

  <div>
    <Label>Min Silence Duration (ms)</Label>
    <Select value={config.minSilenceDuration} onValueChange={(v) => setConfig({...config, minSilenceDuration: v})}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="200">200ms</SelectItem>
        <SelectItem value="500">500ms</SelectItem>
        <SelectItem value="800">800ms</SelectItem>
        <SelectItem value="1000">1000ms</SelectItem>
        <SelectItem value="1500">1500ms</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>
```

**推定作業時間:** 30分
**優先度:** High（ユーザー体験に影響）

---

## 🟡 Medium Priority

### 2. Phase 1.6 Task 2-3 実装（進行中）

**タスク:** シーケンス番号検証 + チャンク整合性検証

**詳細:** `docs/09-progress/phases/PHASE_1.6_DAY15-16_RECORDING_RELIABILITY.md`

**推定作業時間:** 4-6時間

---

## 🟢 Low Priority

### 3. Lambda デプロイメント自動化改善

**問題:** Prisma Client bundlingエラーでCDKデプロイが失敗

**解決策:** CDK bundling設定の改善またはpre-bundledアプローチ

**推定作業時間:** 1-2時間

---

## 📋 完了チェックリスト（Issue 1 修正時）

- [ ] QuestionEditorコンポーネントのkey prop追加
- [ ] en/scenarios.ts に `followUp` 翻訳追加
- [ ] ja/scenarios.ts に `followUp` 翻訳追加
- [ ] 他の9言語にも翻訳追加（de, es, fr, it, ko, pt, zh-CN, zh-TW）
- [ ] Additional Configuration UIをドロップダウン化
- [ ] シナリオ編集画面でテスト
- [ ] Consoleエラーが消えたことを確認
- [ ] 新規シナリオ作成・編集が正常動作することを確認

---

**最終更新:** 2026-03-14 17:30 JST
**次回更新:** Issue修正完了時
