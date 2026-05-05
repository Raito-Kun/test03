/**
 * Permission keys that super_admin does NOT auto-bypass.
 *
 * Mirrors `packages/backend/src/lib/permission-constants.ts`. For these keys,
 * super_admin must hold an explicit grant — `hasPermission` reads from
 * `user.permissions[]` instead of returning true unconditionally, and the
 * permission matrix UI unlocks the super_admin column for them.
 */
export const SUPER_ADMIN_OPT_IN_PERMISSIONS = ['recording.delete'] as const;

export type SuperAdminOptInPermission = (typeof SUPER_ADMIN_OPT_IN_PERMISSIONS)[number];

export function isSuperAdminOptIn(key: string): boolean {
  return (SUPER_ADMIN_OPT_IN_PERMISSIONS as readonly string[]).includes(key);
}
