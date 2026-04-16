-- CreateTable
CREATE TABLE "cluster_feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cluster_id" UUID NOT NULL,
    "domain_name" VARCHAR(255) NOT NULL DEFAULT '',
    "feature_key" VARCHAR(100) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "cluster_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cluster_feature_flags_cluster_id_idx" ON "cluster_feature_flags"("cluster_id");
CREATE INDEX "cluster_feature_flags_cluster_id_domain_name_idx" ON "cluster_feature_flags"("cluster_id", "domain_name");
CREATE UNIQUE INDEX "cluster_feature_flags_cluster_id_domain_name_feature_key_key" ON "cluster_feature_flags"("cluster_id", "domain_name", "feature_key");

-- AddForeignKey
ALTER TABLE "cluster_feature_flags" ADD CONSTRAINT "cluster_feature_flags_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "pbx_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
