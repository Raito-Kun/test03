import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as contactCtrl from '../controllers/contact-controller';

const router = Router();

router.use(authMiddleware);
router.use(applyDataScope('assignedTo'));

router.get('/', contactCtrl.listContacts);
router.post('/', requireRole('admin', 'manager', 'leader', 'agent_telesale', 'agent_collection'), contactCtrl.createContact);
router.get('/:id', contactCtrl.getContact);
router.patch('/:id', requireRole('admin', 'manager', 'leader', 'agent_telesale', 'agent_collection'), contactCtrl.updateContact);
router.delete('/:id', requireRole('admin', 'manager'), contactCtrl.deleteContact);
router.get('/:id/timeline', contactCtrl.getTimeline);

export default router;
