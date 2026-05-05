import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { callLimiter } from '../middleware/rate-limiter';
import * as ctrl from '../controllers/call-controller';
import { checkFeatureEnabled } from '../middleware/feature-flag-middleware';

const router = Router();

router.use(authMiddleware);
router.use(checkFeatureEnabled('voip_c2c'));

// Registration status — current user's SIP extension on the active cluster
router.get('/registration-status', ctrl.getMyRegistrationStatus);

// Click-to-call — rate limited
router.post('/originate', callLimiter, ctrl.originateCall);
router.post('/hangup', ctrl.hangupCall);
router.post('/hold', ctrl.holdCall);
router.post('/transfer', ctrl.transferCall);
router.post('/attended-transfer', ctrl.attendedTransferCall);

export default router;
