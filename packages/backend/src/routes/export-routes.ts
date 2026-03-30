import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requirePermission } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import { exportToExcel } from '../services/export-service';

const router = Router();

router.use(authMiddleware, requirePermission('export_excel'), applyDataScope());

/** GET /export/:entity — stream Excel file */
router.get('/:entity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entity = req.params.entity as string;
    const filters: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.query)) {
      if (typeof val === 'string' && val) filters[key] = val;
    }
    await exportToExcel(entity, filters, req.dataScope || {}, res);
  } catch (err) {
    next(err);
  }
});

export default router;
