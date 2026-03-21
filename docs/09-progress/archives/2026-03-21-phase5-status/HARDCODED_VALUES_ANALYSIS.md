# Hardcoded Values Analysis & Categorization

**Date:** 2026-03-21 12:15 UTC (Day 30)
**Purpose:** Identify and categorize hardcoded values for potential migration
**Status:** Analysis Complete

---

## 📊 Detection Summary

**Total Hardcoded Values Found:** 28+
**Method:** `detect-hardcoded-values.sh` + Manual inspection

---

## 🎯 Categorization Framework

### Category A: Runtime Configurable (UI管理推奨) ⭐
**定義:** スーパー管理者がUIから変更すべき、ビジネスロジック・チューニングパラメータ

**特徴:**
- 頻繁に調整が必要
- A/Bテスト対象
- 環境ごとに最適値が異なる
- サーバー再起動なしで変更したい

### Category B: Environment Variable (環境変数)
**定義:** インフラ・環境依存の設定値

**特徴:**
- 環境（dev/staging/production）で異なる
- デプロイ時に設定
- 変更頻度: 低

### Category C: True Constants (真の定数)
**定義:** 変更不要な固定値

**特徴:**
- 数学定数、プロトコル定数
- ビジネスロジックに依存しない
- 変更すると機能が壊れる

---

## 🔍 Detected Hardcoded Values

### 1. Score Calculation Weights (Category A: Runtime Configurable) ⭐

**Location:** `infrastructure/lambda/shared/analysis/score-calculator.ts`

#### 1.1 Scoring Presets (Lines 27-58)

```typescript
export const SCORING_PRESETS: Record<ScoringPreset, ScoringWeights> = {
  default: {
    emotion: 0.35,      // ❌ Hardcoded
    audio: 0.35,        // ❌ Hardcoded
    content: 0.2,       // ❌ Hardcoded
    delivery: 0.1,      // ❌ Hardcoded
  },
  interview_practice: {
    emotion: 0.4,       // ❌ Hardcoded
    audio: 0.3,         // ❌ Hardcoded
    content: 0.2,       // ❌ Hardcoded
    delivery: 0.1,      // ❌ Hardcoded
  },
  language_learning: {
    emotion: 0.15,      // ❌ Hardcoded
    audio: 0.5,         // ❌ Hardcoded
    content: 0.25,      // ❌ Hardcoded
    delivery: 0.1,      // ❌ Hardcoded
  },
  presentation: {
    emotion: 0.3,       // ❌ Hardcoded
    audio: 0.3,         // ❌ Hardcoded
    content: 0.3,       // ❌ Hardcoded
    delivery: 0.1,      // ❌ Hardcoded
  },
  custom: {
    emotion: 0.35,      // ❌ Hardcoded
    audio: 0.35,        // ❌ Hardcoded
    content: 0.2,       // ❌ Hardcoded
    delivery: 0.1,      // ❌ Hardcoded
  },
};
```

**Total:** 20 hardcoded weight values (5 presets × 4 weights)

**Recommendation:** ✅ Migrate to runtime_configs

**Benefits:**
- プリセットごとに最適な重みを調整可能
- 組織ごとにカスタマイズ可能
- A/Bテストで最適値を発見

**Database Schema:**
```sql
-- Preset-based weights
INSERT INTO runtime_configs (key, value, data_type, category, access_level, description) VALUES
('SCORE_PRESET_DEFAULT_EMOTION', 0.35, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE', 'Default preset emotion weight'),
('SCORE_PRESET_DEFAULT_AUDIO', 0.35, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE', 'Default preset audio weight'),
('SCORE_PRESET_DEFAULT_CONTENT', 0.2, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE', 'Default preset content weight'),
('SCORE_PRESET_DEFAULT_DELIVERY', 0.1, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE', 'Default preset delivery weight'),

-- Interview practice preset
('SCORE_PRESET_INTERVIEW_EMOTION', 0.4, 'NUMBER', 'SCORING', 'CLIENT_ADMIN_READ_WRITE', 'Interview practice emotion weight'),
-- ... (repeat for all 5 presets)
```

#### 1.2 Internal Score Calculation Weights (Lines 204, 270, 307, 332)

```typescript
// Emotion score components (Line 204)
const emotionScore = stability * 0.3 + positivity * 0.25 + confidence * 0.25 + engagement * 0.2;

// Audio score components (Line 270)
const audioScore = clarity * 0.35 + fluency * 0.3 + pacing * 0.2 + volume * 0.15;

// Content score components (Line 307)
const contentScore = relevance * 0.4 + structure * 0.3 + completeness * 0.3;

// Delivery score components (Line 332)
const deliveryScore = avgEmotionConfidence * 0.5 + avgAudioQuality * 0.5;
```

**Total:** 13 internal weight values

**Recommendation:** ⚠️ Consider for Phase 6

**Reason:**
- より高度なチューニング
- 優先度: Medium（まずプリセット重みから）
- 複雑性が高い（4つの式 × 複数の係数）

---

### 2. Cache TTL Values (Category B: Environment Variable)

**Location:** `infrastructure/lambda/shared/utils/runtime-config-loader.ts`

```typescript
// Line 23
const MEMORY_CACHE_TTL_MS = 10_000;  // 10 seconds

// Line 26
const ELASTICACHE_TTL_SECONDS = 60;  // 60 seconds
```

**Recommendation:** ✅ Keep as environment variables

**Reason:**
- インフラレベルのチューニング
- 環境（dev/production）で異なる値が適切
- 変更頻度: 非常に低い
- スーパー管理者が変更する必要なし

**Action:** Move to `.env.local` / `infrastructure/.env`

```bash
# .env.local
MEMORY_CACHE_TTL_MS=10000
ELASTICACHE_TTL_SECONDS=60
```

---

### 3. Score Component Thresholds (Category C: True Constants)

**Location:** `infrastructure/lambda/shared/analysis/score-calculator.ts`

**Examples:**
- Confidence threshold for score levels
- Minimum/maximum score boundaries
- Mathematical constants

**Recommendation:** ✅ Keep as constants

**Reason:**
- ビジネスロジックの一部
- 変更するとスコア計算が壊れる
- 標準化された閾値

---

## 📋 Migration Priority

### Priority 1: Score Preset Weights (20 values) ⭐

**Target:** `SCORING_PRESETS` in score-calculator.ts

**Effort:** Medium (2-3 hours)
- Database: 20 new runtime_configs
- Code: Update `getWeights()` to use runtime-config-loader
- Testing: Verify score calculation with dynamic weights

**Impact:** High
- スーパー管理者がプリセットを最適化可能
- 組織ごとにカスタマイズ
- A/Bテストで効果測定

**Implementation Plan:**

1. **Database Migration (30 min)**
```sql
-- Create 20 configs (5 presets × 4 weights)
INSERT INTO runtime_configs ...
```

2. **Runtime Config Loader (30 min)**
```typescript
// Add getter functions
export async function getScorePresetWeights(preset: ScoringPreset): Promise<ScoringWeights>
```

3. **Update score-calculator.ts (1 hour)**
```typescript
// Before
getWeights(criteria: ScoringCriteria): ScoringWeights {
  return SCORING_PRESETS[criteria.preset] || SCORING_PRESETS.default;
}

// After
async getWeights(criteria: ScoringCriteria): Promise<ScoringWeights> {
  return await getScorePresetWeights(criteria.preset);
}
```

4. **Update Callers (30 min)**
```typescript
// calculateScore() already async - just add await
const weights = await this.getWeights(criteria);
```

5. **Testing (30 min)**
- Verify database values loaded correctly
- Test with different presets
- CloudWatch Logs verification

---

### Priority 2: Cache TTL Values (2 values)

**Target:** `MEMORY_CACHE_TTL_MS`, `ELASTICACHE_TTL_SECONDS`

**Effort:** Low (30 min)
- Environment variables: Add to `.env.local`
- Code: Update runtime-config-loader.ts

**Impact:** Low
- インフラチューニング用
- スーパー管理者は変更不要

**Implementation:**
```typescript
// Before
const MEMORY_CACHE_TTL_MS = 10_000;

// After
const MEMORY_CACHE_TTL_MS = parseInt(process.env.MEMORY_CACHE_TTL_MS || '10000', 10);
```

---

### Priority 3: Internal Score Weights (13 values)

**Status:** ⏭️ Deferred to Phase 6

**Reason:**
- 高度なチューニング
- Priority 1完了後に検討
- 複雑性が高い

---

## ✅ Immediate Action Items

### Action 1: Migrate Score Preset Weights (Priority 1)

**Estimated Time:** 2-3 hours

**Steps:**
1. Create database migration
2. Add runtime_configs (20 rows)
3. Update runtime-config-loader.ts
4. Update score-calculator.ts
5. Deploy Lambda functions
6. Test and verify

**Assignee:** Next session

### Action 2: Document Cache TTL as Environment Variables

**Estimated Time:** 15 minutes

**Steps:**
1. Add to `.env.local` and `infrastructure/.env`
2. Update runtime-config-loader.ts
3. Update documentation

**Assignee:** Next session (low priority)

---

## 📊 Summary Table

| Category | Count | Location | Recommendation | Priority | Effort |
|----------|-------|----------|----------------|----------|--------|
| Score Preset Weights | 20 | score-calculator.ts | Runtime Config | High | 2-3h |
| Internal Score Weights | 13 | score-calculator.ts | Phase 6 | Medium | 4-5h |
| Cache TTL | 2 | runtime-config-loader.ts | Env Var | Low | 30min |
| True Constants | N/A | Various | Keep | None | 0 |

**Total Hardcoded Values to Address:** 22 (immediate) + 13 (future)

---

## 🎯 Expected Outcomes

### After Priority 1 Migration:

**Before:**
```typescript
// Hardcoded presets
const weights = SCORING_PRESETS['interview_practice'];
// { emotion: 0.4, audio: 0.3, content: 0.2, delivery: 0.1 }
```

**After:**
```typescript
// Dynamic runtime config
const weights = await getScorePresetWeights('interview_practice');
// Loaded from database: { emotion: 0.45, audio: 0.35, content: 0.15, delivery: 0.05 }
// ✅ Customizable without code changes
```

**UI Benefits:**
```
Admin Dashboard → Runtime Configuration → Score Presets
├── Default Preset
│   ├── Emotion Weight: [0.35] (slider)
│   ├── Audio Weight: [0.35] (slider)
│   ├── Content Weight: [0.20] (slider)
│   └── Delivery Weight: [0.10] (slider)
├── Interview Practice
│   └── ... (customizable)
└── Custom Preset
    └── ... (fully customizable)
```

---

## 📚 Related Documents

- [Phase 5.4 Completion Report](PHASE_5.4_COMPLETION_REPORT.md)
- [Runtime Configuration System](../../../05-modules/RUNTIME_CONFIGURATION.md)
- [Hardcode Prevention System](../../../07-development/HARDCODE_PREVENTION_SYSTEM.md)

---

**Created:** 2026-03-21 12:15 UTC
**Status:** Analysis Complete
**Next Action:** Implement Priority 1 (Score Preset Weights Migration)
