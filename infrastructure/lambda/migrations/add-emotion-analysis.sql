-- Add emotion_analyses table
-- Date: 2026-03-09
-- Task: 2.2.1 Emotion Analysis

-- CreateTable (IF NOT EXISTS to avoid errors on re-run)
CREATE TABLE IF NOT EXISTS "emotion_analyses" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "recording_id" TEXT,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "frame_url" TEXT,
    "emotions" JSONB NOT NULL,
    "dominant_emotion" TEXT,
    "age_range" JSONB,
    "gender" TEXT,
    "gender_confidence" DOUBLE PRECISION,
    "eyes_open" BOOLEAN,
    "eyes_open_confidence" DOUBLE PRECISION,
    "mouth_open" BOOLEAN,
    "mouth_open_confidence" DOUBLE PRECISION,
    "pose" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "brightness" DOUBLE PRECISION,
    "sharpness" DOUBLE PRECISION,
    "processing_time_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotion_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS to avoid errors on re-run)
CREATE INDEX IF NOT EXISTS "emotion_analyses_session_id_idx" ON "emotion_analyses"("session_id");

-- CreateIndex (IF NOT EXISTS to avoid errors on re-run)
CREATE INDEX IF NOT EXISTS "emotion_analyses_recording_id_idx" ON "emotion_analyses"("recording_id");

-- CreateIndex (IF NOT EXISTS to avoid errors on re-run)
CREATE INDEX IF NOT EXISTS "emotion_analyses_timestamp_idx" ON "emotion_analyses"("timestamp");

-- AddForeignKey (Note: Will fail if already exists, but that's OK)
ALTER TABLE "emotion_analyses" ADD CONSTRAINT "emotion_analyses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Note: Will fail if already exists, but that's OK)
ALTER TABLE "emotion_analyses" ADD CONSTRAINT "emotion_analyses_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "recordings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
