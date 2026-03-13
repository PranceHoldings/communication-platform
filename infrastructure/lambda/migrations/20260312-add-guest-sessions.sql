-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'GUEST';

-- CreateEnum
CREATE TYPE "GuestSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "is_guest_session" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guest_session_id" TEXT;

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "session_id" TEXT,
    "scenario_id" TEXT NOT NULL,
    "avatar_id" TEXT,
    "token" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "guest_name" TEXT,
    "guest_email" TEXT,
    "guest_metadata" JSONB DEFAULT '{}',
    "status" "GuestSessionStatus" NOT NULL DEFAULT 'PENDING',
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "first_accessed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "data_retention_days" INTEGER,
    "auto_delete_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_session_logs" (
    "id" TEXT NOT NULL,
    "guest_session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_guest_session_id_key" ON "sessions"("guest_session_id");

-- CreateIndex
CREATE INDEX "sessions_is_guest_session_idx" ON "sessions"("is_guest_session");

-- CreateIndex
CREATE INDEX "sessions_guest_session_id_idx" ON "sessions"("guest_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_session_id_key" ON "guest_sessions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_token_key" ON "guest_sessions"("token");

-- CreateIndex
CREATE INDEX "guest_sessions_org_id_idx" ON "guest_sessions"("org_id");

-- CreateIndex
CREATE INDEX "guest_sessions_creator_user_id_idx" ON "guest_sessions"("creator_user_id");

-- CreateIndex
CREATE INDEX "guest_sessions_token_idx" ON "guest_sessions"("token");

-- CreateIndex
CREATE INDEX "guest_sessions_status_idx" ON "guest_sessions"("status");

-- CreateIndex
CREATE INDEX "guest_sessions_valid_until_idx" ON "guest_sessions"("valid_until");

-- CreateIndex
CREATE INDEX "guest_sessions_auto_delete_at_idx" ON "guest_sessions"("auto_delete_at");

-- CreateIndex
CREATE INDEX "guest_session_logs_guest_session_id_idx" ON "guest_session_logs"("guest_session_id");

-- CreateIndex
CREATE INDEX "guest_session_logs_event_type_idx" ON "guest_session_logs"("event_type");

-- CreateIndex
CREATE INDEX "guest_session_logs_created_at_idx" ON "guest_session_logs"("created_at");

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "avatars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_session_logs" ADD CONSTRAINT "guest_session_logs_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
