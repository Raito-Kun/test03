-- Add super_admin to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'super_admin';

-- Create permissions table
CREATE TABLE IF NOT EXISTS "permissions" (
  "id"    UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"   TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_key_key" ON "permissions"("key");

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role"          "Role" NOT NULL,
  "permission_id" UUID NOT NULL,
  "granted"       BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role", "permission_id"),
  CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
);
