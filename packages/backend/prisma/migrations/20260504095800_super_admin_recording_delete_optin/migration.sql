-- Migration: super_admin must opt in to recording.delete per cluster.
-- Background: previously super_admin bypassed every permission check and the
-- prior 20260421211700_rbac_dedup migration auto-granted recording.delete to
-- super_admin in every cluster. We now want destructive recording deletion
-- to be an explicit per-tenant toggle even for super_admin.
--
-- Idempotent: safe to re-run. Removes any existing super_admin grants for
-- recording.delete so the matrix renders OFF by default; admins can still
-- toggle it back on through the UI.

DELETE FROM role_permissions
WHERE role = 'super_admin'::"Role"
  AND permission_id IN (
    SELECT id FROM permissions WHERE key = 'recording.delete'
  );
