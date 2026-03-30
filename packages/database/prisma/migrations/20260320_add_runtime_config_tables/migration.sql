-- CreateEnum
CREATE TYPE "RuntimeConfigDataType" AS ENUM ('NUMBER', 'STRING', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "RuntimeConfigCategory" AS ENUM ('QUERY_PROCESSING', 'AI_PROCESSING', 'AUDIO_PROCESSING', 'SCORE_CALCULATION', 'SECURITY', 'SYSTEM');

-- CreateTable
CREATE TABLE "runtime_configs" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "data_type" "RuntimeConfigDataType" NOT NULL,
    "category" "RuntimeConfigCategory" NOT NULL,
    "default_value" JSONB NOT NULL,
    "min_value" DOUBLE PRECISION,
    "max_value" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "runtime_configs_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "runtime_config_history" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "old_value" JSONB NOT NULL,
    "new_value" JSONB NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "runtime_config_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runtime_configs_category_idx" ON "runtime_configs"("category");

-- CreateIndex
CREATE INDEX "runtime_configs_updated_at_idx" ON "runtime_configs"("updated_at");

-- CreateIndex
CREATE INDEX "runtime_config_history_key_idx" ON "runtime_config_history"("key");

-- CreateIndex
CREATE INDEX "runtime_config_history_changed_at_idx" ON "runtime_config_history"("changed_at");

-- CreateIndex
CREATE INDEX "runtime_config_history_changed_by_idx" ON "runtime_config_history"("changed_by");

-- AddForeignKey
ALTER TABLE "runtime_config_history" ADD CONSTRAINT "runtime_config_history_key_fkey" FOREIGN KEY ("key") REFERENCES "runtime_configs"("key") ON DELETE CASCADE ON UPDATE CASCADE;
