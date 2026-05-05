import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { listGuarantors, addGuarantor, removeGuarantor } from '../services/guarantor-service';

const router = Router();

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'leader', 'agent'] as const;

router.use(authMiddleware, requireRole(...ALLOWED_ROLES));

/** GET /guarantors?debtCaseId=xxx — list guarantors for a debt case */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const debtCaseId = req.query.debtCaseId as string | undefined;
    const result = await listGuarantors(debtCaseId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/** POST /guarantors — add guarantor to a debt case */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { debtCaseId, fullName, relationship, phone, address } = req.body as {
      debtCaseId: string;
      fullName: string;
      relationship: string;
      phone?: string;
      address?: string;
    };
    const result = await addGuarantor({ debtCaseId, fullName, relationship, phone, address });
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

/** DELETE /guarantors/:id?debtCaseId=xxx — remove guarantor from debt case */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const debtCaseId = req.query.debtCaseId as string | undefined;
    await removeGuarantor(id, debtCaseId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
