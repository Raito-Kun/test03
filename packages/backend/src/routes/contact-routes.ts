import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as contactCtrl from '../controllers/contact-controller';
import * as importService from '../services/contact-import-service';
import { parseBuffer, type ContactImportRow } from '../services/contact-import-parser';
import {
  checkDuplicates,
  commitWizardRows,
  type CommitRowInput,
  type DuplicateAction,
} from '../services/contact-import-wizard-service';
import { checkFeatureEnabled } from '../middleware/feature-flag-middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);
router.use(checkFeatureEnabled('contacts'));
router.use(applyDataScope('assignedTo'));
// Contact model has createdBy field — agents can see contacts they created
router.use((req, _res, next) => { if (req.dataScope) req.dataScope['_hasCreatedBy'] = true; next(); });

router.get('/', contactCtrl.listContacts);
router.post('/', requireRole('super_admin', 'admin', 'manager', 'leader', 'agent'), contactCtrl.createContact);

// Import/Export
router.post('/import', requireRole('super_admin', 'admin', 'manager', 'leader'), upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: { message: 'File required' } }); return; }
    const result = await importService.importContacts(req.file.buffer, req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── 3-step wizard import ────────────────────────────────────────────────────
// Step 1 — parse upload and return preview + errors (no DB writes).
router.post('/import/preview',
  requireRole('super_admin', 'admin', 'manager', 'leader'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) { res.status(400).json({ success: false, error: { message: 'File required' } }); return; }
      const parsed = parseBuffer(req.file.buffer);
      res.json({
        success: true,
        data: {
          totalRaw: parsed.totalRaw,
          validCount: parsed.rows.length,
          errorCount: parsed.errors.length,
          rows: parsed.rows,
          errors: parsed.errors,
        },
      });
    } catch (err) { next(err); }
  },
);

// Step 2 — dedup check by phone.
router.post('/import/check-dedup',
  requireRole('super_admin', 'admin', 'manager', 'leader'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = (req.body?.rows ?? []) as ContactImportRow[];
      if (!Array.isArray(rows)) { res.status(400).json({ success: false, error: { message: 'rows must be an array' } }); return; }
      const result = await checkDuplicates(rows);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

// Step 3 — commit. Body: { rows: [{ row, action, existingId?, assignToUserId? }] }
router.post('/import/commit',
  requireRole('super_admin', 'admin', 'manager', 'leader'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const inputs = (req.body?.rows ?? []) as CommitRowInput[];
      if (!Array.isArray(inputs) || inputs.length === 0) {
        res.status(400).json({ success: false, error: { message: 'rows required' } });
        return;
      }
      const allowed: DuplicateAction[] = ['create', 'overwrite', 'merge', 'skip', 'keep'];
      for (const r of inputs) {
        if (!allowed.includes(r.action)) {
          res.status(400).json({ success: false, error: { message: `invalid action: ${r.action}` } });
          return;
        }
      }
      const result = await commitWizardRows(inputs, req.user!.userId);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },
);

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
router.patch('/:id', requireRole('super_admin', 'admin', 'manager', 'leader', 'agent'), contactCtrl.updateContact);
router.delete('/:id', requireRole('super_admin', 'admin', 'manager'), contactCtrl.deleteContact);
router.get('/:id/timeline', contactCtrl.getTimeline);

export default router;
