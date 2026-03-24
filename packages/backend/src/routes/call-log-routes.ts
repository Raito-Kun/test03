import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as callLogCtrl from '../controllers/call-log-controller';
import * as dispositionCtrl from '../controllers/disposition-code-controller';
import * as qaCtrl from '../controllers/qa-annotation-controller';

const router = Router();

router.use(authMiddleware);

// Call log list & detail
router.get('/', applyDataScope('userId'), callLogCtrl.listCallLogs);
router.get('/:id', applyDataScope('userId'), callLogCtrl.getCallLog);
router.get('/:id/recording', callLogCtrl.getRecording);

// Set disposition on call
router.post('/:id/disposition', dispositionCtrl.setCallDisposition);

// QA annotation on call
router.post(
  '/:id/qa',
  requireRole('qa', 'leader', 'manager'),
  qaCtrl.createQa,
);

export default router;
