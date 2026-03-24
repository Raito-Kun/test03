import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as ctrl from '../controllers/dashboard-controller';

const router = Router();

router.use(authMiddleware);
router.use(applyDataScope('userId'));

router.get('/overview', ctrl.getOverview);
router.get('/agents', ctrl.getAgentsDashboard);

export default router;
