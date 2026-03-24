import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { callLimiter } from '../middleware/rate-limiter';
import * as ctrl from '../controllers/call-controller';

const router = Router();

router.use(authMiddleware);

// Click-to-call — rate limited
router.post('/originate', callLimiter, ctrl.originateCall);
router.post('/hangup', ctrl.hangupCall);
router.post('/hold', ctrl.holdCall);
router.post('/transfer', ctrl.transferCall);

export default router;
