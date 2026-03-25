import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as callLogCtrl from '../controllers/call-log-controller';
import * as dispositionCtrl from '../controllers/disposition-code-controller';
import * as qaCtrl from '../controllers/qa-annotation-controller';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

const router = Router();

router.use(authMiddleware);

// Manual call log from softphone (when CDR webhook is not available)
router.post('/manual', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { direction, callerNumber, destinationNumber, duration, startTime } = req.body;
    const callLog = await prisma.callLog.create({
      data: {
        callUuid: `manual-${uuidv4()}`,
        userId: req.user!.userId,
        direction: direction === 'inbound' ? 'inbound' : 'outbound',
        callerNumber: callerNumber || '',
        destinationNumber: destinationNumber || '',
        duration: Number(duration) || 0,
        billsec: Number(duration) || 0,
        startTime: startTime ? new Date(startTime) : new Date(),
        endTime: new Date(),
        hangupCause: 'NORMAL_CLEARING',
      },
    });
    logger.info('Manual call logged', { callLogId: callLog.id, userId: req.user!.userId });
    res.status(201).json({ success: true, data: callLog });
  } catch (err) {
    next(err);
  }
});

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
