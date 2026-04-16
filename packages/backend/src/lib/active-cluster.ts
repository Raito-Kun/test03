import prisma from './prisma';

/**
 * Get the active cluster ID for create/stamp operations.
 * If userClusterId is provided (from JWT token), use it directly.
 * Otherwise fall back to the global active cluster (legacy behavior).
 * Returns null if no cluster can be determined.
 */
export async function getActiveClusterId(userClusterId?: string | null): Promise<string | null> {
  if (userClusterId) return userClusterId;

  const cluster = await prisma.pbxCluster.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  return cluster?.id ?? null;
}

/**
 * Resolve the cluster filter used by list/read endpoints.
 *
 * super_admin is cross-tenant by design — returns null so the caller
 * can `...(clusterId && { clusterId })` pattern skip the filter entirely
 * and the query returns every cluster's rows.
 *
 * All other roles receive the same clusterId they're bound to on the JWT
 * (with the active-cluster fallback for legacy users whose cluster_id is
 * NULL), preserving the existing single-tenant scoping.
 */
export async function resolveListClusterFilter(
  userRole: string | undefined,
  userClusterId?: string | null,
): Promise<string | null> {
  if (userRole === 'super_admin') return null;
  return getActiveClusterId(userClusterId);
}
