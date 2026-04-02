import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as leadCtrl from '../controllers/lead-controller';
import { importLeads } from '../services/lead-import-service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);
router.use(applyDataScope('assignedTo'));

router.get('/', leadCtrl.listLeads);
router.get('/follow-ups', leadCtrl.listFollowUps);
router.post('/', leadCtrl.createLead);
router.patch('/:id', leadCtrl.updateLead);

router.post(
  '/import',
  requireRole('super_admin', 'admin', 'manager'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: { message: 'File required' } });
        return;
      }
      const result = await importLeads(req.file.buffer, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
