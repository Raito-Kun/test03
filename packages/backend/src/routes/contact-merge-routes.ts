import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth-middleware';
import { requirePermission } from '../middleware/rbac-middleware';
import { findDuplicates, mergeContacts } from '../services/contact-merge-service';

const router = Router();

router.use(authMiddleware, requirePermission('manage_contacts'));

/** GET /contact-merge/duplicates — find duplicate contacts by phone */
router.get('/duplicates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await findDuplicates();
    res.json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
});

const mergeSchema = z.object({
  keepId: z.string().uuid(),
  mergeIds: z.array(z.string().uuid()).min(1),
});

/** POST /contact-merge/merge — merge contacts into surviving record */
router.post('/merge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = mergeSchema.parse(req.body);
    const result = await mergeContacts(input.keepId, input.mergeIds);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
