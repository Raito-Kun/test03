-- Add parent_id column to permissions for hierarchical grouping
ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
