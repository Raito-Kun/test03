-- Track extension-sync lifecycle on each PBX cluster so the UI can surface
-- progress/errors after create/update (auto-sync is fire-and-forget in
-- cluster-service.ts). Values: idle | syncing | done | failed.
ALTER TABLE "pbx_clusters"
  ADD COLUMN "ext_sync_status"      VARCHAR(20) NOT NULL DEFAULT 'idle',
  ADD COLUMN "ext_sync_error"       TEXT,
  ADD COLUMN "ext_sync_count"       INTEGER,
  ADD COLUMN "ext_sync_finished_at" TIMESTAMPTZ;
