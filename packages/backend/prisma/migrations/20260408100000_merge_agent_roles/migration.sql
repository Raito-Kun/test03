-- Add 'agent' to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'agent' BEFORE 'agent_telesale';

-- Migrate existing users from agent_telesale/agent_collection to agent
UPDATE users SET role = 'agent' WHERE role IN ('agent_telesale', 'agent_collection');

-- Migrate role_permissions
UPDATE role_permissions SET role = 'agent' WHERE role IN ('agent_telesale', 'agent_collection');
