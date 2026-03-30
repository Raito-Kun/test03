import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import * as permissionService from '../services/permission-service';

/** GET /api/v1/permissions */
export async function listPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await permissionService.getAllPermissionsWithGrants();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/v1/permissions/role/:role */
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

    // Cannot modify super_admin grants — they always have all permissions
    if (role === Role.super_admin) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Cannot modify super_admin permissions' } });
      return;
    }

    await permissionService.updateRolePermissions(role as Role, grants);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
}
