import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as ctrl from '../controllers/qa-annotation-controller';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole('super_admin', 'qa', 'leader', 'manager', 'admin'), ctrl.listQa);
router.patch('/:id', requireRole('super_admin', 'qa', 'leader', 'manager', 'admin'), ctrl.updateQa);

export default router;
