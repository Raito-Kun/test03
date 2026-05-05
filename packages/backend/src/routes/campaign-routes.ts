import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as campaignCtrl from '../controllers/campaign-controller';
import { importCampaigns } from '../services/campaign-import-service';
import { checkFeatureEnabled } from '../middleware/feature-flag-middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);
router.use(checkFeatureEnabled('campaigns'));

router.get('/', campaignCtrl.listCampaigns);
router.get('/:id', campaignCtrl.getCampaignById);
router.post('/', requireRole('super_admin', 'admin', 'manager'), campaignCtrl.createCampaign);
router.patch('/:id', requireRole('super_admin', 'admin', 'manager'), campaignCtrl.updateCampaign);

router.post(
  '/:id/agents',
  requireRole('super_admin', 'admin', 'manager'),
  campaignCtrl.addCampaignAgents,
);

router.delete(
  '/:id/agents/:userId',
  requireRole('super_admin', 'admin', 'manager'),
  campaignCtrl.removeCampaignAgent,
);

router.post(
  '/import',
  requireRole('super_admin', 'admin'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: { message: 'File required' } });
        return;
      }
      const result = await importCampaigns(req.file.buffer, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
