import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as ctrl from '../controllers/report-controller';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('super_admin', 'admin', 'manager', 'leader', 'qa'));
router.use(applyDataScope('userId'));

// Existing endpoints (preserved)
router.get('/calls', ctrl.getCallReport);
router.get('/telesale', ctrl.getTelesaleReport);
router.get('/collection', ctrl.getCollectionReport);
router.get('/sla', ctrl.getSlaReport);

// New report endpoints
router.get('/calls/summary', ctrl.getCallSummary);
router.get('/calls/summary-by-team', ctrl.getCallSummaryByTeam);
router.get('/calls/detail', ctrl.getCallDetail);
router.get('/calls/charts', ctrl.getCallCharts);

export default router;
