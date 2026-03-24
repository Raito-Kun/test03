import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as leadCtrl from '../controllers/lead-controller';

const router = Router();

router.use(authMiddleware);
router.use(applyDataScope('assignedTo'));

router.get('/', leadCtrl.listLeads);
router.post('/', leadCtrl.createLead);
router.patch('/:id', leadCtrl.updateLead);

export default router;
