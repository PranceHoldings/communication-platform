-- Add audio_analyses table
-- Task: 2.2.2 Audio Feature Analysis

CREATE TABLE IF NOT EXISTS "audio_analyses" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "transcript_id" TEXT,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "pitch" DOUBLE PRECISION,
    "pitch_variance" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "volume_variance" DOUBLE PRECISION,
    "speaking_rate" DOUBLE PRECISION,
    "pause_count" INTEGER,
    "pause_duration" DOUBLE PRECISION,
    "clarity" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "snr" DOUBLE PRECISION,
    "filler_words" JSONB,
    "filler_count" INTEGER,
    "audio_url" TEXT,
    "duration" DOUBLE PRECISION,
    "processing_time_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_analyses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audio_analyses_session_id_idx" ON "audio_analyses"("session_id");
CREATE INDEX IF NOT EXISTS "audio_analyses_transcript_id_idx" ON "audio_analyses"("transcript_id");
CREATE INDEX IF NOT EXISTS "audio_analyses_timestamp_idx" ON "audio_analyses"("timestamp");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audio_analyses_session_id_fkey') THEN
        ALTER TABLE "audio_analyses" ADD CONSTRAINT "audio_analyses_session_id_fkey"
        FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audio_analyses_transcript_id_fkey') THEN
        ALTER TABLE "audio_analyses" ADD CONSTRAINT "audio_analyses_transcript_id_fkey"
        FOREIGN KEY ("transcript_id") REFERENCES "transcripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Add session_scores table
-- Task: 2.2.3 Scoring Algorithm

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

CREATE INDEX IF NOT EXISTS "session_scores_session_id_idx" ON "session_scores"("session_id");
CREATE INDEX IF NOT EXISTS "session_scores_overall_score_idx" ON "session_scores"("overall_score");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_scores_session_id_fkey') THEN
        ALTER TABLE "session_scores" ADD CONSTRAINT "session_scores_session_id_fkey"
        FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
