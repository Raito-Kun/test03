-- Add multi-select list of outbound dialplan rules per cluster.
-- Preflight checks recording actions on each selected rule independently.
-- Empty array = preflight skips the check with hint "Chọn ít nhất 1 rule".

ALTER TABLE "pbx_clusters"
  ADD COLUMN "outbound_dialplan_names" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
