import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as debtCaseCtrl from '../controllers/debt-case-controller';

const router = Router();

router.use(authMiddleware);
router.use(applyDataScope('assignedTo'));

router.get('/', debtCaseCtrl.listDebtCases);
router.post('/', debtCaseCtrl.createDebtCase);
router.patch('/:id', debtCaseCtrl.updateDebtCase);
router.post('/:id/promise', debtCaseCtrl.recordPTP);

export default router;
