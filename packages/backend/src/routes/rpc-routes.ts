import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { markRightPartyContact, getRpcStats } from '../services/right-party-contact-service';

const router = Router();

router.use(authMiddleware);

/** POST /rpc/mark — mark a call as Right Party Contact */
router.post(
  '/mark',
  requireRole('agent', 'leader', 'manager', 'admin', 'super_admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callLogId, isRightParty } = req.body as {
        callLogId: string;
        isRightParty: boolean;
      };
      const result = await markRightPartyContact({ callLogId, isRightParty, userId: req.user!.userId });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /rpc/stats — get RPC statistics */
router.get(
  '/stats',
  requireRole('leader', 'manager', 'admin', 'super_admin', 'qa'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dateFrom, dateTo, userId, teamId } = req.query as {
        dateFrom?: string;
        dateTo?: string;
        userId?: string;
        teamId?: string;
      };
      const result = await getRpcStats({ dateFrom, dateTo, userId, teamId });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
