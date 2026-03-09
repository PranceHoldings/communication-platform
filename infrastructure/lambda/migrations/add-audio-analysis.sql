-- Add audio_analyses table
-- Date: 2026-03-09
-- Task: 2.2.2 Audio Feature Analysis

-- CreateTable
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audio_analyses_session_id_idx" ON "audio_analyses"("session_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audio_analyses_transcript_id_idx" ON "audio_analyses"("transcript_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audio_analyses_timestamp_idx" ON "audio_analyses"("timestamp");

-- AddForeignKey
ALTER TABLE "audio_analyses" ADD CONSTRAINT "audio_analyses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_analyses" ADD CONSTRAINT "audio_analyses_transcript_id_fkey" FOREIGN KEY ("transcript_id") REFERENCES "transcripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
