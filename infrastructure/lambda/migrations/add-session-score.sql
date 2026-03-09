-- Add session_scores table
-- Date: 2026-03-09
-- Task: 2.2.3 Scoring Algorithm

-- CreateTable
CREATE TABLE IF NOT EXISTS "session_scores" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL UNIQUE,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "emotion_score" DOUBLE PRECISION,
    "audio_score" DOUBLE PRECISION,
    "content_score" DOUBLE PRECISION,
    "delivery_score" DOUBLE PRECISION,
    "emotion_stability" DOUBLE PRECISION,
    "emotion_positivity" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "engagement" DOUBLE PRECISION,
    "clarity" DOUBLE PRECISION,
    "fluency" DOUBLE PRECISION,
    "pacing" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "relevance" DOUBLE PRECISION,
    "structure" DOUBLE PRECISION,
    "completeness" DOUBLE PRECISION,
    "strengths" JSONB,
    "improvements" JSONB,
    "criteria" JSONB,
    "weights" JSONB,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "session_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_scores_session_id_idx" ON "session_scores"("session_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_scores_overall_score_idx" ON "session_scores"("overall_score");

-- AddForeignKey
ALTER TABLE "session_scores" ADD CONSTRAINT "session_scores_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
