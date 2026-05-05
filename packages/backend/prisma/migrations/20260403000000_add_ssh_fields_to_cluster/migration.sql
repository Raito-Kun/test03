-- Add SSH fields to pbx_clusters for extension sync
ALTER TABLE "pbx_clusters" ADD COLUMN IF NOT EXISTS "ssh_user" TEXT;
ALTER TABLE "pbx_clusters" ADD COLUMN IF NOT EXISTS "ssh_password" TEXT;
