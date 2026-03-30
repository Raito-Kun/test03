-- Migration: expand lead fields
-- Adds leadScore, product, budget columns to leads table

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "lead_score" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "product" TEXT,
  ADD COLUMN IF NOT EXISTS "budget" DECIMAL(15,2);
