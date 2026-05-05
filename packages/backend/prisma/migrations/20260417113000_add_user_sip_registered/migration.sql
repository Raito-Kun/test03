-- Add SIP registration state persisted from FusionPBX (presence polling)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "sip_registered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sip_registered_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "idx_users_sip_registered" ON "users" ("sip_registered");
