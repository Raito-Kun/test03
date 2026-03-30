-- Migration: expand debt case fields
-- Adds contractNumber, debtType, paidAmount, remainingAmount, debtGroup, dueDate to debt_cases table

ALTER TABLE "debt_cases"
  ADD COLUMN IF NOT EXISTS "contract_number" TEXT,
  ADD COLUMN IF NOT EXISTS "debt_type" TEXT,
  ADD COLUMN IF NOT EXISTS "paid_amount" DECIMAL(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "remaining_amount" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "debt_group" TEXT,
  ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMP(3);
