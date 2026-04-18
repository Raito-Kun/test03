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
 * Strict tenant isolation: every role — including super_admin — sees only
 * the currently-active tenant's rows.
 *
 * For super_admin: we explicitly read `pbx_clusters.isActive` from the DB
 * instead of trusting the JWT claim. `switchCluster` flips that flag
 * atomically but does NOT re-issue the caller's JWT — so a stale JWT
 * would keep scoping super_admin to their home cluster (e.g. the tenant
 * they were first created under) even after they switched. This caused
 * the 2026-04-17 blueva cross-tenant data leak. See
 * `plans/reports/debugger-260417-2020-cross-tenant-leak.md`.
 *
 * For other roles: trust the JWT's userClusterId — regular users cannot
 * switch tenants, so their JWT claim is always correct for their lifetime.
 */
export async function resolveListClusterFilter(
  userRole: string | undefined,
  userClusterId?: string | null,
): Promise<string | null> {
  if (userRole === 'super_admin') {
    const cluster = await prisma.pbxCluster.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    return cluster?.id ?? null;
  }
  return getActiveClusterId(userClusterId);
}

/** Lookup a cluster by its PBX source IP — used to stamp inbound webhooks. */
export async function getClusterIdByPbxIp(ip: string | undefined | null): Promise<string | null> {
  if (!ip) return null;
  // Strip IPv4-mapped IPv6 prefix (Express may report ::ffff:10.10.101.206)
  const clean = ip.replace(/^::ffff:/, '');
  const cluster = await prisma.pbxCluster.findFirst({
    where: { pbxIp: clean },
    select: { id: true },
  });
  return cluster?.id ?? null;
}

/**
 * Lookup a cluster by PBX source IP **and** SIP domain. A single physical PBX
 * can host multiple FusionPBX domains — e.g. 10.10.101.206 runs both `blueva`
 * and `hoangthienfinance.vn`. Without the domain filter we'd misattribute CDRs
 * from one tenant to another. Returns null when the domain isn't registered
 * as a cluster — caller should drop the CDR in that case.
 */
export async function getClusterIdByPbxIpAndDomain(
  ip: string | undefined | null,
  domain: string | undefined | null,
): Promise<string | null> {
  if (!ip || !domain) return null;
  const clean = ip.replace(/^::ffff:/, '');
  const cluster = await prisma.pbxCluster.findFirst({
    where: { pbxIp: clean, sipDomain: domain },
    select: { id: true },
  });
  return cluster?.id ?? null;
}
