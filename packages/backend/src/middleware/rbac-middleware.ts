import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { getPermissionsForRole } from '../services/permission-service';
import { isSuperAdminOptIn } from '../lib/permission-constants';

/**
 * RBAC middleware factory.
 * Checks if authenticated user's role is in the allowed list.
 * super_admin always passes.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const role = req.user.role as Role;

    // super_admin bypasses all role checks
    if (role === Role.super_admin) {
      next();
      return;
    }

    if (!allowedRoles.includes(role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
      return;
    }

    next();
  };
}

/**
 * Permission-based middleware factory.
 * Checks if authenticated user's role has any of the required permission keys.
 * super_admin bypasses for all keys EXCEPT those in SUPER_ADMIN_OPT_IN_PERMISSIONS,
 * which require an explicit grant in role_permissions just like other roles.
 */
export function requirePermission(...keys: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const role = req.user.role as Role;

    // super_admin bypasses unless ALL required keys are opt-in.
    // If any required key is auto-granted, super_admin satisfies that alternative.
    if (role === Role.super_admin && keys.some((k) => !isSuperAdminOptIn(k))) {
      next();
      return;
    }

    try {
      const permissions = await getPermissionsForRole(role, req.user.clusterId);
      const hasAny = keys.some((k) => permissions.includes(k));
      if (!hasAny) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
