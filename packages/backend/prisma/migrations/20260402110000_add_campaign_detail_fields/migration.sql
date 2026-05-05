-- CreateEnum
CREATE TYPE "CampaignCategory" AS ENUM ('telesale', 'collection', 'customer_service');

-- CreateEnum
CREATE TYPE "DialMode" AS ENUM ('manual', 'auto_dialer', 'power_dialer');

-- CreateEnum
CREATE TYPE "WorkSchedule" AS ENUM ('all_day', 'business_hours', 'custom');

-- AlterTable campaigns: add new detail fields
ALTER TABLE "campaigns"
  ADD COLUMN "category"          "CampaignCategory",
  ADD COLUMN "queue"             TEXT,
  ADD COLUMN "dial_mode"         "DialMode",
  ADD COLUMN "callback_url"      TEXT,
  ADD COLUMN "work_schedule"     "WorkSchedule",
  ADD COLUMN "work_start_time"   TEXT,
  ADD COLUMN "work_end_time"     TEXT;

-- CreateTable campaign_agents (composite PK, no separate id column)
CREATE TABLE "campaign_agents" (
  "campaign_id"  UUID NOT NULL,
  "user_id"      UUID NOT NULL,
  "assigned_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "campaign_agents_pkey" PRIMARY KEY ("campaign_id", "user_id")
);

-- AddForeignKey
ALTER TABLE "campaign_agents"
  ADD CONSTRAINT "campaign_agents_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_agents"
  ADD CONSTRAINT "campaign_agents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
