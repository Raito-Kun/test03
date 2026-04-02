import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as contactCtrl from '../controllers/contact-controller';
import * as importService from '../services/contact-import-service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);
router.use(applyDataScope('assignedTo'));
// Contact model has createdBy field — agents can see contacts they created
router.use((req, _res, next) => { if (req.dataScope) req.dataScope['_hasCreatedBy'] = true; next(); });

router.get('/', contactCtrl.listContacts);
router.post('/', requireRole('super_admin', 'admin', 'manager', 'leader', 'agent_telesale', 'agent_collection'), contactCtrl.createContact);

// Import/Export
router.post('/import', requireRole('super_admin', 'admin', 'manager', 'leader'), upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: { message: 'File required' } }); return; }
    const result = await importService.importContacts(req.file.buffer, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

router.get('/export', requireRole('super_admin', 'admin', 'manager', 'leader'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buffer = await importService.exportContacts({
      search: req.query.search as string | undefined,
      source: req.query.source as string | undefined,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.xlsx');
    res.send(buffer);
  } catch (err) { next(err); }
});

router.get('/:id', contactCtrl.getContact);
router.patch('/:id', requireRole('super_admin', 'admin', 'manager', 'leader', 'agent_telesale', 'agent_collection'), contactCtrl.updateContact);
router.delete('/:id', requireRole('super_admin', 'admin', 'manager'), contactCtrl.deleteContact);
router.get('/:id/timeline', contactCtrl.getTimeline);

export default router;
