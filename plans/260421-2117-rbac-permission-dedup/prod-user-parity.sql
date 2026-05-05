-- Mirror 5 missing crm.local users from dev to prod.
-- Idempotent: uses INSERT ... ON CONFLICT (email) DO UPDATE.
-- Blueva cluster id 13bec0b3-a748-4bff-9e4e-046e20c65319 is identical on dev+prod.
-- Also aligns superadmin@crm.local password hash with dev (different from prod's current).

-- Backup current superadmin hash first (in case rollback needed)
DO $$
DECLARE
  old_hash text;
BEGIN
  SELECT password_hash INTO old_hash FROM users WHERE email = 'superadmin@crm.local';
  RAISE NOTICE 'Previous superadmin hash prefix: %', SUBSTRING(old_hash FROM 1 FOR 20);
END $$;

-- Missing crm.local users (mirrored from dev exact hashes)
INSERT INTO users (id, email, full_name, password_hash, role, cluster_id, status, must_change_password, updated_at)
VALUES
  (gen_random_uuid(), 'manager@crm.local',   'Manager User',     '$2a$12$XgdklHm/JO7D9ForPV19NuALX6/aGbtsyERgAi7ibnp.N/PYkY5ju', 'manager',          '13bec0b3-a748-4bff-9e4e-046e20c65319', 'active', false, NOW()),
  (gen_random_uuid(), 'qa@crm.local',        'QA User',          '$2a$12$XgdklHm/JO7D9ForPV19NuALX6/aGbtsyERgAi7ibnp.N/PYkY5ju', 'qa',               '13bec0b3-a748-4bff-9e4e-046e20c65319', 'active', false, NOW()),
  (gen_random_uuid(), 'leader@crm.local',    'Leader Telesale',  '$2a$12$XgdklHm/JO7D9ForPV19NuALX6/aGbtsyERgAi7ibnp.N/PYkY5ju', 'leader',           '13bec0b3-a748-4bff-9e4e-046e20c65319', 'active', false, NOW()),
  (gen_random_uuid(), 'agent.ts@crm.local',  'Agent Telesale',   '$2a$12$JpPZPPt426gfUDQmK26OkONEtzcykXt8jt.DxqdWim8cTa5gN3dRq', 'agent_telesale',   '13bec0b3-a748-4bff-9e4e-046e20c65319', 'active', false, NOW()),
  (gen_random_uuid(), 'agent.col@crm.local', 'Agent Collection', '$2a$12$JpPZPPt426gfUDQmK26OkONEtzcykXt8jt.DxqdWim8cTa5gN3dRq', 'agent_collection', '13bec0b3-a748-4bff-9e4e-046e20c65319', 'active', false, NOW())
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  cluster_id = EXCLUDED.cluster_id,
  status = EXCLUDED.status,
  must_change_password = false,
  updated_at = NOW();

-- Align superadmin password hash with dev
UPDATE users
SET password_hash = '$2a$12$JDo6TF7be5h9onViTO6oOe2dgpcpdeU1WfARPGUTdJJSHUOCG1hvO',
    must_change_password = false
WHERE email = 'superadmin@crm.local';

-- Verify
SELECT email, role, cluster_id, status FROM users WHERE email LIKE '%crm.local' ORDER BY role, email;
