import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as ctrl from '../controllers/disposition-code-controller';

const router = Router();

router.use(authMiddleware);

router.get('/', ctrl.listDispositionCodes);
router.post('/', requireRole('admin', 'manager'), ctrl.createDispositionCode);
router.patch('/:id', requireRole('admin', 'manager'), ctrl.updateDispositionCode);
router.delete('/:id', requireRole('admin', 'manager'), ctrl.deleteDispositionCode);

export default router;
