import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import * as permissionService from '../services/permission-service';
import { isSuperAdminOptIn } from '../lib/permission-constants';

/**
 * Resolve the cluster whose matrix should be read/written.
 * - super_admin: honor ?clusterId=... when present (lets them pick a tenant).
 * - everyone else: pinned to their own clusterId; query param is ignored.
 * Returns null when no cluster can be resolved.
 */
function resolveTargetCluster(req: Request): string | null {
  const q = (req.query.clusterId as string | undefined)?.trim();
  if (req.user?.role === 'super_admin' && q) return q;
  return req.user?.clusterId ?? null;
}

/** GET /api/v1/permissions?clusterId= */
export async function listPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clusterId = resolveTargetCluster(req);
    if (!clusterId) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'clusterId is required' },
      });
      return;
    }
    const data = await permissionService.getAllPermissionsWithGrants(clusterId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/permissions/role/:role?clusterId= */
export async function updateRolePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = req.params;
    const { grants } = req.body as { grants: Record<string, boolean> };

    if (!grants || typeof grants !== 'object') {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'grants object required' } });
      return;
    }

    const validRoles = Object.values(Role);
    if (!validRoles.includes(role as Role)) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid role' } });
      return;
    }

    // super_admin: only opt-in keys (e.g. recording.delete) are editable;
    // every other key stays auto-granted and cannot be persisted.
    let effectiveGrants = grants;
    if (role === Role.super_admin) {
      effectiveGrants = Object.fromEntries(
        Object.entries(grants).filter(([key]) => isSuperAdminOptIn(key)),
      );
      if (Object.keys(effectiveGrants).length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'No editable super_admin permissions in payload' },
        });
        return;
      }
    }

    const clusterId = resolveTargetCluster(req);
    if (!clusterId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'clusterId is required' } });
      return;
    }

    await permissionService.updateRolePermissions(clusterId, role as Role, effectiveGrants);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
