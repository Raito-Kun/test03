-- Add FusionPBX Postgres read-only access fields to pbx_clusters.
-- Used by the preflight service to inspect v_dialplans + v_domains + v_extensions
-- without touching FusionPBX. All fields nullable so existing rows are unaffected.

ALTER TABLE "pbx_clusters"
  ADD COLUMN "fusionpbx_pg_host"     TEXT,
  ADD COLUMN "fusionpbx_pg_port"     INTEGER,
  ADD COLUMN "fusionpbx_pg_user"     TEXT,
  ADD COLUMN "fusionpbx_pg_password" TEXT,
  ADD COLUMN "fusionpbx_pg_database" TEXT;
