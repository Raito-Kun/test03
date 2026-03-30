import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { getSlaBreaches, getSlaSummaryStats } from '../services/sla-alert-service';

const router = Router();

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'qa', 'leader'] as const;

router.use(authMiddleware, requireRole(...ALLOWED_ROLES));

/** GET /sla-alerts/breaches — get current SLA breaches (approaching + breached) */
router.get('/breaches', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getSlaBreaches();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/** GET /sla-alerts/stats — get SLA summary stats */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getSlaSummaryStats();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
