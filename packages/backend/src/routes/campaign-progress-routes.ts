import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { getAllCampaignProgress, getCampaignProgress } from '../services/campaign-progress-service';

const router = Router();

router.use(authMiddleware);

/** GET /campaign-progress — get all active campaigns with progress */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getAllCampaignProgress();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/** GET /campaign-progress/:campaignId — get single campaign progress */
router.get('/:campaignId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaignId = req.params.campaignId as string;
    const result = await getCampaignProgress(campaignId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
