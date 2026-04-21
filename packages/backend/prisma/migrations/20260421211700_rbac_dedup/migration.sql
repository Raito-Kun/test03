-- Migration: RBAC permission deduplication
-- Collapses 16 legacy flat keys into modern resource.action keys.
-- Idempotent: safe to re-run.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('import_campaigns',  'campaign.import'),
    ('manage_campaigns',  'campaign.manage'),
    ('view_reports',      'report.view_own'),
    ('export_excel',      'report.export'),
    ('make_calls',        'switchboard.make_call'),
    ('view_recordings',   'switchboard.listen_recording'),
    ('view_dashboard',    'report.view_own'),
    ('manage_users',      'system.users'),
    ('manage_permissions','system.permissions'),
    ('manage_tickets',    'ticket.manage'),
    ('manage_contacts',   'crm.contacts.edit'),
    ('manage_leads',      'crm.leads.edit'),
    ('manage_debt_cases', 'crm.debt.edit'),
    ('import_leads',      'crm.leads.import'),
    ('import_contacts',   'crm.contacts.import'),
    ('manage_extensions', 'system.manage')
  ) AS x(legacy, modern) LOOP

    IF EXISTS(SELECT 1 FROM permissions WHERE key = r.legacy)
       AND EXISTS(SELECT 1 FROM permissions WHERE key = r.modern) THEN

      -- Both exist: merge grants from legacy into modern (per cluster+role combination)
      -- For any (cluster_id, role) that has the legacy grant but NOT the modern grant,
      -- insert a modern grant row.
      INSERT INTO role_permissions (cluster_id, role, permission_id, granted)
      SELECT rp_legacy.cluster_id, rp_legacy.role, p_modern.id, rp_legacy.granted
      FROM role_permissions rp_legacy
      JOIN permissions p_legacy ON p_legacy.id = rp_legacy.permission_id
      CROSS JOIN permissions p_modern
      WHERE p_legacy.key = r.legacy AND p_modern.key = r.modern
      ON CONFLICT (cluster_id, role, permission_id) DO UPDATE
        SET granted = EXCLUDED.granted OR role_permissions.granted;

      -- Drop legacy row (FK cascade removes role_permissions rows)
      DELETE FROM permissions WHERE key = r.legacy;

    ELSIF EXISTS(SELECT 1 FROM permissions WHERE key = r.legacy) THEN
      -- Only legacy exists: rename key in-place (FK on permission_id is preserved)
      UPDATE permissions SET key = r.modern WHERE key = r.legacy;
    END IF;

  END LOOP;
END $$;

-- Add new permission: recording.delete
INSERT INTO permissions (id, key, label, "group")
VALUES (gen_random_uuid(), 'recording.delete', 'Xoá ghi âm', 'switchboard')
ON CONFLICT (key) DO NOTHING;

-- Grant recording.delete to super_admin and admin in every cluster
INSERT INTO role_permissions (cluster_id, role, permission_id, granted)
SELECT c.id, r.role, p.id, true
FROM pbx_clusters c
CROSS JOIN (VALUES ('super_admin'::text), ('admin')) AS r(role)
CROSS JOIN permissions p
WHERE p.key = 'recording.delete'
ON CONFLICT (cluster_id, role, permission_id) DO UPDATE SET granted = true;

-- Remove any permission rows for keys that no longer exist
-- (handles edge case of partial previous migration runs leaving orphan keys)
DELETE FROM permissions
WHERE key IN (
  'import_campaigns','manage_campaigns','view_reports','export_excel',
  'make_calls','view_recordings','view_dashboard','manage_users',
  'manage_permissions','manage_tickets','manage_contacts','manage_leads',
  'manage_debt_cases','import_leads','import_contacts','manage_extensions'
);
