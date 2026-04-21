import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth-middleware';
import { requirePermission } from '../middleware/rbac-middleware';
import { autoAssignLeads } from '../services/lead-assignment-service';

const router = Router();

router.use(authMiddleware, requirePermission('campaign.manage'));

const assignSchema = z.object({
  campaignId: z.string().uuid(),
  teamId: z.string().uuid(),
  mode: z.enum(['round_robin', 'workload', 'skill']).default('round_robin'),
});

/** POST /assignments/auto-assign — auto-assign unassigned leads */
router.post('/auto-assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = assignSchema.parse(req.body);
    const result = await autoAssignLeads(input.campaignId, input.teamId, input.mode);
    res.json({ success: true, data: result });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'NO_AGENTS') {
      res.status(400).json({ success: false, error: { code: e.code, message: e.message } });
      return;
    }
    next(err);
  }
});

export default router;
