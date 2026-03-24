import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as ctrl from '../controllers/report-controller';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin', 'manager', 'leader', 'qa'));
router.use(applyDataScope('userId'));

router.get('/calls', ctrl.getCallReport);
router.get('/telesale', ctrl.getTelesaleReport);
router.get('/collection', ctrl.getCollectionReport);

export default router;
