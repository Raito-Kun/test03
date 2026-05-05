-- Per-extension SIP registration state (populated by sip-presence-job).
-- Covers extensions not mapped to a user (e.g. shared IVR, test phones).
ALTER TABLE "cluster_extensions"
  ADD COLUMN IF NOT EXISTS "sip_registered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sip_registered_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "network_ip" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "idx_cluster_extensions_sip_registered"
  ON "cluster_extensions" ("cluster_id", "sip_registered");
