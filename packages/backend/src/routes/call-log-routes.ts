import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole, requirePermission } from '../middleware/rbac-middleware';
import { applyDataScope } from '../middleware/data-scope-middleware';
import * as callLogCtrl from '../controllers/call-log-controller';
import * as dispositionCtrl from '../controllers/disposition-code-controller';
import * as qaCtrl from '../controllers/qa-annotation-controller';
import { bulkDownloadRecordings } from '../services/recording-service';
import { checkFeatureEnabled } from '../middleware/feature-flag-middleware';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

const router = Router();

router.use(authMiddleware);
router.use(checkFeatureEnabled('call_history'));

const bulkDownloadSchema = z.object({
  callLogIds: z.array(z.string().uuid()).min(1).max(50),
});

/** POST /call-logs/bulk-download — download zip of recording files */
router.post('/bulk-download', requireRole('super_admin', 'admin', 'manager', 'qa', 'leader'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = bulkDownloadSchema.parse(req.body);
    await bulkDownloadRecordings(input.callLogIds, req.user!.userId, req, res);
  } catch (err) {
    next(err);
  }
});

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
router.delete('/:id/recording', requirePermission('recording.delete'), callLogCtrl.deleteRecording);

// Set disposition on call
router.post('/:id/disposition', dispositionCtrl.setCallDisposition);

// QA annotation on call
router.post(
  '/:id/qa',
  requireRole('super_admin', 'qa', 'leader', 'manager'),
  qaCtrl.createQa,
);

export default router;
