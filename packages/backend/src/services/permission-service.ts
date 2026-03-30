import { Role } from '@prisma/client';
import prisma from '../lib/prisma';

interface PermissionWithGrants {
  id: string;
  key: string;
  label: string;
  group: string;
  grants: Record<string, boolean>;
}

// Simple in-memory cache with TTL
const cache = new Map<string, { value: string[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

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

export function invalidatePermissionCache(role?: Role): void {
  if (role) {
    cache.delete(role);
  } else {
    cache.clear();
  }
}

/** Returns permission keys for a role. super_admin gets all keys. */
export async function getPermissionsForRole(role: Role): Promise<string[]> {
  if (role === Role.super_admin) {
    const cached = getCached('__all__');
    if (cached) return cached;
    const all = await prisma.permission.findMany({ select: { key: true } });
    const keys = all.map((p) => p.key);
    setCache('__all__', keys);
    return keys;
  }

  const cached = getCached(role);
  if (cached) return cached;

  const rps = await prisma.rolePermission.findMany({
    where: { role, granted: true },
    include: { permission: { select: { key: true } } },
  });
  const keys = rps.map((rp) => rp.permission.key);
  setCache(role, keys);
  return keys;
}

/** Returns all permissions with role grant map for the UI matrix */
export async function getAllPermissionsWithGrants(): Promise<PermissionWithGrants[]> {
  const permissions = await prisma.permission.findMany({
    include: { rolePermissions: true },
    orderBy: [{ group: 'asc' }, { key: 'asc' }],
  });

  return permissions.map((p) => {
    const grants: Record<string, boolean> = {};
    for (const rp of p.rolePermissions) {
      grants[rp.role] = rp.granted;
    }
    return { id: p.id, key: p.key, label: p.label, group: p.group, grants };
  });
}

/** Upsert role permissions for a given role */
export async function updateRolePermissions(
  role: Role,
  grants: Record<string, boolean>,
): Promise<void> {
  const permissions = await prisma.permission.findMany({
    where: { key: { in: Object.keys(grants) } },
    select: { id: true, key: true },
  });

  const ops = permissions.map((p) =>
    prisma.rolePermission.upsert({
      where: { role_permissionId: { role, permissionId: p.id } },
      update: { granted: grants[p.key] ?? true },
      create: { role, permissionId: p.id, granted: grants[p.key] ?? true },
    }),
  );

  await prisma.$transaction(ops);
  invalidatePermissionCache(role);
}
