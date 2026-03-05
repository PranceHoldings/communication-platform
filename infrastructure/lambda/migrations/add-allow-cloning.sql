-- Add allow_cloning column to avatars table
ALTER TABLE "avatars" ADD COLUMN IF NOT EXISTS "allow_cloning" BOOLEAN NOT NULL DEFAULT false;
