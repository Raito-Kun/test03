-- Track who set the disposition on a call and when (list-view tooltip + audit cache).
-- Full change history remains in audit_logs (entity_type='call_logs').
ALTER TABLE "call_logs"
  ADD COLUMN "disposition_set_by_user_id" UUID,
  ADD COLUMN "disposition_set_at" TIMESTAMP(3);

ALTER TABLE "call_logs"
  ADD CONSTRAINT "call_logs_disposition_set_by_user_id_fkey"
  FOREIGN KEY ("disposition_set_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
