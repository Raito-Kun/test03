import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as ctrl from '../controllers/permission-controller';
import { checkFeatureEnabled } from '../middleware/feature-flag-middleware';

const router = Router();

router.use(authMiddleware);
router.use(checkFeatureEnabled('permission_matrix'));

// GET / — list all permissions with role grants (admin or super_admin)
router.get('/', requireRole('admin', 'super_admin'), ctrl.listPermissions);

// PUT /role/:role — update grants for a role (super_admin only)
router.put('/role/:role', requireRole('super_admin'), ctrl.updateRolePermissions);

export default router;
