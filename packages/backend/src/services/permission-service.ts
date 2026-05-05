import { Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { SUPER_ADMIN_OPT_IN_PERMISSIONS, isSuperAdminOptIn } from '../lib/permission-constants';

interface PermissionWithGrants {
  id: string;
  key: string;
  label: string;
  group: string;
  grants: Record<string, boolean>;
}

// Cache keyed by `${clusterId}:${role}` — per-tenant matrix is independent.
const cache = new Map<string, { value: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(clusterId: string | null | undefined, role: Role): string {
  return `${clusterId ?? '-'}:${role}`;
}

function getCached(key: string): string[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key: string, value: string[]): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidatePermissionCache(clusterId?: string, role?: Role): void {
  if (clusterId && role) {
    cache.delete(cacheKey(clusterId, role));
    return;
  }
  if (clusterId) {
    for (const k of cache.keys()) {
      if (k.startsWith(`${clusterId}:`)) cache.delete(k);
    }
    return;
  }
  cache.clear();
}

/**
 * Returns permission keys granted to a role inside a cluster.
 * super_admin gets all auto-granted keys plus any opt-in keys
 * (SUPER_ADMIN_OPT_IN_PERMISSIONS) explicitly granted in role_permissions
 * for this cluster.
 */
export async function getPermissionsForRole(
  role: Role,
  clusterId?: string | null,
): Promise<string[]> {
  if (role === Role.super_admin) {
    const k = cacheKey(clusterId ?? '-', Role.super_admin);
    const cached = getCached(k);
    if (cached) return cached;

    const all = await prisma.permission.findMany({ select: { key: true } });
    const autoKeys = all.map((p) => p.key).filter((key) => !isSuperAdminOptIn(key));

    // For opt-in keys, super_admin needs an explicit grant. Skip if no clusterId.
    let optInKeys: string[] = [];
    if (clusterId) {
      const rps = await prisma.rolePermission.findMany({
        where: {
          clusterId,
          role: Role.super_admin,
          granted: true,
          permission: { key: { in: [...SUPER_ADMIN_OPT_IN_PERMISSIONS] } },
        },
        include: { permission: { select: { key: true } } },
      });
      optInKeys = rps.map((rp) => rp.permission.key);
    }

    const keys = [...autoKeys, ...optInKeys];
    setCache(k, keys);
    return keys;
  }

  // Non-super_admin must have a clusterId — no cluster means no permissions.
  if (!clusterId) return [];

  const k = cacheKey(clusterId, role);
  const cached = getCached(k);
  if (cached) return cached;

  const rps = await prisma.rolePermission.findMany({
    where: { clusterId, role, granted: true },
    include: { permission: { select: { key: true } } },
  });
  const keys = rps.map((rp) => rp.permission.key);
  setCache(k, keys);
  return keys;
}

/**
 * All permissions + role-grant map for the UI matrix, scoped to a cluster.
 * A permission with no row for (cluster, role) is considered granted=true
 * (matches pre-migration default when seeding fresh clusters).
 */
export async function getAllPermissionsWithGrants(
  clusterId: string,
): Promise<PermissionWithGrants[]> {
  const [permissions, rolePermissions] = await Promise.all([
    prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    }),
    prisma.rolePermission.findMany({ where: { clusterId } }),
  ]);

  return permissions.map((p) => {
    const grants: Record<string, boolean> = {};
    for (const rp of rolePermissions) {
      if (rp.permissionId === p.id) grants[rp.role] = rp.granted;
    }
    return { id: p.id, key: p.key, label: p.label, group: p.group, grants };
  });
}

/** Upsert role permissions within a cluster. */
export async function updateRolePermissions(
  clusterId: string,
  role: Role,
  grants: Record<string, boolean>,
): Promise<void> {
  const permissions = await prisma.permission.findMany({
    where: { key: { in: Object.keys(grants) } },
    select: { id: true, key: true },
  });

  const ops = permissions.map((p) =>
    prisma.rolePermission.upsert({
      where: { clusterId_role_permissionId: { clusterId, role, permissionId: p.id } },
      update: { granted: grants[p.key] ?? true },
      create: { clusterId, role, permissionId: p.id, granted: grants[p.key] ?? true },
    }),
  );

  await prisma.$transaction(ops);
  invalidatePermissionCache(clusterId, role);
}
