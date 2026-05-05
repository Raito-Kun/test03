import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as debtCaseCtrl from '../controllers/debt-case-controller';
import { checkFeatureEnabled } from '../middleware/feature-flag-middleware';

const router = Router();

router.use(authMiddleware);
router.use(checkFeatureEnabled('debt'));
router.use(applyDataScope('assignedTo'));

router.get('/', debtCaseCtrl.listDebtCases);
router.post('/', debtCaseCtrl.createDebtCase);
router.post('/escalate', requireRole('super_admin', 'admin'), debtCaseCtrl.escalateDebtTiers);
router.patch('/:id', debtCaseCtrl.updateDebtCase);
router.post('/:id/promise', debtCaseCtrl.recordPTP);

export default router;
