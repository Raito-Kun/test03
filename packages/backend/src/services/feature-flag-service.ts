import prisma from '../lib/prisma';
import { logAudit } from '../lib/audit';
import { Request } from 'express';
import { getActiveClusterId } from '../lib/active-cluster';

/** All known feature keys */
export const FEATURE_KEYS = [
  'contacts', 'leads', 'debt', 'campaigns', 'tickets',
  'voip_c2c', 'recording', 'cdr_webhook', 'live_monitoring', 'call_history',
  'reports_summary', 'reports_detail', 'reports_chart', 'reports_export',
  'ai_assistant', 'ai_qa',
  'team_management', 'permission_matrix', 'pbx_cluster_mgmt',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

// domainName="" means cluster-level (applies to whole cluster)

/** Get all feature flags for a cluster, optionally filtered by domain */
export async function getFeatureFlags(clusterId: string, domainName?: string) {
  const where: any = { clusterId };
  if (domainName !== undefined) {
    where.domainName = domainName;
  }
  return prisma.clusterFeatureFlag.findMany({ where, orderBy: { featureKey: 'asc' } });
}

/** Get distinct domain names that have flags for a cluster (excludes empty = cluster-level) */
export async function getFlagDomains(clusterId: string): Promise<string[]> {
  const rows = await prisma.clusterFeatureFlag.findMany({
    where: { clusterId, domainName: { not: '' } },
    select: { domainName: true },
    distinct: ['domainName'],
    orderBy: { domainName: 'asc' },
  });
  return rows.map((r) => r.domainName);
}

/** Bulk upsert feature flags for a cluster/domain scope */
export async function bulkUpsertFlags(
  clusterId: string,
  domainName: string, // "" = cluster-level
  flags: { featureKey: string; isEnabled: boolean }[],
  userId: string,
  req?: Request,
): Promise<number> {
  const ops = flags.map((f) =>
    prisma.clusterFeatureFlag.upsert({
      where: {
        clusterId_domainName_featureKey: { clusterId, domainName, featureKey: f.featureKey },
      },
      update: { isEnabled: f.isEnabled, updatedBy: userId },
      create: { clusterId, domainName, featureKey: f.featureKey, isEnabled: f.isEnabled, updatedBy: userId },
    }),
  );
  await prisma.$transaction(ops);
  logAudit(userId, 'update', 'cluster_feature_flags', clusterId, { domainName: domainName || '(cluster)', flagCount: flags.length }, req);
  return flags.length;
}

/**
 * Check if a feature is enabled for a given cluster.
 * Cluster-level (domainName="") must be enabled. If no row exists, default is ON.
 * super_admin bypasses cluster-scoped flags (cross-tenant by design).
 */
export async function isFeatureEnabled(
  featureKey: string,
  userClusterId?: string | null,
  userRole?: string,
): Promise<boolean> {
  if (userRole === 'super_admin') return true;
  const clusterId = await getActiveClusterId(userClusterId);
  if (!clusterId) return true;

  const flag = await prisma.clusterFeatureFlag.findUnique({
    where: {
      clusterId_domainName_featureKey: { clusterId, domainName: '', featureKey },
    },
  });
  // No row = default ON; row exists = use its value
  return flag ? flag.isEnabled : true;
}

/**
 * Get all effective flags for the active cluster in one query.
 * Returns map: featureKey → isEnabled. Missing keys default to true.
 * super_admin gets every flag ON (cross-tenant bypass).
 */
export async function getEffectiveFlags(
  userClusterId?: string | null,
  userRole?: string,
): Promise<Record<string, boolean>> {
  if (userRole === 'super_admin') {
    return Object.fromEntries(FEATURE_KEYS.map((k) => [k, true]));
  }
  const clusterId = await getActiveClusterId(userClusterId);
  if (!clusterId) {
    return Object.fromEntries(FEATURE_KEYS.map((k) => [k, true]));
  }

  const flags = await prisma.clusterFeatureFlag.findMany({
    where: { clusterId, domainName: '' },
  });

  const result: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) {
    const flag = flags.find((f) => f.featureKey === key);
    result[key] = flag ? flag.isEnabled : true;
  }
  return result;
}
