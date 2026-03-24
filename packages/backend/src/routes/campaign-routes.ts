import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as campaignCtrl from '../controllers/campaign-controller';

const router = Router();

router.use(authMiddleware);

router.get('/', campaignCtrl.listCampaigns);
router.post('/', requireRole('admin', 'manager'), campaignCtrl.createCampaign);
router.patch('/:id', requireRole('admin', 'manager'), campaignCtrl.updateCampaign);

export default router;
