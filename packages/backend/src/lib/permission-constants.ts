/**
 * Permission keys that super_admin does NOT auto-bypass.
 *
 * For these keys, super_admin must hold an explicit grant in
 * `role_permissions` just like any other role. Used to gate destructive
 * actions where even the highest-privilege user should opt in.
 */
export const SUPER_ADMIN_OPT_IN_PERMISSIONS = ['recording.delete'] as const;

export type SuperAdminOptInPermission = (typeof SUPER_ADMIN_OPT_IN_PERMISSIONS)[number];

export function isSuperAdminOptIn(key: string): boolean {
  return (SUPER_ADMIN_OPT_IN_PERMISSIONS as readonly string[]).includes(key);
}
