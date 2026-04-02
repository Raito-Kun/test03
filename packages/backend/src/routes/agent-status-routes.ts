import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as ctrl from '../controllers/agent-status-controller';

const router = Router();

router.use(authMiddleware);

router.put('/status', ctrl.setMyStatus);
router.get('/status', ctrl.getMyStatus);
router.get(
  '/statuses',
  requireRole('super_admin', 'admin', 'manager', 'leader'),
  ctrl.getAllStatuses,
);

export default router;
