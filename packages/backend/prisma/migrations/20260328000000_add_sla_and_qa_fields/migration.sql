-- Migration: add SLA tracking to tickets, wrap_up_duration to agent_status_logs,
--            timestamp/category to qa_annotations, notification type enum updates

-- Add SLA fields to tickets
ALTER TABLE "tickets"
  ADD COLUMN IF NOT EXISTS "first_response_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sla_breached" BOOLEAN NOT NULL DEFAULT false;

-- Add wrap_up_duration and created_at to agent_status_logs
ALTER TABLE "agent_status_logs"
  ADD COLUMN IF NOT EXISTS "wrap_up_duration" INTEGER,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Add timestamp and category to qa_annotations
ALTER TABLE "qa_annotations"
  ADD COLUMN IF NOT EXISTS "timestamp" INTEGER,
  ADD COLUMN IF NOT EXISTS "category" TEXT;

-- Add new notification types to enum
-- PostgreSQL requires adding enum values individually
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'debt_escalated';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'sla_breach';
