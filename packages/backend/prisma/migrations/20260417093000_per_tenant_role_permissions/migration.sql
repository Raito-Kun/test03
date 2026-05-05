-- Make role_permissions per-tenant.
-- Strategy: add cluster_id, backfill by cross-joining current rows with every
-- existing cluster, then swap primary key and add FK.

BEGIN;

-- 1. Add column nullable so we can backfill.
ALTER TABLE "role_permissions"
  ADD COLUMN "cluster_id" uuid;

-- 2. Drop the old PK first, otherwise (role, permission_id) uniqueness blocks
--    the cross-join duplication below.
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_pkey";

-- 3. Backfill: duplicate each existing global row into every cluster.
INSERT INTO "role_permissions" ("cluster_id", "role", "permission_id", "granted")
SELECT c.id, rp.role, rp.permission_id, rp.granted
FROM "role_permissions" rp
CROSS JOIN "pbx_clusters" c
WHERE rp.cluster_id IS NULL;

-- 4. Delete the legacy global rows (cluster_id IS NULL).
DELETE FROM "role_permissions" WHERE cluster_id IS NULL;

-- 5. Enforce NOT NULL.
ALTER TABLE "role_permissions"
  ALTER COLUMN "cluster_id" SET NOT NULL;

-- 6. New PK.
ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_pkey"
  PRIMARY KEY ("cluster_id", "role", "permission_id");

-- 7. Secondary index for (role, permission_id) lookups.
CREATE INDEX "role_permissions_role_permission_id_idx"
  ON "role_permissions" ("role", "permission_id");

-- 8. FK to pbx_clusters.
ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_cluster_id_fkey"
  FOREIGN KEY ("cluster_id") REFERENCES "pbx_clusters" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
